import axios from 'axios';

// Test what trading pairs are being requested vs what's available
async function testKrakenPairs() {
  const assets = ['DOGE', 'SOL', 'ADA', 'SHIB'];
  
  console.log('Testing Kraken trading pairs for USD...\n');
  
  for (const asset of assets) {
    // Map asset to Kraken format (like our service does)
    let krakenAsset = asset;
    if (asset === 'DOGE') krakenAsset = 'XXDG';
    
    const pair = krakenAsset + 'ZUSD';
    console.log(`${asset} -> Trying pair: ${pair}`);
    
    try {
      const { data } = await axios.get('https://api.kraken.com/0/public/Ticker', {
        params: { pair },
      });
      
      if (data.result && Object.keys(data.result).length > 0) {
        console.log(`✅ ${pair} - SUCCESS`);
        console.log(`   Available keys: ${Object.keys(data.result).join(', ')}\n`);
      } else {
        console.log(`❌ ${pair} - No data\n`);
      }
    } catch (error) {
      console.log(`❌ ${pair} - ERROR: ${error.response?.data?.error?.[0] || error.message}\n`);
    }
  }
  
  // Also try with USDT instead of USD
  console.log('\nTesting with USDT instead...\n');
  
  for (const asset of assets) {
    let krakenAsset = asset;
    if (asset === 'DOGE') krakenAsset = 'XXDG';
    
    const pair = krakenAsset + 'USDT';
    console.log(`${asset} -> Trying pair: ${pair}`);
    
    try {
      const { data } = await axios.get('https://api.kraken.com/0/public/Ticker', {
        params: { pair },
      });
      
      if (data.result && Object.keys(data.result).length > 0) {
        console.log(`✅ ${pair} - SUCCESS`);
        console.log(`   Available keys: ${Object.keys(data.result).join(', ')}\n`);
      } else {
        console.log(`❌ ${pair} - No data\n`);
      }
    } catch (error) {
      console.log(`❌ ${pair} - ERROR: ${error.response?.data?.error?.[0] || error.message}\n`);
    }
  }
}

testKrakenPairs().catch(console.error);
