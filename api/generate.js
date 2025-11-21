// api/generate.js
// Vercel serverless function (Node). Receives { prompt } and returns { html, css, js }.
// NOTE: adjust the MODEL and ENDPOINT if your provider or SDK requires a different shape.

import fetch from "node-fetch"; // if your Node runtime already has fetch, you can remove this import

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'prompt' in request body" });
    }

    // Read key from environment (set this in Vercel dashboard or local env file)
    const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: "Server missing GEMINI_API_KEY environment variable" });

    // Guidance for the model: instruct it to return JSON ONLY with html, css, js fields
    const systemInstruction = `Return valid JSON only. The JSON object must have three keys: "html", "css", "js". Each value should be a string containing the code for that file. Do not include any extra commentary.`;

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    // REST endpoint: replace if your provider requires a different URL/shape.
    const url = process.env.GEMINI_ENDPOINT || `https://api.generativeai.googleapis.com/v1/models/${model}:generateContent`;

    const body = {
      // This request shape is intentionally generic. If your project's SDK or endpoint expects a different
      // payload (e.g., 'input' vs 'prompt' vs 'messages'), update this block to match the docs.
      // We use a simple messages-like structure.
      input: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ]
      // add optional params like temperature, maxOutputTokens etc. as needed
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Upstream API error:", response.status, text);
      return res.status(502).json({ error: "Upstream API error", details: text });
    }

    const data = await response.json();

    // --- Extract text from commonly-used response shapes ---
    let generatedText = "";
    // try some common locations (adapt if your endpoint differs)
    if (typeof data.output === "object" && data.output && data.output[0] && data.output[0].content) {
      generatedText = data.output[0].content;
    } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      generatedText = data.candidates[0].content;
    } else if (typeof data.text === "string") {
      generatedText = data.text;
    } else if (typeof data === "string") {
      generatedText = data;
    } else {
      // fallback: try to stringify the whole response for debugging
      generatedText = JSON.stringify(data);
    }

    // Try to parse JSON from the model output
    let parsed;
    try {
      parsed = JSON.parse(generatedText);
    } catch (err) {
      // attempt to find a JSON substring inside the response
      const match = generatedText.match(/{[\s\S]*}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (err2) {
          console.error("Failed to parse JSON substring:", err2);
          return res.status(500).json({ error: "Failed to parse model output as JSON", raw: generatedText });
        }
      } else {
        console.error("No JSON found in model output:", generatedText);
        return res.status(500).json({ error: "Model did not return JSON", raw: generatedText });
      }
    }

    // Ensure fields exist (default to empty strings)
    const html = parsed.html || "";
    const css  = parsed.css  || "";
    const js   = parsed.js   || "";

    return res.status(200).json({ html, css, js });
  } catch (err) {
    console.error("Server error in /api/generate:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
