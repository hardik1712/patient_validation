# FracAnnotate — Bone Fracture AI Response Ranking Tool

A client-side web application for evaluating and ranking AI-generated bone fracture explanations across 4 different AI sources (Gemini, MedGemma, Ollama, and a custom model).

## Quick Start

### 1. Prerequisites
- Modern browser (Chrome 90+ or Firefox 90+)
- A Google Gemini API key ([get one here](https://makersuite.google.com/app/apikey))
- The `balanced_augmented_dataset.zip` dataset file
- (Optional) [Ollama](https://ollama.ai/) installed locally with a vision model

### 2. Setup

```
patient_validation/
├── index.html          ← Open this in your browser
├── styles.css          ← Styling
├── data.js             ← Image paths & constants
├── api.js              ← API fetching logic
├── app.js              ← Main application logic
├── config.js           ← (Reference) configuration values
├── README.md           ← This file
└── balanced_augmented_dataset/   ← (Optional) unzipped dataset
    └── test/
        ├── Comminuted/
        ├── Greenstick/
        ├── Oblique/
        ├── Oblique_Displaced/
        ├── Transverse/
        ├── Transverse_Displaced/
        └── Spiral/
```

### 3. Running the App

1. **Open `index.html`** in Chrome or Firefox
   - You can double-click the file or use a local server:  
     ```bash
     npx serve .
     # or
     python -m http.server 8000
     ```

2. **Enter your Gemini API Key** in the input field

3. **Upload the ZIP file** — Click the upload area and select `balanced_augmented_dataset.zip`.  
   The app reads images directly from the ZIP using JSZip (no extraction needed).

4. **Click "Begin Annotation Session"** — The app will fetch all 140 AI responses (35 images × 4 sources) with a progress bar.

5. **Annotate** — For each of the 35 images:
   - View the X-ray (click to zoom)
   - Read the 4 AI responses (labeled A/B/C/D, source identity hidden)
   - Drag cards to reorder or use rank dropdowns (1=Best, 4=Worst)
   - Optionally add comments
   - Click "Next Image"

6. **Export** — After all 35 images, download results as JSON or CSV.

### 4. Ollama Setup (Optional)

To get responses from a local LLM:

```bash
# Install Ollama (https://ollama.ai)
# Pull a vision-capable model
ollama pull llava

# Start Ollama with CORS enabled (required for browser access)
OLLAMA_ORIGINS="*" ollama serve
```

On Windows:
```powershell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

If Ollama is not running, the app will show a placeholder message and still work for the other 3 sources.

### 5. API Rate Limits

- Gemini free tier: ~15 requests/minute
- The app batches requests (5 images at a time) with 1.2s gaps to stay under limits
- If rate-limited, failed requests are retried once after 3 seconds
- Any remaining failures show as error placeholders (annotation still works)

## Export Format

### JSON
```json
{
  "session_id": "uuid",
  "completed_at": "ISO-8601",
  "annotations": [
    {
      "image_index": 1,
      "image_path": "balanced_augmented_dataset/test/...",
      "true_category": "Comminuted",
      "letter_mapping": { "A": "Gemini", "B": "OurModel", ... },
      "rankings": { "Gemini": 2, "OurModel": 1, "Ollama": 4, "MedGemma": 3 },
      "responses": { "Gemini": "...", "OurModel": "...", ... },
      "comment": "optional text"
    }
  ]
}
```

### CSV
`image_index, image_filename, true_category, rank_Gemini, rank_OurModel, rank_Ollama, rank_MedGemma, comment`

## Session Persistence

Your progress is automatically saved to `localStorage` after each image. If you close and reopen the page, you'll be prompted to resume (note: you'll need to re-upload the ZIP and re-fetch API responses, but your rankings are preserved).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS error with Ollama | Start Ollama with `OLLAMA_ORIGINS="*"` |
| Gemini 429 rate limit | Wait 60 seconds and try again |
| ZIP images not found | Ensure the ZIP contains `balanced_augmented_dataset/test/` structure |
| Our Model API fails | Expected if the endpoint is down; a simulated response is used |
