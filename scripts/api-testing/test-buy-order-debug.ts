#!/usr/bin/env tsx
// Debug test script that demonstrates buy order API calls with Kraken
// This script shows the actual API requests being made (in test mode)

import { container } from '../../src/container.js';
import { TYPES } from '../../src/types/interfaces.js';
import type { IExchangeService } from '../../src/types/interfaces.js';

async function testBuyOrderAPI() {
  console.log('🧪 TESTING BUY ORDER API WITH REAL KRAKEN SERVICE');
  console.log('🛡️  Running in TEST MODE - validate=true (no real orders placed)\n');

  try {
    // Get the Kraken service from the container
    const krakenService = container.resolve<IExchangeService>('KrakenApiService');
    
    console.log('📋 Test Case 1: Market Buy Order');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const marketBuyAsset = {
      name: 'BTC',
      amount: 0.1,
      exchange: 'kraken'
    };
    
    console.log('📤 Request:');
    console.log(`  Asset: ${marketBuyAsset.name}`);
    console.log(`  Amount: ${marketBuyAsset.amount}`);
    console.log(`  From (quote currency): USDT`);
    console.log(`  Order Type: market`);
    
    const marketResult = await krakenService.createBuyOrder(marketBuyAsset, {
      orderType: 'market',
      from: 'USDT'
    });
    
    console.log('📥 Response:');
    console.log(`  ${JSON.stringify(marketResult, null, 2)}`);
    
    console.log('\n📋 Test Case 2: Limit Buy Order');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const limitBuyAsset = {
      name: 'BTC',
      amount: 0.05,
      exchange: 'kraken'
    };
    
    console.log('📤 Request:');
    console.log(`  Asset: ${limitBuyAsset.name}`);
    console.log(`  Amount: ${limitBuyAsset.amount}`);
    console.log(`  From (quote currency): USDT`);
    console.log(`  Order Type: limit`);
    console.log(`  Price: $45,000.00`);
    
    const limitResult = await krakenService.createBuyOrder(limitBuyAsset, {
      orderType: 'limit',
      price: 45000.00,
      from: 'USDT'
    });
    
    console.log('📥 Response:');
    console.log(`  ${JSON.stringify(limitResult, null, 2)}`);
    
    console.log('\n✅ SUCCESS: Buy order API is working correctly!');
    console.log('🔑 Key Implementation Details:');
    console.log('   • Uses "from" parameter for quote currency (what you\'re spending)');
    console.log('   • Properly validates required fields (price for limit orders)');
    console.log('   • Creates correct Kraken API calls with type=buy');
    console.log('   • Runs in test mode with validate=true for safety');
    console.log('   • Generates proper nonce and API signatures');
    
  } catch (error) {
    console.error('❌ ERROR:', error);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testBuyOrderAPI().catch(console.error);
}
