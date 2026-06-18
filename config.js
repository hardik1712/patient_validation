// config.js — configuration reference
// ─────────────────────────────────────────────────
// Keys are pre-filled and auto-loaded by the app.
// For Ollama: run `OLLAMA_ORIGINS="*" ollama serve` in a terminal
//    then `ollama pull llava` to get the vision model
//
// MedGemma via Hugging Face:
//   1. Go to https://huggingface.co/google/medgemma-4b-it and accept the licence
//   2. Create a token at https://huggingface.co/settings/tokens (read + inference)
//   3. Paste it into HF_TOKEN below or in the UI

export const CONFIG = {
  // Google Gemini API key (used for Gemini & as MedGemma fallback)
  GEMINI_API_KEY: "",

  // Gemini model to use for the main "Gemini" source
  // Options: "gemini-3.5-flash", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"
  GEMINI_MODEL: "gemini-3.5-flash",

  // (Optional) Hugging Face token — enables real MedGemma 4B-IT via HF Inference API
  // Leave blank if you don't have one; the app falls back to Gemini 3.5-Flash instead.
  HF_TOKEN: "",

  // Path to the unzipped dataset folder (relative to index.html)
  DATASET_PATH: "./balanced_augmented_dataset",

  // Ollama local endpoint
  OLLAMA_BASE_URL: "http://localhost:11434",
  OLLAMA_MODEL: "llava", // must be a vision-capable model

  // Your website API endpoint
  YOUR_MODEL_API: "https://cvpr-submission-frac-mas.vercel.app/api/predict",
};
