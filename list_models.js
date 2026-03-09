const axios = require('axios');

async function listModels() {
    const key = 'AIzaSyAGl-TgOFQ_XyMllIrjrxfXUhTeEzx9k8c';
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

    try {
        const res = await axios.get(url);
        console.log("Available Models:", JSON.stringify(res.data.models.map(m => m.name), null, 2));
    } catch (e) {
        console.log("List Failure Status:", e.response?.status);
        console.log("List Failure Data:", JSON.stringify(e.response?.data, null, 2));
    }
}

listModels();
