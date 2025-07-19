import crypto from 'crypto';

// Your actual Kraken credentials
const apiSecret = 'dxrEWMJ1ozSeyhAwzu4VC7rpakyWWJ0Bfyx7XQBiXXnGNavWgVMT+yQTSkGcfzCvTRjERarb453nri8/K1U9Og==';
const apiKey = 'm6oCuKQNTKE8J8ZsAeXL49t5hkcJfXh54alFVoYwSivKhd0hLQ37TxLY';

function generateNonce() {
  const now = Date.now();
  console.log('Generated nonce:', now);
  console.log('Nonce length:', now.toString().length);
  return now;
}

function signKrakenRequest(path, postData, apiSecret) {
  // Extract nonce from postData
  const nonceMatch = postData.match(/nonce=(\d+)/);
  if (!nonceMatch) {
    throw new Error('No nonce found in postData');
  }
  const nonce = nonceMatch[1];
  console.log('Using nonce from postData:', nonce);
  
  // Follow Kraken's exact algorithm from their docs
  const apiSha256 = crypto.createHash('sha256').update(`${nonce}${postData}`).digest();
  console.log('SHA256 input:', `${nonce}${postData}`);
  console.log('SHA256 hash length:', apiSha256.length);
  
  const apiSha512 = crypto.createHmac('sha512', Buffer.from(apiSecret, 'base64'))
    .update(path)
    .update(apiSha256)
    .digest();
    
  console.log('HMAC input path:', path);
  console.log('API secret decoded length:', Buffer.from(apiSecret, 'base64').length);
  
  const apiSignature = apiSha512.toString('base64');
  console.log('Final signature length:', apiSignature.length);
  
  return apiSignature;
}

// Test with your actual use case
console.log('=== Testing Kraken API Signature ===');
const nonce = generateNonce();
const path = '/0/private/Balance';
const postData = `nonce=${nonce}`;

console.log('Path:', path);
console.log('PostData:', postData);

try {
  const signature = signKrakenRequest(path, postData, apiSecret);
  console.log('Generated signature:', signature);
  console.log('API Key:', apiKey);
  
  // Test if the nonce is within reasonable bounds
  const now = Date.now();
  console.log('Current time:', now);
  console.log('Nonce vs current time diff:', Math.abs(nonce - now), 'ms');
  
} catch (error) {
  console.error('Error generating signature:', error.message);
}
