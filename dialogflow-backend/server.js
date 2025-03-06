require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dialogflowRoutes = require("./dialogflowRoutes");

const app = express();

// ✅ Configure CORS to allow all origins
const corsOptions = {
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: ["Content-Type"]
};
app.use(cors(corsOptions));

app.use(bodyParser.json());

// ✅ Test route to check if the server is running
app.get("/", (req, res) => {
    res.send("✅ Dialogflow Server is Running on Cloud Run!");
});

// ✅ Register Dialogflow Routes
console.log("✅ Registering Dialogflow Routes at /api");
app.use("/api", dialogflowRoutes);

// ✅ Handle 404 errors
app.use((req, res) => {
    res.status(404).json({ error: "❌ Route Not Found" });
});

// ✅ Set PORT for Cloud Run
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
