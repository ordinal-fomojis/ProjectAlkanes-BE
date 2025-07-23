# Referral Gate Implementation

## Overview

The referral gate prevents users from minting tokens or creating referral links unless they have been referred by another user. This creates a viral growth mechanism where only referred users can participate in the system.

## How It Works

### 1. Minting Restrictions
- Users must be referred before they can mint tokens
- Both `GET /api/transactions` and `POST /api/transactions` routes require referral
- Enforced via the `requireReferral` middleware

### 2. Referral Action Restrictions  
- Users must be referred before they can create custom referral links
- The `POST /api/referral/create-custom-link` route checks referral status
- New users can still enter referral codes via `POST /api/referral/enter-code`

### 3. Bootstrap System
- **Bootstrap Referral Code**: `BOOTSTRAP`
- Allows the first users to join the system without needing an existing referrer
- Creates a virtual referrer (ObjectId: `000000000000000000000001`)

## API Changes

### Transaction Routes
- `GET /api/transactions` - Now requires referral ❌ (403 if not referred)
- `POST /api/transactions` - Now requires referral ❌ (403 if not referred)

### Referral Routes
- `GET /api/referral/account/:walletAddress` - No change ✅
- `POST /api/referral/enter-code` - No change ✅ (users need this to get referred)
- `POST /api/referral/create-custom-link` - Now requires referral ❌ (403 if not referred)

## Usage Flow

### For First Users (Bootstrap)
1. User creates account: `POST /api/users`
2. User enters bootstrap code: `POST /api/referral/enter-code` with `{ "referralCode": "BOOTSTRAP" }`
3. User can now mint and refer others

### For Regular Users
1. User creates account: `POST /api/users`
2. User gets referral code from existing user
3. User enters referral code: `POST /api/referral/enter-code`
4. User can now mint and refer others

## Error Responses

When a non-referred user tries to perform restricted actions:

```json
{
  "success": false,
  "message": "Access denied: You must be referred by another user to perform this action. Please enter a referral code first.",
  "code": "REFERRAL_REQUIRED"
}
```

## Implementation Details

### Files Modified
- `src/middleware/referralGate.ts` - New middleware for referral checks
- `src/routes/transactionRoutes.ts` - Added referral gate to minting
- `src/routes/referralRoutes.ts` - Added referral gate to custom link creation
- `src/services/referralService.ts` - Added bootstrap referral code support

### Minimal Changes Approach
- Uses existing `referredBy` field in User model
- No database schema changes required
- Middleware approach allows easy enable/disable
- Bootstrap system solves the "first user" problem

## Configuration

The bootstrap referral code is currently hardcoded as `'BOOTSTRAP'`. This can be made configurable via environment variables if needed.

## Testing

The referral gate can be tested by:

1. Creating a new user
2. Trying to mint without referral (should fail)
3. Entering bootstrap code
4. Trying to mint again (should succeed) 
