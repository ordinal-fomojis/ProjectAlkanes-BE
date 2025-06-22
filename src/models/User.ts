import { ObjectId } from 'mongodb';

export interface IUser {
  _id?: ObjectId;
  walletAddress: string;
  createdAt: Date;
  lastLoginAt?: Date;
  referralCode?: string;
  referredBy?: ObjectId;
  referredUsers?: ObjectId[];
}

export interface CreateUserRequest {
  walletAddress: string;
}

export interface UpdateUserRequest {
  lastLoginAt?: Date;
  referralCode?: string;
  referredBy?: ObjectId;
}

export interface ReferralInfo {
  referralCode: string;
  referredBy?: {
    _id: ObjectId;
    walletAddress: string;
  };
  referredUsers: {
    _id: ObjectId;
    walletAddress: string;
    createdAt: Date;
  }[];
  totalReferrals: number;
}

export class User {
  static readonly COLLECTION_NAME = 'users';

  static createUser(walletAddress: string): Omit<IUser, '_id'> {
    return {
      walletAddress: walletAddress.toLowerCase().trim(),
      createdAt: new Date()
    };
  }

  static updateUser(updates: UpdateUserRequest): Partial<IUser> {
    const updateData: Partial<IUser> = {};
    
    if (updates.lastLoginAt !== undefined) {
      updateData.lastLoginAt = updates.lastLoginAt;
    }

    if (updates.referralCode !== undefined) {
      updateData.referralCode = updates.referralCode;
    }

    if (updates.referredBy !== undefined) {
      updateData.referredBy = updates.referredBy;
    }

    return updateData;
  }

  static generateReferralCode(): string {
    // Generate a 6-character alphanumeric code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
} 