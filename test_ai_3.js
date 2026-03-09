const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testAI() {
    const genAI = new GoogleGenerativeAI('AIzaSyAGl-TgOFQ_XyMllIrjrxfXUhTeEzx9k8c');
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const result = await model.generateContent("Hi");
        console.log("Success with gemini-flash-latest:", result.response.text());
    } catch (e) {
        console.log("Failed with gemini-flash-latest:", e.status, e.statusText);
        console.error(JSON.stringify(e, null, 2));
    }
}

testAI();
