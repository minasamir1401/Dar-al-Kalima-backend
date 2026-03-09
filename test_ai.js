const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testAI() {
    const genAI = new GoogleGenerativeAI('AIzaSyAGl-TgOFQ_XyMllIrjrxfXUhTeEzx9k8c');
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hi");
        console.log("Success with gemini-1.5-flash:", result.response.text());
    } catch (e) {
        console.log("Failed with gemini-1.5-flash:", e.status, e.statusText);
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result = await model.generateContent("Hi");
            console.log("Success with gemini-pro:", result.response.text());
        } catch (e2) {
            console.log("Failed with gemini-pro:", e2.status, e2.statusText);
        }
    }
}

testAI();
