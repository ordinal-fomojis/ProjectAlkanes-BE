import { ObjectId } from 'mongodb';

export interface IUser {
  _id?: ObjectId;
  walletAddress: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface CreateUserRequest {
  walletAddress: string;
}

export interface UpdateUserRequest {
  lastLoginAt?: Date;
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

    return updateData;
  }
} 