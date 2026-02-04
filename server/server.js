import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

const app = express();

/* ================= SECURITY MIDDLEWARE ================= */
app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));

/* ================= RATE LIMITING ================= */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

/* ================= AI CLIENT SETUP ================= */
const API_KEY = process.env.NEBIUS_API_KEY;


if (!API_KEY) {
  console.error("❌ No API key found in environment variables");
  process.exit(1);
}
console.log("Nebius key loaded:", !!process.env.NEBIUS_API_KEY);


const client = new OpenAI({
  baseURL: "https://api.studio.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY,
});



/* ================= CODE EXPLANATION ENDPOINT ================= */
app.post("/api/explain-code", async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }

    const messages = [
      {
        role: "system",
        content:
          "You are a senior software engineer. Explain code step-by-step and suggest improvements.",
      },
      {
        role: "user",
        content: `Explain this ${language || ""} code:\n\n\`\`\`${language || ""}\n${code}\n\`\`\``,
      },
    ];

    const response = await client.chat.completions.create({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",

      messages,
      temperature: 0.3,
      max_tokens: 800,
    });

    const explanation = response?.choices?.[0]?.message?.content;

    if (!explanation) {
      return res.status(500).json({ error: "Failed to generate explanation" });
    }

    res.json({ explanation, language: language || "unknown" });
  } catch (err) {
    console.error("Code Explain API Error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

/* ================= HEALTH CHECK ================= */
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    hasApiKey: !!API_KEY,
    uptime: process.uptime(),
  });
});

/* ================= GLOBAL ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

/* ================= 404 HANDLER (EXPRESS 5 WAY) ================= */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log(`API Key Loaded: ${!!API_KEY}`);
});
