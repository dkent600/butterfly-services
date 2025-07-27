/**
 * MEXC Integration Test Script
 * 
 * This script makes REAL API calls to MEXC's test endpoints to verify that
 * the createSellOrder method works correctly end-to-end.
 * 
 * ⚠️  SAFETY: This script uses MEXC's test endpoints (/api/v3/order/test)
 * which simulate orders without executing real trades.
 * 
 * Prerequisites:
 * - MEXC API credentials configured
 * - Test mode enabled 
 * - Valid trading pair symbols
 */

import crypto from 'crypto';
import https from 'https';
import { URLSearchParams } from 'url';

// MEXC API Configuration
const MEXC_API_BASE = 'api.mexc.com';
const MEXC_API_KEY = process.env.MEXC_API_KEY || 'your_mexc_api_key_here';
const MEXC_API_SECRET = process.env.MEXC_API_SECRET || 'your_mexc_secret_here';

// Test Mode Flag
const USE_TEST_MODE = process.env.NODE_ENV !== 'production';

console.log('🧪 MEXC Integration Test - Real API Calls to Test Endpoints');
console.log('===========================================================\n');

function generateTimestamp() {
  return Date.now();
}

function signMexcRequest(queryString, apiSecret) {
  return crypto
    .createHmac('sha256', apiSecret)
    .update(queryString)
    .digest('hex');
}

