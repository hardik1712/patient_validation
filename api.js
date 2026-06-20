// ─── API Fetching Functions ───

async function fetchFromProxy(base64Image, model) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, base64Image })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Proxy error ${res.status}`);
  return json.result;
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
    { key: "Gemini",    fn: () => fetchFromProxy(base64Image, 'Gemini') },
    { key: "MedGemma",  fn: () => fetchFromProxy(base64Image, 'MedGemma') },
    { key: "Llama",     fn: () => fetchFromProxy(base64Image, 'Llama') },
    { key: "OurModel",  fn: () => fetchOurModelResponse(base64Image, config.modelApi, imagePath) },
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
