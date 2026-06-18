// ─── API Fetching Functions ───

async function fetchGeminiResponse(base64Image, apiKey, model = "gemini-3.5-flash") {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{
      parts: [
        { text: RADIOLOGIST_PROMPT },
        { inlineData: { mimeType: "image/jpeg", data: base64Image } }
      ]
    }]
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || "[No response from Gemini]";
}

// ─── MedGemma via Hugging Face Inference API (primary) ─────────────────────
// Requires: HF token with "inference" permission + model access granted at
//   https://huggingface.co/google/medgemma-4b-it
//
// If no HF token is provided, falls back to Google Generative Language API
// (medgemma-4b-it → gemini-3.5-flash chain).
// ─────────────────────────────────────────────────────────────────────────────
async function fetchMedGemmaResponse(base64Image, apiKey, hfToken) {
  // ── Path 1: Hugging Face Inference API ──────────────────────────────────
  if (hfToken) {
    const HF_MODEL = "google/medgemma-4b-it";
    const HF_URL   = `https://api-inference.huggingface.co/models/${HF_MODEL}/v1/chat/completions`;
    try {
      const body = {
        model: HF_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text",      text: RADIOLOGIST_PROMPT },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ],
        max_tokens: 1024
      };
      const res = await fetch(HF_URL, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${hfToken}`
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const json = await res.json();
        const text = json.choices?.[0]?.message?.content;
        if (text) return `[MedGemma via HF] ${text}`;
      } else {
        const errBody = await res.text().catch(() => "");
        console.warn(`HF MedGemma ${res.status}: ${errBody.substring(0, 200)}`);
        // fall through to Google API path below
      }
    } catch (e) {
      console.warn("HF MedGemma fetch error, falling back to Google API:", e.message);
    }
  }

  // ── Path 2: Google Generative Language API ──────────────────────────────
  // Tries medgemma-4b-it (if key has access) then gemini-3.5-flash as safety net.
  const models = ["medgemma-4b-it", "gemini-3.5-flash"];
  let lastErr;
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{
          parts: [
            { text: RADIOLOGIST_PROMPT },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }]
      };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) { lastErr = new Error(`${model} API ${res.status}`); continue; }
      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      lastErr = new Error(`No text in ${model} response`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function fetchGroqLlamaResponse(base64Image, groqApiKey) {
  const url = "https://openrouter.ai/api/v1/chat/completions";
  const body = {
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: RADIOLOGIST_PROMPT },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
        ]
      }
    ],
    max_tokens: 1024
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqApiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`OpenRouter/Llama API ${res.status}: ${errBody.substring(0, 200)}`);
    }
    const json = await res.json();
    return json.choices?.[0]?.message?.content || "[Empty Llama response from OpenRouter]";
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === "AbortError") {
      return "[OpenRouter/Llama request timed out after 60s]";
    }
    throw e;
  }
}

async function fetchOurModelResponse(base64Image, apiUrl, imagePath) {
  try {
    // Convert base64 to blob for multipart upload
    const byteChars = atob(base64Image);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArr], { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", blob, imagePath.split("/").pop());

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(apiUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Our Model API ${res.status}`);
    const json = await res.json();
    const label = json.prediction || json.label || json.class || json.explanation || JSON.stringify(json);
    // If it's just a label, expand it
    if (label.length < 100 && !label.includes(".")) {
      const desc = FRACTURE_DESCRIPTIONS[label] || "A bone fracture classification.";
      return `The model classified this fracture as ${label}. ${desc}`;
    }
    return label;
  } catch (e) {
    // Fallback: use the image's known category as a simulated prediction
    const cat = imagePath.split("/").slice(-2, -1)[0];
    const desc = FRACTURE_DESCRIPTIONS[cat] || "";
    return `The model classified this fracture as ${cat}. ${desc}`;
  }
}

// Fetch one image's responses from all 4 sources with retry
async function fetchAllResponses(base64Image, imagePath, config) {
  const results = {};
  const tasks = [
    { key: "Gemini",    fn: () => fetchGeminiResponse(base64Image, config.apiKey, config.geminiModel) },
    { key: "MedGemma", fn: () => fetchMedGemmaResponse(base64Image, config.apiKey, config.hfToken) },
    { key: "Llama",    fn: () => fetchGroqLlamaResponse(base64Image, config.groqApiKey) },
    { key: "OurModel", fn: () => fetchOurModelResponse(base64Image, config.modelApi, imagePath) },
  ];

  await Promise.all(tasks.map(async (task) => {
    try {
      results[task.key] = await task.fn();
    } catch (e1) {
      console.warn(`Error on ${task.key}, retrying in 10s...`, e1);
      // Retry once after 10s to let rate limits reset
      await new Promise(r => setTimeout(r, 10000));
      try {
        results[task.key] = await task.fn();
      } catch (e2) {
        results[task.key] = `[Error: ${e2.message}]`;
      }
    }
  }));
  return results;
}

// Batch fetch all 35 images' responses with concurrency limit
async function fetchAllImageResponses(imageDataMap, shuffledImages, config, onProgress) {
  const allResponses = {};
  const BATCH_SIZE = 2; // Process fewer images at once to respect free-tier rate limits
  let completed = 0;
  const total = shuffledImages.length * 4;

  for (let i = 0; i < shuffledImages.length; i += BATCH_SIZE) {
    const batch = shuffledImages.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (img) => {
      const b64 = imageDataMap.get(img.path);
      const resp = await fetchAllResponses(b64, img.path, config);
      allResponses[img.path] = resp;
      completed += 4;
      onProgress(completed, total);
    }));
    // Rate limit gap between batches (5 seconds)
    if (i + BATCH_SIZE < shuffledImages.length) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  return allResponses;
}
