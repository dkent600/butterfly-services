import axios from 'axios';

// Test DOGE pair formats specifically
async function testDogePairs() {
  console.log('Testing DOGE pair formats...\n');
  
  const dogeFormats = [
    'XXDGUSD',    // Current format we're using
    'XXDGZUSD',   // With ZUSD
    'DOGEUSD',    // Plain DOGE
    'DOGEZUSD',   // Plain DOGE with ZUSD
    'XDGUSD',     // Single X prefix
    'XDGZUSD',    // Single X prefix with ZUSD
  ];
  
  for (const pair of dogeFormats) {
    console.log(`Testing pair: ${pair}`);
    
    try {
      const { data } = await axios.get('https://api.kraken.com/0/public/Ticker', {
        params: { pair },
      });
      
      if (data.result && Object.keys(data.result).length > 0) {
        console.log(`✅ ${pair} - SUCCESS`);
        console.log(`   Available keys: ${Object.keys(data.result).join(', ')}`);
      } else {
        console.log(`❌ ${pair} - No data`);
      }
    } catch (error) {
      console.log(`❌ ${pair} - ERROR: ${error.response?.data?.error?.[0] || error.message}`);
    }
  }
  
  // Also check all available pairs containing DOGE
  console.log('\nGetting all DOGE pairs from AssetPairs API...\n');
  
  try {
    const { data } = await axios.get('https://api.kraken.com/0/public/AssetPairs');
    const pairs = Object.keys(data.result || {});
    
    console.log('All DOGE-related pairs:');
    const dogePairs = pairs.filter(pair => 
      pair.includes('DOG') || pair.includes('XDG') || pair.includes('XXDG')
    );
    
    dogePairs.forEach(pair => console.log(`  - ${pair}`));
    
  } catch (error) {
    console.log(`Error getting asset pairs: ${error.message}`);
  }
}

testDogePairs().catch(console.error);
