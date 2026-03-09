const { GoogleGenerativeAI } = require('@google/generative-ai');

const keys = [
    'AIzaSyAh8WXKFpohwo9h7r3yaqhqkGb0m03tccM',
    'AIzaSyBy22tBoHqhNuDwnspjvEzypLcXGWcUATM',
    'AIzaSyChxPTXCer6-TXG9AaJ2-X1XaCHmBbbwqw'
];

async function testKey(key, index) {
    console.log(`\n--- Testing Key ${index + 2} (...${key.slice(-5)}) ---`);
    const genAI = new GoogleGenerativeAI(key);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent("Hi");
        console.log(`✅ Success! Response: ${result.response.text().substring(0, 20)}...`);
    } catch (e) {
        console.log(`❌ Failed: Status ${e.status || 'N/A'}`);
        if (e.message.includes('API_KEY_INVALID')) {
            console.log(`Reason: Invalid or Expired Key`);
        } else if (e.message.includes('429')) {
            console.log(`Reason: Quota Exceeded (Rate Limit)`);
        } else if (e.message.includes('403')) {
            console.log(`Reason: Forbidden (Possibly Leaked/Disabled)`);
        } else {
            console.log(`Message: ${e.message}`);
        }
    }
}

async function runTests() {
    for (let i = 0; i < keys.length; i++) {
        await testKey(keys[i], i);
    }
}

runTests();
