const axios = require('axios');

async function listModels() {
    const key = 'AIzaSyAGl-TgOFQ_XyMllIrjrxfXUhTeEzx9k8c';
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

    try {
        const res = await axios.get(url);
        const names = res.data.models.map(m => m.name);
        console.log("Full List of Models:");
        console.log(names.join('\n'));
    } catch (e) {
        console.log("List Failure");
    }
}

listModels();
