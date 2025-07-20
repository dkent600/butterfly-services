import axios from 'axios';

// Test alternative USD formats
async function testAlternativeFormats() {
  const assets = [
    { original: 'DOGE', kraken: 'XXDG' },
    { original: 'SOL', kraken: 'SOL' },
    { original: 'ADA', kraken: 'ADA' },
    { original: 'SHIB', kraken: 'SHIB' }
  ];
  
  console.log('Testing alternative USD formats...\n');
  
  for (const asset of assets) {
    // Try different USD formats
    const usdFormats = ['ZUSD', 'USD', 'XUSD'];
    
    for (const usdFormat of usdFormats) {
      const pair = asset.kraken + usdFormat;
      console.log(`${asset.original} -> Trying pair: ${pair}`);
      
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
    console.log('');
  }
  
  // Let's also see what pairs are actually available
  console.log('Getting list of all available asset pairs...\n');
  
  try {
    const { data } = await axios.get('https://api.kraken.com/0/public/AssetPairs');
    const pairs = Object.keys(data.result || {});
    
    console.log('Looking for USD pairs containing our assets...\n');
    
    for (const asset of assets) {
      console.log(`${asset.original} (${asset.kraken}) pairs containing USD:`);
      const matchingPairs = pairs.filter(pair => 
        (pair.includes(asset.kraken) || pair.includes(asset.original)) && 
        (pair.includes('USD') || pair.includes('ZUSD'))
      );
      
      if (matchingPairs.length > 0) {
        matchingPairs.forEach(pair => console.log(`  - ${pair}`));
      } else {
        console.log(`  - No USD pairs found`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.log(`Error getting asset pairs: ${error.message}`);
  }
}

testAlternativeFormats().catch(console.error);
