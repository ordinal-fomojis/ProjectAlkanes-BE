import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import { ENV } from '../config/env.js'
import { DatabaseCollection } from '../database/collections.js'
import { ServerError, UserError } from '../utils/errors.js'
import { sanitiseAddress } from '../utils/sanitiseAddress.js'
import { verifySignature } from '../utils/verifySignature.js'
import { BaseService } from './BaseService.js'
import { UserService } from './userService.js'

export interface NonceData {
  _id?: string
  walletAddress: string
  nonce: string
  message: string
  expiresAt: Date
  createdAt: Date
  used?: boolean
}

export interface JWTPayload {
  userId: string
  walletAddress: string
  iat: number
  exp: number
}

export class AuthService extends BaseService<NonceData> {
  readonly collectionName = DatabaseCollection.AuthNonces
  private readonly userService: UserService
  private readonly jwtSecret: string
  private readonly jwtExpiresIn: string

  constructor() {
    super()
    this.userService = new UserService()
    this.jwtSecret = process.env.JWT_SECRET || 'your-default-secret-change-this'
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h'
    
    if (this.jwtSecret === 'your-default-secret-change-this') {
      if (ENV === 'production') {
        throw new ServerError('JWT_SECRET environment variable must be set in production')
      }
    }
  }

  async generateNonce(walletAddress: string): Promise<NonceData> {
    walletAddress = sanitiseAddress(walletAddress)
    // Clean up ALL existing nonces for this wallet (expired and active)
    // This ensures only one active nonce per wallet at a time
    await this.collection.deleteMany({
      walletAddress
    })

    // Generate cryptographically secure nonce
    const nonce = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    
    const message = `Please sign this message to authenticate with your wallet.\n\nNonce: ${nonce}\nWallet: ${walletAddress}\nTimestamp: ${new Date().toISOString()}`

    const nonceData: NonceData = {
      walletAddress,
      nonce,
      message,
      expiresAt,
      createdAt: new Date(),
      used: false
    }

    // Store nonce in database
    const result = await this.collection.insertOne(nonceData)
    
    return {
      _id: result.insertedId.toString(),
      ...nonceData
    }
  }

  async verifySignatureAndCreateJWT(walletAddress: string, signature: string, message: string): Promise<{
    token: string
    user: {
      _id: ObjectId
      walletAddress: string
      createdAt: Date
      lastLoginAt?: Date
    }
    expiresAt: Date
  }> {
    // Find the nonce record
    const nonceRecord = await this.collection.findOne({
      walletAddress: sanitiseAddress(walletAddress),
      message,
      used: { $ne: true },
      expiresAt: { $gt: new Date() }
    })

    if (!nonceRecord) {
      throw new Error('Invalid or expired nonce')
    }

    // Mark nonce as used
    await this.collection.updateOne(
      { _id: nonceRecord._id },
      { $set: { used: true } }
    )

    if (!verifySignature(signature, message, walletAddress)) {
      throw new UserError('Invalid signature')
    }

    // Get or create user
    const user = await this.userService.createUser({ walletAddress })

    // Create JWT token
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user._id!.toString(),
      walletAddress: user.walletAddress
    }

    const token = jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn } as jwt.SignOptions)
    const decoded = jwt.decode(token) as JWTPayload

    return {
      token,
      user: {
        _id: user._id!,
        walletAddress: user.walletAddress,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      },
      expiresAt: new Date(decoded.exp * 1000)
    }
  }

  async validateJWT(token: string): Promise<JWTPayload> {
    try {
      return jwt.verify(token, this.jwtSecret) as JWTPayload
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UserError('JWT has expired').withStatus(401)
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new UserError('Invalid JWT').withStatus(401)
      } else {
        throw new ServerError('JWT validation failed')
      }
    }
  }

  async cleanupExpiredNonces(): Promise<void> {
    await this.collection.deleteMany({
      expiresAt: { $lt: new Date() }
    })
  }
} 
