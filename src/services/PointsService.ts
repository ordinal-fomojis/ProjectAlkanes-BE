import { ClientSession, ObjectId } from 'mongodb'
import { calculateBonusPoints, getTierByPoints } from '../config/tiers.js'
import { IUser, User } from '../models/User.js'
import { sanitizeAddress } from '../utils/sanitiseAddress.js'
import { BaseService } from './BaseService.js'

export interface PointsTransaction {
  userId: ObjectId;
  points: number;
  reason: string;
  mintTxId?: ObjectId;
  fromWallet?: string; // Wallet address of the user who triggered the points (the minter)
  createdAt: Date;
}

export class PointsService extends BaseService<IUser> {
  readonly collectionName = User.COLLECTION_NAME;

  /**
   * Add points to a user's balance
   */
  async addPoints(
    walletAddress: string, 
    points: number, 
    reason = 'Referral mint reward',
    session?: ClientSession,
    fromWallet?: string,
    mintTxId?: ObjectId
  ): Promise<boolean> {
    try {
      // Log parameters for debugging (to avoid unused variable warnings)
      console.debug('Adding points:', { walletAddress, points, reason, fromWallet, mintTxId });
      
      // Simple increment - works for any points (not just referral points)
      const result = await this.collection.updateOne(
        { walletAddress: sanitizeAddress(walletAddress) },
        { 
          $inc: { points: points }
        },
        { session, upsert: false }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error adding points:', error);
      throw new Error('Failed to add points');
    }
  }

  /**
   * Add referral points to a user's balance with tier bonus applied
   * (updates both total points and referral-specific points)
   */
  async addReferralPoints(
    walletAddress: string, 
    basePoints: number, 
    reason = 'Referral mint reward',
    session?: ClientSession,
    fromWallet?: string,
    mintTxId?: ObjectId
  ): Promise<{ pointsAwarded: number; tier: string; bonus: number }> {
    walletAddress = sanitizeAddress(walletAddress);
    try {
      // First, get the user's current tier to determine bonus
      const user = await this.collection.findOne({ 
        walletAddress
      }, { session });

      if (!user) {
        throw new Error('User not found for referral points');
      }

      // Calculate current tier based on total points
      const totalPoints = user.points || 0;
      const currentTier = getTierByPoints(totalPoints);
      
      // Apply tier bonus to base points
      const bonusPoints = calculateBonusPoints(basePoints, currentTier);
      
      // Log the referral points transaction for debugging/analytics
      console.log(`Adding referral points: ${reason}, from: ${fromWallet || 'unknown'}, mintTx: ${mintTxId || 'unknown'}, points: ${bonusPoints}`);
      
      // Update both points and pointsEarnedFromReferrals atomically
      const result = await this.collection.updateOne(
        { walletAddress },
        { 
          $inc: { 
            points: bonusPoints,
            pointsEarnedFromReferrals: bonusPoints
          }
        },
        { session, upsert: false }
      );

      if (result.modifiedCount === 0) {
        throw new Error('Failed to update user points');
      }

      return {
        pointsAwarded: bonusPoints,
        tier: currentTier.level,
        bonus: currentTier.bonus
      };
    } catch (error) {
      console.error('Error adding referral points:', error);
      throw new Error('Failed to add referral points');
    }
  }

  /**
   * Award mint points to the user who is minting (with tier bonus)
   */
  async awardMintPoints(
    minterWalletAddress: string,
    mintCount: number,
    basePointsPerMint = 10,
    session?: ClientSession
  ): Promise<{ pointsAwarded: number; tier: string; bonus: number }> {
    minterWalletAddress = sanitizeAddress(minterWalletAddress);
    try {
      // Get the minter's current tier
      const user = await this.collection.findOne({ 
        walletAddress: minterWalletAddress
      }, { session });

      if (!user) {
        // User doesn't exist yet, use Common tier (no bonus)
        const basePoints = mintCount * basePointsPerMint;
        
        // Still try to update in case user was created concurrently
        const result = await this.collection.updateOne(
          { walletAddress: minterWalletAddress },
          { $inc: { points: basePoints } },
          { session, upsert: false }
        );

        if (result.modifiedCount === 0) {
          console.warn(`Could not award mint points to ${minterWalletAddress} - user not found`);
        }

        return {
          pointsAwarded: basePoints,
          tier: 'Common',
          bonus: 1.0
        };
      }

      // Calculate current tier based on total points
      const totalPoints = user.points || 0;
      const currentTier = getTierByPoints(totalPoints);
      
      // Apply tier bonus to mint points
      const basePoints = mintCount * basePointsPerMint;
      const bonusPoints = calculateBonusPoints(basePoints, currentTier);
      
      // Update user's total points (don't update pointsEarnedFromReferrals for mint points)
      const result = await this.collection.updateOne(
        { walletAddress: minterWalletAddress },
        { $inc: { points: bonusPoints } },
        { session, upsert: false }
      );

      if (result.modifiedCount === 0) {
        throw new Error('Failed to update minter points');
      }

      console.log(`Awarded ${bonusPoints} mint points (${basePoints} base × ${currentTier.bonus} ${currentTier.level} bonus) to ${minterWalletAddress}`);

      return {
        pointsAwarded: bonusPoints,
        tier: currentTier.level,
        bonus: currentTier.bonus
      };
    } catch (error) {
      console.error('Error awarding mint points:', error);
      throw new Error('Failed to award mint points');
    }
  }

  /**
   * Award fixed referral points (no tier bonus applied)
   */
  async awardFixedReferralPoints(
    referrerWalletAddress: string,
    pointsToAward: number,
    reason = 'Referral reward',
    session?: ClientSession,
    fromWallet?: string,
    mintTxId?: ObjectId
  ): Promise<boolean> {
    try {
      // Log the referral reward
      console.log(`Adding fixed referral points: ${reason}, from: ${fromWallet || 'unknown'}, mintTx: ${mintTxId || 'unknown'}, points: ${pointsToAward}`);
      
      // Update both total points and referral points (fixed amount, no bonus)
      const result = await this.collection.updateOne(
        { walletAddress: sanitizeAddress(referrerWalletAddress) },
        { 
          $inc: { 
            points: pointsToAward,
            pointsEarnedFromReferrals: pointsToAward
          }
        },
        { session, upsert: false }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error adding fixed referral points:', error);
      throw new Error('Failed to add fixed referral points');
    }
  }

  /**
   * Get points balance for a user
   */
  async getPointsBalance(walletAddress: string): Promise<number> {
    try {
      const user = await this.collection.findOne({ 
        walletAddress: sanitizeAddress(walletAddress) 
      });

      return user?.points || 0;
    } catch (error) {
      console.error('Error getting points balance:', error);
      throw new Error('Failed to get points balance');
    }
  }

  /**
   * Get user by wallet address
   */
  async getUserByWallet(walletAddress: string): Promise<IUser | null> {
    return await this.collection.findOne({ 
      walletAddress: sanitizeAddress(walletAddress) 
    });
  }

  /**
   * Award referral points for a mint transaction
   * This is the main method called when someone mints tokens
   */
  async awardReferralPoints(
    minterWalletAddress: string,
    mintCount: number,
    mintTxId: ObjectId,
    session?: ClientSession
  ): Promise<{ 
    awarded: boolean; 
    referrerWallet?: string; 
    pointsAwarded?: number;
  }> {
    try {
      // Find the user who did the minting
      const minter = await this.collection.findOne({ 
        walletAddress: sanitizeAddress(minterWalletAddress) 
      }, { session });

      // Check if minter was referred by someone
      if (!minter || !minter.referredBy) {
        return { awarded: false };
      }

      // Find the referrer
      const referrer = await this.collection.findOne({ 
        _id: minter.referredBy 
      }, { session });

      if (!referrer) {
        console.warn(`Referrer not found for user ${minterWalletAddress}`);
        return { awarded: false };
      }

      // Award fixed referral points (1 point per mint, no tier bonus)
      const referralPointsPerMint = 1;
      const totalReferralPoints = mintCount * referralPointsPerMint;
      
      const success = await this.awardFixedReferralPoints(
        referrer.walletAddress,
        totalReferralPoints,
        `Referral reward from ${minterWalletAddress}`,
        session,
        minterWalletAddress,
        mintTxId
      );

      if (success) {
        console.log(`Awarded ${totalReferralPoints} fixed referral points to ${referrer.walletAddress} for mint by ${minterWalletAddress}`);
        
        return { 
          awarded: true, 
          referrerWallet: referrer.walletAddress, 
          pointsAwarded: totalReferralPoints
        };
      } else {
        console.warn(`Failed to award referral points to ${referrer.walletAddress}`);
        return { awarded: false };
      }
    } catch (error) {
      console.error('Error awarding referral points:', error);
      throw new Error('Failed to award referral points');
    }
  }
} 
