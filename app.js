// ─── Main Application Logic ───

// Pre-filled keys (set in config.js)
const PREFILLED_GEMINI_KEY = "";
const PREFILLED_HF_TOKEN   = ""; // paste your HF token here to enable real MedGemma

async function fetchImageAsBase64(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result.split(",")[1];
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const APP = {
  state: {
    sessionId: crypto.randomUUID(),
    shuffledImages: [],
    imageDataMap: new Map(),
    allResponses: {},
    letterMappings: {},   // per image: { A: "Gemini", B: "OurModel", ... }
    annotations: {},      // per image: { rankings: {}, comment: "" }
    currentIndex: 0,
    sortableInstance: null,
    config: {
      apiKey: PREFILLED_GEMINI_KEY,
      hfToken: PREFILLED_HF_TOKEN,
      groqApiKey: "",
      modelApi: "https://cvpr-submission-frac-mas.vercel.app/api/predict",
      geminiModel: "gemini-3.5-flash"
    }
  },

  init() {
    this.bindLandingEvents();
    this.bindWelcomeEvents();
    this.bindLightbox();

    // Always show the landing page first
    this.showScreen("landing");
  },

  // ─── Landing Page ───
  bindLandingEvents() {
    const btn = document.getElementById("landingStartBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        // Fade out landing and show welcome screen
        const landing = document.getElementById("landingScreen");
        landing.style.transition = "opacity 0.4s ease";
        landing.style.opacity = "0";
        setTimeout(() => {
          this.showScreen("welcome");
          // Only NOW check for a previous session
          this.checkResume();
        }, 380);
      });
    }
  },

  // ─── Shuffle ───
  shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  // ─── Per-image letter mapping ───
  generateLetterMapping() {
    const shuffled = this.shuffleArray(SOURCES);
    const mapping = {};
    LETTERS.forEach((l, i) => mapping[l] = shuffled[i]);
    return mapping;
  },

  // ─── Welcome Screen ───
  bindWelcomeEvents() {
    const zipArea = document.getElementById("zipUploadArea");
    const zipInput = document.getElementById("zipFileInput");
    const startBtn = document.getElementById("startBtn");

    zipArea.addEventListener("click", () => zipInput.click());
    zipArea.addEventListener("dragover", (e) => { e.preventDefault(); zipArea.classList.add("dragover"); });
    zipArea.addEventListener("dragleave", () => zipArea.classList.remove("dragover"));
    zipArea.addEventListener("drop", (e) => {
      e.preventDefault(); zipArea.classList.remove("dragover");
      if (e.dataTransfer.files.length) this.handleZipFile(e.dataTransfer.files[0]);
    });
    zipInput.addEventListener("change", (e) => {
      if (e.target.files.length) this.handleZipFile(e.target.files[0]);
    });
    startBtn.addEventListener("click", () => this.startSession());
  },

  async handleZipFile(file) {
    const fnEl = document.getElementById("zipFilename");
    fnEl.textContent = file.name;

    try {
      const zip = await JSZip.loadAsync(file);
      const imageDataMap = new Map();

      for (const img of IMAGE_LIST) {
        const entry = zip.file(img.path);
        if (entry) {
          const data = await entry.async("base64");
          imageDataMap.set(img.path, data);
        }
      }

      this.state.imageDataMap = imageDataMap;
      fnEl.textContent = `${file.name} — ${imageDataMap.size} / 35 images found`;
      if (imageDataMap.size < 35) {
        fnEl.style.color = "#ffd166";
        fnEl.textContent += " (some images missing!)";
      }
    } catch (e) {
      fnEl.textContent = `Error reading zip: ${e.message}`;
      fnEl.style.color = "#ef476f";
    }
  },

  async startSession() {
    const nameInput = document.getElementById("annotatorIdInput");
    if (!nameInput || !nameInput.value.trim()) {
      alert("Please enter your Annotator Name or ID to continue.");
      return;
    }
    this.state.annotatorId = nameInput.value.trim();

    // All keys are already set in state.config from the hardcoded values above.
    // No need to read from input fields.

    if (this.state.shuffledImages.length === 0) {
      this.state.shuffledImages = this.shuffleArray(IMAGE_LIST);
      this.state.shuffledImages.forEach(img => {
        this.state.letterMappings[img.path] = this.generateLetterMapping();
      });
    }

    if (this.state.imageDataMap.size > 0) {
      this.showScreen("loading");
      await this.fetchAllData();
    } else {
      await this.loadImagesAndStart(false);
    }
  },

  async loadImagesAndStart(isResume = false) {
    this.showScreen("loading");
    
    const bar = document.getElementById("loadingBarFill");
    const status = document.getElementById("loadingStatus");
    const log = document.getElementById("loadingLog");
    
    log.innerHTML = "";
    
    const addLog = (msg, cls = "") => {
      const d = document.createElement("div");
      d.className = "log-entry " + cls;
      d.textContent = msg;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
    };

    addLog("Loading dataset images from local server...");
    status.textContent = "Loading images...";
    
    try {
      const imageDataMap = new Map();
      for (let i = 0; i < IMAGE_LIST.length; i++) {
        const img = IMAGE_LIST[i];
        const b64 = await fetchImageAsBase64(img.path);
        imageDataMap.set(img.path, b64);
        const pct = Math.round(((i + 1) / IMAGE_LIST.length) * 100);
        bar.style.width = pct + "%";
        status.textContent = `Loading images… ${i + 1} / ${IMAGE_LIST.length}`;
      }
      this.state.imageDataMap = imageDataMap;
      addLog("Images loaded successfully!", "log-ok");
      
      if (isResume && Object.keys(this.state.allResponses || {}).length > 0) {
        addLog("Resuming previous session...");
        setTimeout(() => this.beginAnnotation(), 500);
      } else {
        if (isResume) addLog("Fetching missing AI responses for resumed session...");
        await this.fetchAllData();
      }
    } catch (e) {
      addLog(`Failed to load local images: ${e.message}`, "log-err");
      addLog("Falling back to ZIP upload mode.", "log-err");
      status.textContent = "Error loading images.";
      
      // Fallback: show the welcome screen and ZIP upload
      setTimeout(() => {
        this.showScreen("welcome");
        document.getElementById("zipFallback").style.display = "block";
      }, 3500);
    }
  },

  async fetchAllData() {
    const bar = document.getElementById("loadingBarFill");
    const status = document.getElementById("loadingStatus");
    const log = document.getElementById("loadingLog");

    const addLog = (msg, cls = "") => {
      const d = document.createElement("div");
      d.className = "log-entry " + cls;
      d.textContent = msg;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
    };

    addLog("Checking backend for cached AI responses...");

    try {
      const cacheRes = await fetch("api/responses").catch(() => ({ ok: false }));
      let cacheData = null;
      if (cacheRes.ok) cacheData = await cacheRes.json();

      // If backend cache is empty or unavailable, fall back to the static responses_cache.json
      if (!cacheData) {
        addLog("Database cache empty. Checking static file cache...");
        const staticRes = await fetch("responses_cache.json").catch(() => ({ ok: false }));
        if (staticRes.ok) {
          cacheData = await staticRes.json();
          addLog("Loaded AI responses from static file cache!", "log-ok");
          
          // Try to seed the backend cache if we are connected to a running server
          fetch("api/responses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cacheData)
          }).catch(() => console.warn("Could not auto-seed cache to backend"));
        }
      }

      if (cacheData) {
        this.state.allResponses = cacheData;
      } else {
        addLog("No cache found. Fetching from AI APIs directly...");
        this.state.allResponses = await fetchAllImageResponses(
          this.state.imageDataMap,
          this.state.shuffledImages,
          this.state.config,
          (done, total) => {
            const pct = Math.round((done / total) * 100);
            bar.style.width = pct + "%";
            status.textContent = `Fetching responses… ${done} / ${total}`;
            if (done % 4 === 0) addLog(`✓ Image ${done / 4} / 35 complete`, "log-ok");
          }
        );
        addLog("All responses fetched successfully!", "log-ok");
        
        // Save to cache so next users don't hit the API
        await fetch("api/responses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.state.allResponses)
        }).catch(() => console.warn("Could not save cache to backend"));
      }

      this.saveSession();
      setTimeout(() => this.beginAnnotation(), 500);
    } catch (e) {
      addLog(`Error: ${e.message}`, "log-err");
      status.textContent = "Error occurred. Check log below.";
    }
  },

  // ─── Annotation ───
  beginAnnotation() {
    this.showScreen("annotation");
    this.renderImage(0);
  },

  renderImage(idx) {
    this.state.currentIndex = idx;
    const img = this.state.shuffledImages[idx];
    const mapping = this.state.letterMappings[img.path];
    const responses = this.state.allResponses[img.path] || {};
    const saved = this.state.annotations[img.path] || { rankings: {}, comment: "" };

    // Header progress
    document.getElementById("headerProgressText").textContent = `${idx + 1} / 35`;
    document.getElementById("headerProgressFill").style.width = `${((idx + 1) / 35) * 100}%`;

    // Image
    const b64 = this.state.imageDataMap.get(img.path);
    const imgEl = document.getElementById("annotationImage");
    imgEl.src = b64 ? `data:image/jpeg;base64,${b64}` : "";
    document.getElementById("imageCounter").textContent = `Image ${idx + 1} of 35`;
    document.getElementById("imageFilename").textContent = img.path.split("/").pop();

    // Response cards
    const container = document.getElementById("responseCards");
    container.innerHTML = "";

    // Build cards in letter order (A, B, C, D), ordered by saved ranking or default
    const cardOrder = [...LETTERS];
    if (Object.keys(saved.rankings).length === 4) {
      // Sort by saved rank
      cardOrder.sort((a, b) => {
        const srcA = mapping[a], srcB = mapping[b];
        return (saved.rankings[srcA] || 0) - (saved.rankings[srcB] || 0);
      });
    }

    cardOrder.forEach((letter, i) => {
      const source = mapping[letter];
      const text = responses[source] || "[No response available]";
      const isError = text.startsWith("[Error") || text.startsWith("[Llama unavailable") || text.startsWith("[Our Model API unavailable");
      const rank = saved.rankings[source] || (i + 1);

      const card = document.createElement("div");
      card.className = `response-card${isError ? " error-card" : ""}`;
      card.dataset.letter = letter;
      card.dataset.source = source;

      card.innerHTML = `
        <div class="response-card-accent"></div>
        <div class="response-card-header">
          <div class="response-card-label">
            <span class="badge">${letter}</span>
            Response ${letter}
            ${isError ? '<span class="error-badge">⚠ Limited</span>' : ""}
          </div>
          <select class="rank-select" data-source="${source}">
            <option value="">Rank</option>
            <option value="1" ${rank === 1 ? "selected" : ""}>1 – Best</option>
            <option value="2" ${rank === 2 ? "selected" : ""}>2</option>
            <option value="3" ${rank === 3 ? "selected" : ""}>3</option>
            <option value="4" ${rank === 4 ? "selected" : ""}>4 – Worst</option>
          </select>
        </div>
        <div class="response-card-body">${this.escapeHtml(text)}</div>
      `;
      container.appendChild(card);
    });

    // Init SortableJS
    if (this.state.sortableInstance) this.state.sortableInstance.destroy();
    this.state.sortableInstance = Sortable.create(container, {
      animation: 250,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      onEnd: () => this.syncRanksFromOrder()
    });

    // Bind rank selects
    container.querySelectorAll(".rank-select").forEach(sel => {
      sel.addEventListener("change", () => this.onRankChange());
    });

    // Comment
    document.getElementById("commentBox").value = saved.comment || "";

    // Nav buttons
    document.getElementById("prevBtn").disabled = idx === 0;
    document.getElementById("nextBtn").textContent = idx === 34 ? "Finish & Export →" : "Next Image →";

    // Clear validation
    document.getElementById("validationError").classList.remove("show");

    // If no saved rankings, set from drag order
    if (Object.keys(saved.rankings).length === 0) {
      this.syncRanksFromOrder();
    }
  },

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  },

  syncRanksFromOrder() {
    const cards = document.querySelectorAll("#responseCards .response-card");
    cards.forEach((card, i) => {
      const sel = card.querySelector(".rank-select");
      sel.value = String(i + 1);
    });
  },

  onRankChange() {
    // No auto-sync needed; user manually picks ranks
  },

  validateRanks() {
    const selects = document.querySelectorAll("#responseCards .rank-select");
    const values = [...selects].map(s => parseInt(s.value));
    if (values.some(v => isNaN(v) || v < 1 || v > 4)) return false;
    const unique = new Set(values);
    return unique.size === 4 && [1, 2, 3, 4].every(v => unique.has(v));
  },

  saveCurrentAnnotation() {
    const img = this.state.shuffledImages[this.state.currentIndex];
    const rankings = {};
    document.querySelectorAll("#responseCards .rank-select").forEach(sel => {
      rankings[sel.dataset.source] = parseInt(sel.value);
    });
    this.state.annotations[img.path] = {
      rankings,
      comment: document.getElementById("commentBox").value.trim()
    };
    this.saveSession();
  },

  goNext() {
    if (!this.validateRanks()) {
      document.getElementById("validationError").classList.add("show");
      return;
    }
    document.getElementById("validationError").classList.remove("show");
    this.saveCurrentAnnotation();
    if (this.state.currentIndex === 34) {
      this.submitToBackend();
      this.showResults();
    } else {
      this.renderImage(this.state.currentIndex + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  },

  goPrev() {
    if (this.state.currentIndex > 0) {
      this.saveCurrentAnnotation();
      this.renderImage(this.state.currentIndex - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  },

  // ─── Lightbox ───
  bindLightbox() {
    const lb = document.getElementById("lightbox");
    document.addEventListener("click", (e) => {
      if (e.target.id === "annotationImage") {
        document.getElementById("lightboxImg").src = e.target.src;
        lb.classList.add("active");
      }
    });
    lb.addEventListener("click", () => lb.classList.remove("active"));
  },

  // ─── Results ───
  showResults() {
    this.showScreen("results");
    const tbody = document.getElementById("resultsBody");
    tbody.innerHTML = "";

    this.state.shuffledImages.forEach((img, i) => {
      const ann = this.state.annotations[img.path] || { rankings: {} };
      const fn = img.path.split("/").pop();
      const r = ann.rankings;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td title="${fn}">${fn.substring(0, 30)}…</td>
        <td>${img.category}</td>
        <td class="rank-cell rank-${r.Gemini || "-"}">${r.Gemini || "-"}</td>
        <td class="rank-cell rank-${r.OurModel || "-"}">${r.OurModel || "-"}</td>
        <td class="rank-cell rank-${r.Llama || "-"}">${r.Llama || "-"}</td>
        <td class="rank-cell rank-${r.MedGemma || "-"}">${r.MedGemma || "-"}</td>
        <td>${ann.comment || ""}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  async submitToBackend() {
    try {
      const data = this.buildExportData();
      data.annotator_id = this.state.annotatorId || "Unknown";
      await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      console.log("Successfully saved to database");
    } catch (e) {
      console.error("Failed to submit to backend", e);
    }
  },

  buildExportData() {
    return {
      session_id: this.state.sessionId,
      completed_at: new Date().toISOString(),
      annotations: this.state.shuffledImages.map((img, i) => {
        const ann = this.state.annotations[img.path] || { rankings: {}, comment: "" };
        const responses = this.state.allResponses[img.path] || {};
        return {
          image_index: i + 1,
          image_path: img.path,
          true_category: img.category,
          letter_mapping: this.state.letterMappings[img.path],
          rankings: ann.rankings,
          responses,
          comment: ann.comment
        };
      })
    };
  },

  downloadJSON() {
    const data = this.buildExportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    this.downloadBlob(blob, `fracture_annotations_${this.state.sessionId.slice(0, 8)}.json`);
  },

  downloadCSV() {
    const data = this.buildExportData();
    let csv = "image_index,image_filename,true_category,rank_Gemini,rank_OurModel,rank_Llama,rank_MedGemma,comment\n";
    data.annotations.forEach(a => {
      const fn = a.image_path.split("/").pop();
      const comment = `"${(a.comment || "").replace(/"/g, '""')}"`;
      csv += `${a.image_index},${fn},${a.true_category},${a.rankings.Gemini || ""},${a.rankings.OurModel || ""},${a.rankings.Llama || ""},${a.rankings.MedGemma || ""},${comment}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    this.downloadBlob(blob, `fracture_annotations_${this.state.sessionId.slice(0, 8)}.csv`);
  },

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // ─── Session Persistence ───
  saveSession() {
    const save = {
      sessionId: this.state.sessionId,
      annotatorId: this.state.annotatorId,
      currentIndex: this.state.currentIndex,
      annotations: this.state.annotations,
      letterMappings: this.state.letterMappings,
      allResponses: this.state.allResponses,
      shuffledPaths: this.state.shuffledImages.map(i => i.path),
      timestamp: Date.now()
    };
    try { localStorage.setItem("fracture_annotation_session", JSON.stringify(save)); } catch (e) {}
  },

  checkResume() {
    try {
      const raw = localStorage.getItem("fracture_annotation_session");
      if (!raw) return false;
      const save = JSON.parse(raw);
      const age = Date.now() - (save.timestamp || 0);
      if (age > 86400000) { localStorage.removeItem("fracture_annotation_session"); return false; }

      const modal = document.getElementById("resumeModal");
      const countEl = document.getElementById("resumeCount");
      const completed = Object.keys(save.annotations || {}).length;
      countEl.textContent = `${completed} / 35 images annotated`;
      modal.classList.add("active");

      document.getElementById("resumeYes").onclick = () => {
        modal.classList.remove("active");
        this.state.sessionId = save.sessionId;
        this.state.annotatorId = save.annotatorId || "";
        if (this.state.annotatorId) {
          const el = document.getElementById("annotatorIdInput");
          if (el) el.value = this.state.annotatorId;
        }
        this.state.annotations = save.annotations || {};
        this.state.letterMappings = save.letterMappings || {};
        this.state.allResponses = save.allResponses || {};
        // Restore shuffle order
        this.state.shuffledImages = save.shuffledPaths.map(p => IMAGE_LIST.find(i => i.path === p)).filter(Boolean);
        this.loadImagesAndStart(true);
      };
      document.getElementById("resumeNo").onclick = () => {
        modal.classList.remove("active");
        localStorage.removeItem("fracture_annotation_session");
        // User stays on welcome screen to enter name
      };
      return true;
    } catch (e) {
      return false;
    }
  },

  // ─── Screen Management ───
  showScreen(name) {
    document.querySelectorAll(".screen, .welcome-screen, .loading-screen, .annotation-screen, .results-screen, .landing-screen")
      .forEach(el => { el.classList.remove("active"); el.style.opacity = ""; });
    const map = {
      landing: "landingScreen",
      welcome: "welcomeScreen",
      loading: "loadingScreen",
      annotation: "annotationScreen",
      results: "resultsScreen"
    };
    const el = document.getElementById(map[name]);
    if (el) el.classList.add("active");
    // Show/hide the top app header (hidden on landing)
    const header = document.getElementById("appHeader");
    if (header) header.style.display = name === "landing" ? "none" : "flex";
    // Show/hide annotation progress bar
    const progressBar = document.querySelector(".header-progress");
    if (progressBar) progressBar.style.display = name === "annotation" ? "flex" : "none";
  }
};

// Boot
document.addEventListener("DOMContentLoaded", () => APP.init());
