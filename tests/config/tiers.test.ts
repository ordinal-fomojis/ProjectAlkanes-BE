import { describe, expect, it } from "vitest"
import { calculateBonusPoints, getNextTier, getTierByPoints, TIER_SYSTEM } from "../../src/config/tiers.js"

describe('Tier System', () => {
  it('should have correct tier configuration', () => {
    expect(TIER_SYSTEM).toHaveLength(5)
    
    // Verify tier structure
    expect(TIER_SYSTEM[0]!).toEqual({
      level: 'Common',
      bonus: 1.0,
      threshold: 0,
      rank: 1
    })
    
    expect(TIER_SYSTEM[1]!).toEqual({
      level: 'Uncommon',
      bonus: 1.2,
      threshold: 10000,
      rank: 2
    })
    
    expect(TIER_SYSTEM[4]!).toEqual({
      level: 'Legendary',
      bonus: 2.5,
      threshold: 500000,
      rank: 5
    })
  })

  it('should correctly determine tier by points', () => {
    // Common tier (0 points)
    expect(getTierByPoints(0)).toEqual(TIER_SYSTEM[0]!)
    expect(getTierByPoints(5000)).toEqual(TIER_SYSTEM[0]!)
    expect(getTierByPoints(9999)).toEqual(TIER_SYSTEM[0]!)
    
    // Uncommon tier (10000+ points)
    expect(getTierByPoints(10000)).toEqual(TIER_SYSTEM[1]!)
    expect(getTierByPoints(25000)).toEqual(TIER_SYSTEM[1]!)
    expect(getTierByPoints(49999)).toEqual(TIER_SYSTEM[1]!)
    
    // Rare tier (50000+ points)
    expect(getTierByPoints(50000)).toEqual(TIER_SYSTEM[2]!)
    expect(getTierByPoints(150000)).toEqual(TIER_SYSTEM[2]!)
    
    // Epic tier (200000+ points)
    expect(getTierByPoints(200000)).toEqual(TIER_SYSTEM[3]!)
    expect(getTierByPoints(400000)).toEqual(TIER_SYSTEM[3]!)
    
    // Legendary tier (500000+ points)
    expect(getTierByPoints(500000)).toEqual(TIER_SYSTEM[4]!)
    expect(getTierByPoints(1000000)).toEqual(TIER_SYSTEM[4]!)
  })

  it('should correctly determine next tier', () => {
    // Common -> Uncommon
    const commonTier = TIER_SYSTEM[0]!
    expect(getNextTier(commonTier)).toEqual(TIER_SYSTEM[1]!)
    
    // Uncommon -> Rare
    const uncommonTier = TIER_SYSTEM[1]!
    expect(getNextTier(uncommonTier)).toEqual(TIER_SYSTEM[2]!)
    
    // Legendary has no next tier
    const legendaryTier = TIER_SYSTEM[4]!
    expect(getNextTier(legendaryTier)).toBeNull()
  })

  it('should correctly calculate bonus points', () => {
    // Common tier - no bonus
    expect(calculateBonusPoints(10, TIER_SYSTEM[0]!)).toBe(10) // 10 * 1.0 = 10
    
    // Uncommon tier - 20% bonus
    expect(calculateBonusPoints(10, TIER_SYSTEM[1]!)).toBe(12) // 10 * 1.2 = 12
    
    // Rare tier - 50% bonus
    expect(calculateBonusPoints(10, TIER_SYSTEM[2]!)).toBe(15) // 10 * 1.5 = 15
    
    // Epic tier - 100% bonus
    expect(calculateBonusPoints(10, TIER_SYSTEM[3]!)).toBe(20) // 10 * 2.0 = 20
    
    // Legendary tier - 150% bonus
    expect(calculateBonusPoints(10, TIER_SYSTEM[4]!)).toBe(25) // 10 * 2.5 = 25
    
    // Test with fractional results (should floor)
    expect(calculateBonusPoints(3, TIER_SYSTEM[1]!)).toBe(3) // 3 * 1.2 = 3.6 -> 3
    expect(calculateBonusPoints(7, TIER_SYSTEM[1]!)).toBe(8) // 7 * 1.2 = 8.4 -> 8
  })

  it('should handle edge cases', () => {
    // Negative points should default to Common
    expect(getTierByPoints(-100)).toEqual(TIER_SYSTEM[0]!)
    
    // Very high points should be Legendary
    expect(getTierByPoints(999999)).toEqual(TIER_SYSTEM[4]!)
    
    // Zero base points should give zero bonus
    expect(calculateBonusPoints(0, TIER_SYSTEM[4]!)).toBe(0)
  })

  it('should have tiers ordered by threshold', () => {
    for (let i = 1; i < TIER_SYSTEM.length; i++) {
      expect(TIER_SYSTEM[i]!.threshold).toBeGreaterThan(TIER_SYSTEM[i - 1]!.threshold)
      expect(TIER_SYSTEM[i]!.rank).toBeGreaterThan(TIER_SYSTEM[i - 1]!.rank)
      expect(TIER_SYSTEM[i]!.bonus).toBeGreaterThanOrEqual(TIER_SYSTEM[i - 1]!.bonus)
    }
  })
}) 
