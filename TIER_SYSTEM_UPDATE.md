# Tier System Update: Total Points vs Referral Points

## Change Summary

**Before**: Tiers were calculated based only on `pointsEarnedFromReferrals`
**After**: Tiers are now calculated based on total `points` (all points combined)

## Impact

### User Experience Improvement
- Users now progress through tiers based on ALL their activity
- Mint points (earned from own minting) now contribute to tier progression
- Much more intuitive and user-friendly system

### Example
A user with:
- 2010 total points
- 0 referral points

**Before**: Common tier (based on 0 referral points)
**After**: Uncommon tier (based on 2010 total points) ✅

## Files Modified

1. **`src/services/referralService.ts`**
   - `getReferralInfo()` method now uses `user.points` for tier calculation
   
2. **`src/routes/pointsRoutes.ts`**
   - `/user/:walletAddress` endpoint now uses `user.points` for tier calculation
   
3. **`src/services/PointsService.ts`**
   - `awardMintPoints()` now uses `user.points` for tier bonus calculation
   - `addReferralPoints()` now uses `user.points` for tier bonus calculation

## Tier Thresholds (Unchanged)

- **Common**: 0+ points (1.0x bonus)
- **Uncommon**: 1000+ points (1.2x bonus) 
- **Rare**: 5000+ points (1.5x bonus)
- **Epic**: 20000+ points (2.0x bonus)
- **Legendary**: 50000+ points (2.5x bonus)

## Point Types Still Tracked Separately

- `points` - Total points from all sources (used for tiers)
- `pointsEarnedFromReferrals` - Referral-specific points (tracked for analytics)

Both values are still returned in API responses for transparency.

## Testing

After this change, users should immediately see their correct tier based on total points:

```bash
# Check user tier after update
GET /api/referral/account/{walletAddress}
```

Expected result for user with 2010 total points:
```json
{
  "tier": {
    "level": "Uncommon",
    "bonus": 1.2,
    "threshold": 1000,
    "rank": 2
  }
}
``` 
