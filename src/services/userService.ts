import { Collection } from 'mongodb';
import { database } from '../config/database';
import { IUser, CreateUserRequest, User } from '../models/User';

export class UserService {
  private collection: Collection<IUser>;

  constructor() {
    this.collection = database.getDb().collection<IUser>(User.COLLECTION_NAME);
  }

  private sanitizeWalletAddress(address: string): string {
    // Remove any HTML/script tags and normalize
    return address
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[^\w\-\.]/g, '') // Only allow alphanumeric, hyphens, and dots
      .toLowerCase()
      .trim();
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

    // Create new user
    const newUser = User.createUser(normalizedAddress);
    const result = await this.collection.insertOne(newUser);
    
    return {
      _id: result.insertedId,
      ...newUser
    };
  }

  async getUserByWalletAddress(walletAddress: string): Promise<IUser | null> {
    const normalizedAddress = this.sanitizeWalletAddress(walletAddress);
    return await this.collection.findOne({ walletAddress: normalizedAddress });
  }
} 