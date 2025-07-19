import { ClientSession, ObjectId } from 'mongodb'
import { calculateBonusPoints, getTierByPoints } from '../config/tiers.js'
import { IUser, User } from '../models/User.js'
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
    _reason: string = 'Referral mint reward',
    session?: ClientSession,
    _fromWallet?: string,
    _mintTxId?: ObjectId
  ): Promise<boolean> {
    try {
      // Simple increment - works for any points (not just referral points)
      const result = await this.collection.updateOne(
        { walletAddress: walletAddress.toLowerCase().trim() },
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
    reason: string = 'Referral mint reward',
    session?: ClientSession,
    fromWallet?: string,
    mintTxId?: ObjectId
  ): Promise<{ pointsAwarded: number; tier: string; bonus: number }> {
    try {
      // First, get the user's current tier to determine bonus
      const user = await this.collection.findOne({ 
        walletAddress: walletAddress.toLowerCase().trim() 
      }, { session });

      if (!user) {
        throw new Error('User not found for referral points');
      }

      // Calculate current tier based on existing referral points
      const currentReferralPoints = user.pointsEarnedFromReferrals || 0;
      const currentTier = getTierByPoints(currentReferralPoints);
      
      // Apply tier bonus to base points
      const bonusPoints = calculateBonusPoints(basePoints, currentTier);
      
      // Log the referral points transaction for debugging/analytics
      console.log(`Adding referral points: ${reason}, from: ${fromWallet || 'unknown'}, mintTx: ${mintTxId || 'unknown'}, points: ${bonusPoints}`);
      
      // Update both points and pointsEarnedFromReferrals atomically
      const result = await this.collection.updateOne(
        { walletAddress: walletAddress.toLowerCase().trim() },
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
   * Get points balance for a user
   */
  async getPointsBalance(walletAddress: string): Promise<number> {
    try {
      const user = await this.collection.findOne({ 
        walletAddress: walletAddress.toLowerCase().trim() 
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
      walletAddress: walletAddress.toLowerCase().trim() 
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
    tier?: string;
    bonus?: number;
    basePoints?: number;
  }> {
    try {
      // Find the user who did the minting
      const minter = await this.collection.findOne({ 
        walletAddress: minterWalletAddress.toLowerCase().trim() 
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

      // Award points with tier bonus applied
      const basePointsToAward = mintCount; // 1 token = 1 base point
      const pointsResult = await this.addReferralPoints(
        referrer.walletAddress,
        basePointsToAward,
        `Referral mint reward from ${minterWalletAddress}`,
        session,
        minterWalletAddress,
        mintTxId
      );

      console.log(`Awarded ${pointsResult.pointsAwarded} points (${basePointsToAward} base × ${pointsResult.bonus} ${pointsResult.tier} bonus) to referrer ${referrer.walletAddress} for mint by ${minterWalletAddress}`);
      
      return { 
        awarded: true, 
        referrerWallet: referrer.walletAddress, 
        pointsAwarded: pointsResult.pointsAwarded,
        tier: pointsResult.tier,
        bonus: pointsResult.bonus,
        basePoints: basePointsToAward
      };
    } catch (error) {
      console.error('Error awarding referral points:', error);
      throw new Error('Failed to award referral points');
    }
  }
} 
