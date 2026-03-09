const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testAI() {
    const genAI = new GoogleGenerativeAI('AIzaSyBtSckRuxQJffeG4ugKefge754PZkLLG68');
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent("أهلاً بك، رد بكلمة واحدة");
        console.log("Success with gemini-2.0-flash:", result.response.text());
    } catch (e) {
        console.log("Failed with gemini-2.0-flash:", e.status, e.statusText);
        console.error(e);
    }
}

testAI();
