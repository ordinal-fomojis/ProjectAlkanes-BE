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

      await expect(requireReferral(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      )).rejects.toThrow('Access denied: You must be referred by another user to perform this action. Please enter a referral code first')

      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should require authentication', async () => {
      mockRequest.user = undefined

      await expect(requireReferral(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      )).rejects.toThrow('Authentication required')

      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should handle user not found', async () => {
      mockUserService.getUserByWalletAddress.mockResolvedValue(null)

      await expect(requireReferral(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      )).rejects.toThrow('User not found')

      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      const error = new Error('Database error')
      mockUserService.getUserByWalletAddress.mockRejectedValue(error)

      await expect(requireReferral(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      )).rejects.toThrow(error)

      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('requireReferralForReferralAction', () => {
    it('should allow referred users to perform referral actions', async () => {
      mockUserService.getUserByWalletAddress.mockResolvedValue({
        _id: new ObjectId(),
        walletAddress: 'bc1qtest123',
        referredBy: new ObjectId()
      })

      await expect(checkReferral('bc1qtest123')).resolves.toEqual(undefined)
    })

    it('should block unreferred users from referral actions', async () => {
      mockUserService.getUserByWalletAddress.mockResolvedValue({
        _id: new ObjectId(),
        walletAddress: 'bc1qtest123',
        referredBy: null
      })

      await expect(checkReferral('bc1qtest123')).rejects.toThrow('Access denied: You must be referred by another user to perform this action. Please enter a referral code first')
    })

    it('should handle user not found', async () => {
      mockUserService.getUserByWalletAddress.mockResolvedValue(null)

      await expect(checkReferral('bc1qtest123')).rejects.toThrow('User not found')
    })

    it('should handle errors gracefully', async () => {
      const error = new Error('Database error')
      mockUserService.getUserByWalletAddress.mockRejectedValue(error)

      await expect(checkReferral('bc1qtest123')).rejects.toThrow(error)
    })
  })
})
