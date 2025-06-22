import { IUser, ReferralInfo, User } from '../models/User.js';
import { BaseService } from './BaseService.js';

export class ReferralService extends BaseService<IUser> {
  protected readonly collectionName = User.COLLECTION_NAME;

  async getReferralInfo(walletAddress: string): Promise<ReferralInfo | null> {
    try {
      const user = await this.collection.findOne({ 
        walletAddress: walletAddress.toLowerCase().trim() 
      });

      if (!user) {
        return null;
      }

      // Get referrer info if user was referred
      let referrerInfo = undefined;
      if (user.referredBy) {
        const referrer = await this.collection.findOne({ _id: user.referredBy });
        if (referrer) {
          referrerInfo = {
            _id: referrer._id!,
            walletAddress: referrer.walletAddress
          };
        }
      }

      // Get referred users info
      const referredUsers = await this.collection.find({
        _id: { $in: user.referredUsers || [] }
      }).toArray();

      const referredUsersInfo = referredUsers.map(u => ({
        _id: u._id!,
        walletAddress: u.walletAddress,
        createdAt: u.createdAt
      }));

      return {
        referralCode: user.referralCode!,
        referredBy: referrerInfo,
        referredUsers: referredUsersInfo,
        totalReferrals: referredUsersInfo.length
      };
    } catch (error) {
      console.error('Error getting referral info:', error);
      throw new Error('Failed to get referral information');
    }
  }

  async enterReferralCode(walletAddress: string, referralCode: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check if user exists
      const user = await this.collection.findOne({ 
        walletAddress: walletAddress.toLowerCase().trim() 
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Check if user is already referred
      if (user.referredBy) {
        return { success: false, message: 'User is already referred' };
      }

      // Find referrer by referral code
      const referrer = await this.collection.findOne({ referralCode });
      if (!referrer) {
        return { success: false, message: 'Invalid referral code' };
      }

      // Prevent self-referral
      if (referrer._id?.equals(user._id!)) {
        return { success: false, message: 'Cannot refer yourself' };
      }

      // Update user with referrer
      await this.collection.updateOne(
        { _id: user._id },
        { $set: { referredBy: referrer._id } }
      );

      // Add user to referrer's referredUsers array
      await this.collection.updateOne(
        { _id: referrer._id },
        { $push: { referredUsers: user._id } }
      );

      return { success: true, message: 'Referral code applied successfully' };
    } catch (error) {
      console.error('Error entering referral code:', error);
      throw new Error('Failed to process referral code');
    }
  }
} 