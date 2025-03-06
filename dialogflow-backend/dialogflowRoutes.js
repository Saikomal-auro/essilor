const express = require("express");
const { SessionsClient } = require("@google-cloud/dialogflow-cx");
const fs = require("fs");
require("dotenv").config();

const router = express.Router();

// ✅ Load Google Cloud credentials
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialsPath || !fs.existsSync(credentialsPath)) {
    console.error("❌ Error: service-account.json not found!");
    process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(credentialsPath));
const projectId = credentials.project_id;
const location = "us-central1"; // ✅ Update this based on your agent's region
const agentId = "a87accf4-abca-4581-9dc1-37c481372d33"; // ✅ Replace with your actual Dialogflow agent ID

// ✅ Initialize Dialogflow CX client with the correct API endpoint
const sessionClient = new SessionsClient({
    credentials,
    apiEndpoint: "us-central1-dialogflow.googleapis.com", // ✅ Set the correct endpoint
});

// ✅ Test route to check if API is accessible
router.get("/", (req, res) => {
    res.send("✅ Dialogflow CX API is working!");
});

// ✅ POST /api/sendMessage - Handle user messages
router.post("/sendMessage", async (req, res) => {
    const { message, sessionId = "123456" } = req.body;

    if (!message) {
        return res.status(400).json({ reply: "❌ Error: Message is required." });
    }

    const sessionPath = sessionClient.projectLocationAgentSessionPath(
        projectId, location, agentId, sessionId
    );

    const request = {
        session: sessionPath,
        queryInput: {
            text: {
                text: message,
            },
            languageCode: "en",
        },
    };

    try {
        console.log("🔵 Sending message to Dialogflow CX:", message);

        const [response] = await sessionClient.detectIntent(request);
        const responseMessages = response.queryResult.responseMessages;

        let reply =
            responseMessages.length > 0
                ? responseMessages.map((msg) => msg.text?.text[0]).join(" ")
                : "❌ No response from Dialogflow CX";

        console.log("🟢 Response from Dialogflow CX:", reply);
        res.json({ reply });

    } catch (error) {
        console.error("❌ Dialogflow CX Error:", error?.details || error.message);
        res.status(500).json({ reply: "❌ Error: Unable to fetch response from Dialogflow CX." });
    }
});

module.exports = router;
