import { ObjectId } from 'mongodb';

export interface IUser {
  _id?: ObjectId;
  walletAddress: string;
  createdAt: Date;
  lastLoginAt?: Date;
  referralCode?: string;
  customReferralId?: string;
  referredBy?: ObjectId;
  referredUsers?: ObjectId[];
}

export interface CreateUserRequest {
  walletAddress: string;
}

export interface UpdateUserRequest {
  lastLoginAt?: Date;
  referralCode?: string;
  customReferralId?: string;
  referredBy?: ObjectId;
}

export interface ReferralInfo {
  referralCode: string;
  customReferralId?: string;
  referredBy?: {
    _id: ObjectId;
    walletAddress: string;
    customReferralId?: string;
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

    if (updates.customReferralId !== undefined) {
      updateData.customReferralId = updates.customReferralId;
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

  static validateCustomReferralId(customId: string): boolean {
    // Custom referral ID validation rules:
    // - 3-20 characters long
    // - Only alphanumeric characters and hyphens
    // - Cannot start or end with hyphen
    // - No consecutive hyphens
    const pattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
    return customId.length >= 3 && customId.length <= 20 && pattern.test(customId) && !customId.includes('--');
  }

  static sanitizeCustomReferralId(customId: string): string {
    // Convert to lowercase and remove any invalid characters
    return customId.toLowerCase().replace(/[^a-z0-9-]/g, '');
  }
} 