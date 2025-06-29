import { CreateUserRequest, IUser, User } from '../models/User.js'
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
    let referralCode: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      referralCode = User.generateReferralCode();
      
      const existingUser = await this.collection.findOne({ referralCode });
      if (!existingUser) {
        isUnique = true;
        return referralCode;
      }
      
      attempts++;
    }

    throw new Error('Failed to generate unique referral code');
  }

  async createUser(userData: CreateUserRequest): Promise<IUser> {
    const normalizedAddress = this.sanitizeWalletAddress(userData.walletAddress);
    
    // Check if user already exists
    const existingUser = await this.collection.findOne({ 
      walletAddress: normalizedAddress 
    });

    if (existingUser) {
      // Update last login time for existing user
      const result = await this.collection.findOneAndUpdate(
        { walletAddress: normalizedAddress },
        { 
          $set: { 
            lastLoginAt: new Date()
          } 
        },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new Error('Failed to update existing user');
      }

      return result;
    }

    // Create new user with referral code
    const newUser = User.createUser(normalizedAddress);
    const referralCode = await this.generateUniqueReferralCode();
    
    const userWithReferralCode = {
      ...newUser,
      referralCode
    };

    const result = await this.collection.insertOne(userWithReferralCode);
    
    return {
      _id: result.insertedId,
      ...userWithReferralCode
    };
  }

  async getUserByWalletAddress(walletAddress: string): Promise<IUser | null> {
    const normalizedAddress = this.sanitizeWalletAddress(walletAddress);
    return await this.collection.findOne({ walletAddress: normalizedAddress });
  }
} 
