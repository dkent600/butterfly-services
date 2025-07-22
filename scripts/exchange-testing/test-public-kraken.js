import https from 'https';

function makePublicKrakenCall() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.kraken.com',
      port: 443,
      path: '/0/public/Time',
      method: 'GET',
      headers: {
        'User-Agent': 'butterfly-services/1.0'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Public API Response status:', res.statusCode);
        console.log('Public API Response body:', data);
        
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });
    
    req.end();
  });
}

console.log('=== Testing Public Kraken API Call ===');
makePublicKrakenCall()
  .then(response => {
    console.log('=== Public API Call Successful ===');
    console.log('Response:', JSON.stringify(response, null, 2));
  })
  .catch(error => {
    console.error('=== Public API Call Failed ===');
    console.error('Error:', error);
  });
