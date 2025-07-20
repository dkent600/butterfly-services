import { KrakenApiService } from './dist/services/kraken-api-service.js';
import { container } from './dist/container.js';

// Test the new pair creation logic
async function testPairCreation() {
  console.log('Testing new pair creation logic...\n');
  
  const krakenService = container.resolve(KrakenApiService);
  
  const testAssets = [
    { name: 'SOL', amount: 1, exchange: 'kraken' },
    { name: 'ADA', amount: 1, exchange: 'kraken' },
    { name: 'SHIB', amount: 1, exchange: 'kraken' },
    { name: 'DOGE', amount: 1, exchange: 'kraken' },
    { name: 'BTC', amount: 1, exchange: 'kraken' },
    { name: 'ETH', amount: 1, exchange: 'kraken' },
  ];
  
  for (const asset of testAssets) {
    const pair = krakenService.createPair(asset, 'USD');
    console.log(`${asset.name}/USD -> ${pair}`);
  }
}

testPairCreation().catch(console.error);
