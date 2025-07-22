// Test script to simulate your client making sequential requests
import axios from 'axios';

const baseUrl = 'http://localhost:3000'; // Adjust to your server URL
const assets = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC'];

async function testSequentialRequests() {
  console.log('=== Testing Sequential Balance Requests ===');
  
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const startTime = Date.now();
    
    try {
      console.log(`[${new Date().toISOString()}] Sending request ${i + 1}/6 for ${asset}`);
      
      const response = await axios.get(`${baseUrl}/api/v1/kraken/balance/${asset}`);
      
      const endTime = Date.now();
      console.log(`[${new Date().toISOString()}] Response ${i + 1}/6 for ${asset}: ${response.data.balance} (took ${endTime - startTime}ms)`);
      
    } catch (error) {
      const endTime = Date.now();
      console.error(`[${new Date().toISOString()}] Error ${i + 1}/6 for ${asset} (took ${endTime - startTime}ms):`, error.response?.data?.message || error.message);
    }
    
    // Optional: Add a small delay between requests to see timing more clearly
    // await new Promise(resolve => setTimeout(resolve, 100));
  }
}

testSequentialRequests();
