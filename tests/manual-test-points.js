// Manual Testing Script for Referral Points System
// Run this script to test the complete flow manually
// Usage: node tests/manual-test-points.js

const API_BASE = 'http://localhost:8080/api'

// Test wallet addresses (use your own test addresses)
const REFERRER_WALLET = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
const TRADER_WALLET = 'bc1qr508d6qejxtdg4y5r3zarvary0c5xw7kd9jm96'

async function testReferralPointsFlow() {
  console.log('🧪 Testing Referral Points System\n')

  try {
    // 1. Create users
    console.log('1. Creating users...')
    const referrerResponse = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: REFERRER_WALLET })
    })
    const referrer = await referrerResponse.json()
    console.log('✓ Referrer created:', referrer.data.walletAddress)
    console.log('✓ Referral code:', referrer.data.referralCode || 'Generated automatically')

    const traderResponse = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: TRADER_WALLET })
    })
    const trader = await traderResponse.json()
    console.log('✓ Trader created:', trader.data.walletAddress)

    // 2. Get referrer's referral info
    console.log('\n2. Getting referrer\'s initial info...')
    const referrerInfoResponse = await fetch(`${API_BASE}/referral/account/${REFERRER_WALLET}`)
    const referrerInfo = await referrerInfoResponse.json()
    console.log('✓ Referral code:', referrerInfo.data.referralCode)
    console.log('✓ Initial points:', referrerInfo.data.points)
    console.log('✓ Initial referral points:', referrerInfo.data.pointsEarnedFromReferrals)

    // 3. Trader enters referral code
    console.log('\n3. Trader entering referral code...')
    const referralCodeResponse = await fetch(`${API_BASE}/referral/enter-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: TRADER_WALLET,
        referralCode: referrerInfo.data.referralCode
      })
    })
    const referralResult = await referralCodeResponse.json()
    console.log('✓ Referral code result:', referralResult.message)

    // 4. Simulate mint transaction (this is where points get awarded)
    console.log('\n4. Simulating mint transaction...')
    console.log('📝 In real app, trader would call:')
    console.log(`   GET ${API_BASE}/tx?paymentAddress=${TRADER_WALLET}&mintCount=5&...`)
    console.log('   This would automatically award 5 points to the referrer!')

    // 5. Check points balance
    console.log('\n5. Checking points balance...')
    const pointsResponse = await fetch(`${API_BASE}/points/balance/${REFERRER_WALLET}`)
    const pointsData = await pointsResponse.json()
    console.log('✓ Referrer points balance:', pointsData.data.points)

    // 6. Check updated referral info
    console.log('\n6. Checking updated referral info...')
    const updatedInfoResponse = await fetch(`${API_BASE}/referral/account/${REFERRER_WALLET}`)
    const updatedInfo = await updatedInfoResponse.json()
    console.log('✓ Total referrals:', updatedInfo.data.totalReferrals)
    console.log('✓ Total points:', updatedInfo.data.points)
    console.log('✓ Points from referrals:', updatedInfo.data.pointsEarnedFromReferrals)

    console.log('\n🎉 Manual test completed successfully!')
    console.log('\nTo test with real minting:')
    console.log('1. Use the trader wallet to create a mint transaction')
    console.log('2. Points will be automatically awarded to the referrer')
    console.log('3. Check the referral endpoints to see updated points')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
if (require.main === module) {
  testReferralPointsFlow()
}

module.exports = { testReferralPointsFlow } 
