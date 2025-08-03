import { CreateUserRequest, IUser, User } from '../models/User.js'
import { ServerError } from '../utils/errors.js'
import { BaseService } from './BaseService.js'

export class UserService extends BaseService<IUser> {
  readonly collectionName = User.COLLECTION_NAME
  
  private sanitizeWalletAddress(address: string): string {
    // Remove any HTML/script tags and normalize
    return address
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[^\w\-.]/g, '') // Only allow alphanumeric, hyphens, and dots
      .toLowerCase()
      .trim();
  }

  private async generateUniqueReferralCode(): Promise<string> {
    const maxAttempts = 10;

    for (let i = 0; i < maxAttempts; i++) {
      const referralCode = User.generateReferralCode();
      
      const isUnique = (await this.collection.countDocuments({ referralCode })) === 0
      if (isUnique) {
        return referralCode;
      }
    }

    throw new ServerError('Failed to generate unique referral code');
  }

  async createUser(userData: CreateUserRequest): Promise<IUser> {
    const normalizedAddress = this.sanitizeWalletAddress(userData.walletAddress);
    
    const newUser = User.createUser(normalizedAddress);
    const referralCode = await this.generateUniqueReferralCode();
    const user = await this.collection.findOneAndUpdate(
      { walletAddress: normalizedAddress },
      {
        $set: { lastLoginAt: new Date() },
        $setOnInsert: { ...newUser, referralCode }
      },
      { upsert: true, returnDocument: 'after' }
    )

    if (user == null) {
      throw new ServerError('Failed to update existing user');
    }

    return user
  }

  async getUserByWalletAddress(walletAddress: string): Promise<IUser | null> {
    const normalizedAddress = this.sanitizeWalletAddress(walletAddress);
    return await this.collection.findOne({ walletAddress: normalizedAddress });
  }
} 
