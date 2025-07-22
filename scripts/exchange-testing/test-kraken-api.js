import crypto from 'crypto';
import https from 'https';
import { URLSearchParams } from 'url';

// Your actual Kraken credentials
const apiSecret = 'dxrEWMJ1ozSeyhAwzu4VC7rpakyWWJ0Bfyx7XQBiXXnGNavWgVMT+yQTSkGcfzCvTRjERarb453nri8/K1U9Og==';
const apiKey = 'm6oCuKQNTKE8J8ZsAeXL49t5hkcJfXh54alFVoYwSivKhd0hLQ37TxLY';

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

function makeKrakenAPICall() {
  return new Promise((resolve, reject) => {
    const nonce = generateNonce();
    const path = '/0/private/Balance';
    const postData = `nonce=${nonce}`;
    
    console.log('Making API call with:');
    console.log('Nonce:', nonce);
    console.log('Path:', path);
    console.log('PostData:', postData);
    
    const signature = signKrakenRequest(path, postData, apiSecret);
    console.log('Signature:', signature);
    
    const options = {
      hostname: 'api.kraken.com',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'API-Key': apiKey,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'butterfly-services/1.0'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response status:', res.statusCode);
        console.log('Response headers:', res.headers);
        console.log('Response body:', data);
        
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
    
    req.write(postData);
    req.end();
  });
}

// Make the API call
console.log('=== Making Real Kraken API Call ===');
makeKrakenAPICall()
  .then(response => {
    console.log('=== API Call Successful ===');
    console.log('Response:', JSON.stringify(response, null, 2));
  })
  .catch(error => {
    console.error('=== API Call Failed ===');
    console.error('Error:', error);
  });
