import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= SECURITY MIDDLEWARE ================= */
app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests from this IP, try again after 15 minutes",
});

app.use(limiter);
app.use(express.json({ limit: "10mb" }));

/* ================= AI CLIENT SETUP ================= */
const API_KEY = process.env.NEBIUS_API_KEY || process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error("❌ No API key found in environment variables");
  process.exit(1);
}

const client = new OpenAI({
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
  apiKey: API_KEY,
});

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.json({ status: "Code Explainer API running 🚀" });
});

/* ================= CODE EXPLAIN ENDPOINT ================= */
app.post("/api/explain-code", async (req, res) => {
  try {
    const { codeSnippet, language } = req.body;

    if (!codeSnippet) {
      return res.status(400).json({
        error: "Code snippet is required",
      });
    }

    const messages = [
      {
        role: "system",
        content:
          "You are a senior software engineer. Explain code clearly, line by line if needed, and mention improvements.",
      },
      {
        role: "user",
        content: `Explain the following ${language || ""} code snippet:\n\n${codeSnippet}`,
      },
    ];

    const completion = await client.chat.completions.create({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      messages,
      temperature: 0.3,
    });

    const explanation = completion.choices[0].message.content;

    res.json({ explanation });
  } catch (err) {
    console.error("Code Explain API Error:", err);
    res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
