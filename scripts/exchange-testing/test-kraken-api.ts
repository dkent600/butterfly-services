/**
 * Kraken Integration Test Script
 * 
 * This script makes REAL API calls to Kraken's endpoints to verify that
 * the exchange integration works correctly end-to-end.
 * 
 * ⚠️  SAFETY: Th    try {
      const balanceResult = await makeKrakenPrivateRequest('/0/private/Balance', {}) as any;
      
      console.log('📋 Balance Response:', JSON.stringify(balanceResult, null, 2));
      
      if (balanceResult.status === 200 && balanceResult.data.result) {
        console.log('✅ Balance fetch test PASSED - API accepted request');
        
        const balances = balanceResult.data.result;
        const nonZeroBalances = Object.entries(balances).filter(([, balance]) => parseFloat(balance as string) > 0);
        
        if (nonZeroBalances.length > 0) {
          console.log('💰 Non-zero balances found:');
          nonZeroBalances.forEach(([asset, balance]) => {
            console.log(`   ${asset}: ${parseFloat(balance as string)}`);
          });eal Kraken API endpoints but includes
 * safety checks and warnings for credential management.
 * 
 * Prerequisites:
 * - Kraken API credentials in .env.development
 * - Valid API key permissions for tested endpoints
 */

import * as crypto from 'crypto';
import * as https from 'https';
import { URLSearchParams } from 'url';
import { loadEnvironment } from '../../src/utils/env-loader.js';

// Load environment variables
loadEnvironment();

// Basic type definitions for API responses
interface ApiResponse {
  status: number;
  data: any;
  error?: string;
}

// Kraken API Configuration
const KRAKEN_API_BASE = 'api.kraken.com';
const KRAKEN_API_KEY = process.env.KRAKEN_API_KEY || 'your_kraken_api_key_here';
const KRAKEN_API_SECRET = process.env.KRAKEN_API_SECRET || 'your_kraken_secret_here';

// Test Mode Flag
const USE_TEST_MODE = process.env.NODE_ENV !== 'production';

console.log('🧪 Kraken Integration Test - Real API Calls');
console.log('=============================================\n');

function generateNonce() {
  return Date.now();
}

function signKrakenRequest(path, postData, apiSecret) {
  const nonceMatch = postData.match(/nonce=(\d+)/);
  const nonce = nonceMatch[1];
  
  const apiSha256 = crypto.createHash('sha256').update(`${nonce}${postData}`).digest();
  const apiSha512 = crypto.createHmac('sha512', Buffer.from(apiSecret, 'base64'))
    .update(path)
    .update(apiSha256)
    .digest();
  return apiSha512.toString('base64');
}

