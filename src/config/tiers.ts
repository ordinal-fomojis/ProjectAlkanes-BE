export interface TierConfig {
  level: string;
  bonus: number;     // Multiplier for points earned
  threshold: number; // Points required to reach this tier
  rank: number;      // Numerical rank for easy comparison
}

export const TIER_SYSTEM: TierConfig[] = [
  {
    level: 'Common',
    bonus: 1.0,      // No bonus
    threshold: 0,    // Starting tier
    rank: 1
  },
  {
    level: 'Uncommon',
    bonus: 1.2,      // 20% bonus
    threshold: 10000, 
    rank: 2
  },
  {
    level: 'Rare',
    bonus: 1.5,      // 50% bonus
    threshold: 50000,
    rank: 3
  },
  {
    level: 'Epic',
    bonus: 2.0,      // 100% bonus
    threshold: 200000,
    rank: 4
  },
  {
    level: 'Legendary',
    bonus: 2.5,      // 150% bonus
    threshold: 500000,
    rank: 5
  }
];

/**
 * Get tier based on total points earned from referrals
 */
export function getTierByPoints(pointsEarnedFromReferrals: number): TierConfig {
  // Find the highest tier the user qualifies for
  let currentTier = TIER_SYSTEM[0]!; // Default to Common (guaranteed to exist)
  
  for (const tier of TIER_SYSTEM) {
    if (pointsEarnedFromReferrals >= tier.threshold) {
      currentTier = tier;
    } else {
      break; // Tiers are ordered by threshold, so we can stop here
    }
  }
  
  return currentTier;
}

/**
 * Get next tier info for progression display
 */
export function getNextTier(currentTier: TierConfig): TierConfig | null {
  const currentIndex = TIER_SYSTEM.findIndex(tier => tier.rank === currentTier.rank);
  const nextIndex = currentIndex + 1;
  
  return nextIndex < TIER_SYSTEM.length ? TIER_SYSTEM[nextIndex]! : null;
}

/**
 * Calculate points with tier bonus applied
 */
export function calculateBonusPoints(basePoints: number, tier: TierConfig): number {
  return Math.floor(basePoints * tier.bonus);
} 
