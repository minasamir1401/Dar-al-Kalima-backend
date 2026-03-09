const axios = require('axios');

async function testDirect() {
    const key = 'AIzaSyAGl-TgOFQ_XyMllIrjrxfXUhTeEzx9k8c';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;

    try {
        const res = await axios.post(url, {
            contents: [{ parts: [{ text: "Hi" }] }]
        });
        console.log("Direct Success:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.log("Direct Failure Status:", e.response?.status);
        console.log("Direct Failure Data:", JSON.stringify(e.response?.data, null, 2));
    }
}

testDirect();