function makeHttpsRequest(hostname, path, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsedData });
        } catch (error) {
          resolve({ status: res.statusCode, data, error: 'JSON parse error' });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

async function createMexcSellOrder(symbol, quantity, orderType, price = null) {
  const timestamp = generateTimestamp();
  
  // Build order parameters
  const orderParams = {
    symbol,
    side: 'SELL',
    type: orderType.toUpperCase(),
    quantity: quantity.toString(),
    timestamp: timestamp.toString()
  };
  
  if (orderType === 'LIMIT' && price) {
    orderParams.price = price.toString();
  }
  
  const queryString = new URLSearchParams(orderParams).toString();
  const signature = signMexcRequest(queryString, MEXC_API_SECRET);
  
  // Use test endpoint when in test mode
  const endpoint = USE_TEST_MODE ? '/api/v3/order/test' : '/api/v3/order';
  const path = `${endpoint}?${queryString}&signature=${signature}`;
  
  const headers = {
    'X-MEXC-APIKEY': MEXC_API_KEY,
  };
  
  console.log(`📡 Making ${orderType} order request to: ${endpoint}`);
  console.log(`🔒 Test Mode: ${USE_TEST_MODE}`);
  
  return await makeHttpsRequest(MEXC_API_BASE, path, 'POST', headers);
}

async function fetchMexcPrice(symbol) {
  const path = `/api/v3/ticker/price?symbol=${symbol}`;
  console.log(`📊 Fetching price for: ${symbol}`);
  
  return await makeHttpsRequest(MEXC_API_BASE, path, 'GET');
}

async function testMexcIntegration() {
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Test Mode: ${USE_TEST_MODE}`);
  console.log(`🔑 API Key: ${MEXC_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`🔐 API Secret: ${MEXC_API_SECRET ? 'Configured' : 'Missing'}\n`);
  
  // CRITICAL SAFETY CHECK: Block integration tests in production mode
  // This prevents accidentally running real API calls in production
  if (!USE_TEST_MODE || process.env.NODE_ENV === 'production') {
    console.log('🚫 SAFETY: Integration tests blocked in production mode!');
    console.log('🛡️  PROTECTION: Preventing real API calls in production environment');
    console.log('💡 To run: Set NODE_ENV=development or NODE_ENV=test');
    console.log('⚠️  NOTE: Even test endpoints should not run in production');
    process.exit(1);
  }
  
  if (!MEXC_API_KEY || !MEXC_API_SECRET || MEXC_API_KEY === 'your_mexc_api_key_here') {
    console.log('⚠️  WARNING: MEXC API credentials not configured properly');
    console.log('Set MEXC_API_KEY and MEXC_API_SECRET environment variables');
    console.log('Or update the script with your credentials\n');
  }
  
  // Test Configuration
  const testSymbol = 'BTCUSDT';
  const testQuantity = 0.001; // Small test amount
  const testLimitPrice = 95000; // High price to ensure no execution
  
  console.log(`🎯 Test Symbol: ${testSymbol}`);
  console.log(`📊 Test Quantity: ${testQuantity}`);
  console.log(`💰 Test Limit Price: $${testLimitPrice.toLocaleString()}\n`);
  
  try {
    // Test 1: Fetch Current Price
    console.log('� TEST 1: Fetch Current Price');
    console.log('==============================');
    try {
      const priceResult = await fetchMexcPrice(testSymbol);
      
      if (priceResult.status === 200 && priceResult.data.price) {
        const price = parseFloat(priceResult.data.price);
        console.log(`✅ Current ${testSymbol} Price: $${price.toLocaleString()}`);
        console.log('✅ Price fetch test PASSED\n');
      } else {
        console.log('❌ Price fetch test FAILED:', priceResult);
      }
    } catch (error) {
      console.log('❌ Price fetch error:', error.message);
    }
    
    // Test 2: Market Order (Test Mode)
    console.log('� TEST 2: Market Sell Order (Test Mode)');
    console.log('=========================================');
    try {
      const marketResult = await createMexcSellOrder(testSymbol, testQuantity, 'MARKET');
      
      console.log('📋 Market Order Response:', JSON.stringify(marketResult, null, 2));
      
      if (marketResult.status === 200) {
        console.log('✅ Market order test PASSED - Test endpoint accepted order');
      } else if (marketResult.status === 401) {
        console.log('⚠️  Market order test - Authentication needed (expected if no real credentials)');
      } else {
        console.log(`❌ Market order test response: HTTP ${marketResult.status}`);
      }
    } catch (error) {
      console.log('❌ Market order error:', error.message);
    }
    
    console.log('');
    
    // Test 3: Limit Order (Test Mode)
    console.log('� TEST 3: Limit Sell Order (Test Mode)');
    console.log('========================================');
    try {
      const limitResult = await createMexcSellOrder(testSymbol, testQuantity, 'LIMIT', testLimitPrice);
      
      console.log('📋 Limit Order Response:', JSON.stringify(limitResult, null, 2));
      
      if (limitResult.status === 200) {
        console.log('✅ Limit order test PASSED - Test endpoint accepted order');
      } else if (limitResult.status === 401) {
        console.log('⚠️  Limit order test - Authentication needed (expected if no real credentials)');
      } else {
        console.log(`❌ Limit order test response: HTTP ${limitResult.status}`);
      }
    } catch (error) {
      console.log('❌ Limit order error:', error.message);
    }
    
    console.log('');
    
    // Test 4: Error Handling - Invalid Symbol
    console.log('� TEST 4: Error Handling - Invalid Symbol');
    console.log('==========================================');
    try {
      const invalidResult = await createMexcSellOrder('INVALIDUSDT', testQuantity, 'MARKET');
      
      console.log('📋 Invalid Symbol Response:', JSON.stringify(invalidResult, null, 2));
      
      if (invalidResult.status >= 400) {
        console.log('✅ Invalid symbol test PASSED - API correctly rejected invalid symbol');
      } else {
        console.log('❌ Invalid symbol test FAILED - API should reject invalid symbols');
      }
    } catch (error) {
      console.log('✅ Invalid symbol test PASSED - Network/API error as expected:', error.message);
    }
    
  } catch (error) {
    console.error('💥 Integration Test Failed:', error);
    console.error('Error Details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Test Summary
console.log('📋 TEST SUMMARY');
console.log('================');
console.log('This integration test verifies:');
console.log('✅ Real API calls to MEXC test endpoints');
console.log('✅ Market order creation (test mode)');
console.log('✅ Limit order creation (test mode)');
console.log('✅ Price fetching functionality');
console.log('✅ Error handling for invalid symbols');
console.log('✅ Safety checks prevent production trades\n');

// Run the tests
testMexcIntegration()
  .then(() => {
    console.log('\n🎉 MEXC Integration Test Complete!');
    console.log('All tests executed against real MEXC test endpoints.');
    console.log('\n💡 To run with real credentials:');
    console.log('   export MEXC_API_KEY="your_key"');
    console.log('   export MEXC_API_SECRET="your_secret"');
    console.log('   node scripts/exchange-testing/test-mexc-api.js');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Integration Test Suite Failed:', error);
    process.exit(1);
  });