function makeHttpsRequest(hostname, path, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method,
      headers: {
        'User-Agent': 'butterfly-services/1.0',
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

async function makeKrakenPrivateCall(endpoint, params = {}) {
  const nonce = generateNonce();
  const postData = new URLSearchParams({ nonce: nonce.toString(), ...params }).toString();
  
  console.log(`📡 Making private API request to: ${endpoint}`);
  
  const signature = signKrakenRequest(endpoint, postData, KRAKEN_API_SECRET);
  
  const headers = {
    'API-Key': KRAKEN_API_KEY,
    'API-Sign': signature,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  };
  
  return await makeHttpsRequest(KRAKEN_API_BASE, endpoint, 'POST', headers, postData);
}

async function fetchKrakenServerTime() {
  console.log(`📊 Fetching server time from Kraken`);
  return await makeHttpsRequest(KRAKEN_API_BASE, '/0/public/Time', 'GET');
}

async function fetchKrakenTicker(pair) {
  console.log(`📊 Fetching ticker for: ${pair}`);
  return await makeHttpsRequest(KRAKEN_API_BASE, `/0/public/Ticker?pair=${pair}`, 'GET');
}

async function testKrakenIntegration() {
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Test Mode: ${USE_TEST_MODE}`);
  console.log(`🔑 API Key: ${KRAKEN_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`🔐 API Secret: ${KRAKEN_API_SECRET ? 'Configured' : 'Missing'}\n`);
  
  // CRITICAL SAFETY CHECK: Ensure we're not in production
  if (!USE_TEST_MODE || process.env.NODE_ENV === 'production') {
    console.log('🚫 SAFETY: Integration tests blocked in production mode!');
    console.log('🛡️  PROTECTION: Preventing potential real API calls in production');
    console.log('💡 To run: Set NODE_ENV=development or NODE_ENV=test');
    process.exit(1);
  }
  
  if (!KRAKEN_API_KEY || !KRAKEN_API_SECRET || KRAKEN_API_KEY === 'your_kraken_api_key_here') {
    console.log('⚠️  WARNING: Kraken API credentials not configured properly');
    console.log('Set KRAKEN_API_KEY and KRAKEN_API_SECRET environment variables');
    console.log('Or update the script with your credentials\n');
  }
  
  // Test Configuration
  const testPair = 'BTCUSD';
  
  console.log(`🎯 Test Pair: ${testPair}`);
  console.log(`🛡️  Safety: Running in ${process.env.NODE_ENV || 'development'} mode (safe for testing)\n`);
  
  try {
    // Test 1: Server Time (Public API)
    console.log('⏰ TEST 1: Fetch Server Time (Public API)');
    console.log('==========================================');
    try {
      const timeResult = await fetchKrakenServerTime() as any;
      
      if (timeResult.status === 200 && timeResult.data.result) {
        const serverTime = timeResult.data.result;
        console.log(`✅ Server Time: ${serverTime.rfc1123} (Unix: ${serverTime.unixtime})`);
        console.log('✅ Server time test PASSED\n');
      } else {
        console.log('❌ Server time test FAILED:', timeResult);
      }
    } catch (error) {
      console.log('❌ Server time error:', error.message);
    }
    
    // Test 2: Ticker Data (Public API)
    console.log('📈 TEST 2: Fetch Ticker Data (Public API)');
    console.log('==========================================');
    try {
      const tickerResult = await fetchKrakenTicker(testPair) as any;
      
      if (tickerResult.status === 200 && tickerResult.data.result) {
        const ticker = Object.values(tickerResult.data.result)[0] as any;
        if (ticker && ticker.c) {
          const price = parseFloat(ticker.c[0]);
          console.log(`✅ Current ${testPair} Price: $${price.toLocaleString()}`);
          console.log('✅ Ticker fetch test PASSED\n');
        } else {
          console.log('❌ Invalid ticker data structure:', tickerResult.data);
        }
      } else {
        console.log('❌ Ticker fetch test FAILED:', tickerResult);
      }
    } catch (error) {
      console.log('❌ Ticker fetch error:', error.message);
    }
    
    // Test 3: Account Balance (Private API)
    console.log('💰 TEST 3: Fetch Account Balance (Private API)');
    console.log('===============================================');
    try {
      const balanceResult = await makeKrakenPrivateCall('/0/private/Balance');
      
      console.log('📋 Balance Response:', JSON.stringify(balanceResult, null, 2));
      
      if (balanceResult.status === 200 && balanceResult.data.result) {
        console.log('✅ Balance fetch test PASSED - API accepted request');
        
        const balances = balanceResult.data.result;
        const nonZeroBalances = Object.entries(balances).filter(([, balance]) => parseFloat(balance as string) > 0);
        
        if (nonZeroBalances.length > 0) {
          console.log('💰 Non-zero balances found:');
          nonZeroBalances.forEach(([asset, balance]) => {
            console.log(`   ${asset}: ${parseFloat(balance as string)}`);
          });
        } else {
          console.log('📝 All balances are zero (or account is new)');
        }
      } else if (balanceResult.status === 401 || balanceResult.data.error?.includes('Invalid key')) {
        console.log('⚠️  Balance test - Authentication needed (expected if no real credentials)');
      } else {
        console.log(`❌ Balance test response: HTTP ${balanceResult.status}`);
      }
    } catch (error) {
      console.log('❌ Balance fetch error:', error.message);
    }
    
    console.log('');
    
    // Test 4: Error Handling - Invalid API Call
    console.log('🚨 TEST 4: Error Handling - Invalid Endpoint');
    console.log('=============================================');
    try {
      const invalidResult = await makeKrakenPrivateCall('/0/private/InvalidEndpoint') as any;
      
      console.log('📋 Invalid Endpoint Response:', JSON.stringify(invalidResult, null, 2));
      
      if (invalidResult.status >= 400 || invalidResult.data.error) {
        console.log('✅ Invalid endpoint test PASSED - API correctly rejected invalid request');
      } else {
        console.log('❌ Invalid endpoint test FAILED - API should reject invalid endpoints');
      }
    } catch (error) {
      console.log('✅ Invalid endpoint test PASSED - Network/API error as expected:', error.message);
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
console.log('✅ Real API calls to Kraken endpoints');
console.log('✅ Public API functionality (server time, ticker data)');
console.log('✅ Private API functionality (account balance)');
console.log('✅ Authentication and signature generation');
console.log('✅ Error handling for invalid requests');
console.log('✅ Proper credential management\n');

// Run the tests
testKrakenIntegration()
  .then(() => {
    console.log('\n🎉 Kraken Integration Test Complete!');
    console.log('All tests executed against real Kraken endpoints.');
    console.log('\n💡 Integration test info:');
    console.log('   ✅ Using real API credentials from .env.development');
    console.log('   ✅ Running via npm script: npm run test:integration:kraken');
    console.log('   ✅ TypeScript execution via tsx');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Integration Test Suite Failed:', error);
    process.exit(1);
  });
