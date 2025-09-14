import { Response } from 'express'
import { ObjectId } from 'mongodb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthenticatedRequest } from '../../src/middleware/auth.js'
import { checkReferral, requireReferral } from '../../src/middleware/referralGate.js'
import { UserService } from '../../src/services/userService.js'

// Mock UserService
vi.mock('../../src/services/userService.js')

describe('Referral Gate Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>
  let mockResponse: Partial<Response>
  let mockNext: ReturnType<typeof vi.fn>
  let mockUserService: {
    getUserByWalletAddress: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockRequest = {
      user: {
        userId: 'test-user-id',
        walletAddress: 'bc1qtest123'
      }
    }
    
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    }
    
    mockNext = vi.fn()
    
    mockUserService = {
      getUserByWalletAddress: vi.fn()
    }
    
    // @ts-expect-error - Mocking UserService constructor for testing
    UserService.mockImplementation(() => mockUserService)
    
    vi.clearAllMocks()
  })

  describe('requireReferral middleware', () => {
    it('should allow referred users to proceed', async () => {
      // Setup: User has been referred
      mockUserService.getUserByWalletAddress.mockResolvedValue({
        _id: new ObjectId(),
        walletAddress: 'bc1qtest123',
        referredBy: new ObjectId() // User was referred
      })

      await requireReferral(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).toHaveBeenCalled()
      expect(mockResponse.status).not.toHaveBeenCalled()
    })

    it('should block unreferred users', async () => {
      // Setup: User has NOT been referred
      mockUserService.getUserByWalletAddress.mockResolvedValue({
        _id: new ObjectId(),
        walletAddress: 'bc1qtest123',
        referredBy: null // User was NOT referred
      })

      await requireReferral(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(403)
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: You must be referred by another user to perform this action. Please enter a referral code first.',
        code: 'REFERRAL_REQUIRED'
      })
    })

    it('should require authentication', async () => {
      mockRequest.user = undefined

      await requireReferral(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(401)
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      })
    })

    it('should handle user not found', async () => {
      mockUserService.getUserByWalletAddress.mockResolvedValue(null)

      await requireReferral(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(404)
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      })
    })

    it('should handle database errors', async () => {
      mockUserService.getUserByWalletAddress.mockRejectedValue(new Error('Database error'))

      await requireReferral(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      )

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(500)
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      })
    })
  })

  describe('requireReferralForReferralAction', () => {
    it('should allow referred users to perform referral actions', async () => {
      mockUserService.getUserByWalletAddress.mockResolvedValue({
        _id: new ObjectId(),
        walletAddress: 'bc1qtest123',
        referredBy: new ObjectId()
      })

      const result = await checkReferral('bc1qtest123')

      expect(result).toEqual({ allowed: true })
    })

    it('should block unreferred users from referral actions', async () => {
      mockUserService.getUserByWalletAddress.mockResolvedValue({
        _id: new ObjectId(),
        walletAddress: 'bc1qtest123',
        referredBy: null
      })

      const result = await checkReferral('bc1qtest123')

      expect(result).toEqual({
        allowed: false,
        message: 'Access denied: You must be referred by another user before you can refer others. Please enter a referral code first.'
      })
    })

    it('should handle user not found', async () => {
      mockUserService.getUserByWalletAddress.mockResolvedValue(null)

      const result = await checkReferral('bc1qtest123')

      expect(result).toEqual({
        allowed: false,
        message: 'User not found'
      })
    })

    it('should handle errors gracefully', async () => {
      mockUserService.getUserByWalletAddress.mockRejectedValue(new Error('Database error'))

      const result = await checkReferral('bc1qtest123')

      expect(result).toEqual({
        allowed: false,
        message: 'Internal server error'
      })
    })
  })
}) 
