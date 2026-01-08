// popup.js
const elResume = document.getElementById("resumeText");
const elJob = document.getElementById("jobText");
const elSave = document.getElementById("saveResume");
const elClear = document.getElementById("clearResume");
const elAnalyzePasted = document.getElementById("analyzePasted");
const elClearJob = document.getElementById("clearJob");
const elOpenApp = document.getElementById("openApp");

const elResumeStatus = document.getElementById("resumeStatus");
const elScanStatus = document.getElementById("scanStatus");

const elScore = document.getElementById("matchScore");
const elMissing = document.getElementById("missingList");
const elFound = document.getElementById("foundList");
const elCopyMissing = document.getElementById("copyMissing");

const elResumeFile = document.getElementById("resumeFile");
const elLoadResumeFile = document.getElementById("loadResumeFile");

const elApiUrl = document.getElementById("apiUrl");
const elOcrExtract = document.getElementById("ocrExtract");

let lastMissingKeywords = [];

/* ---------------------------
   Helpers
---------------------------- */
function setStatus(el, msg) {
  el.textContent = msg || "";
}

function renderList(ul, items) {
  ul.innerHTML = "";
  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "—";
    li.style.color = "#9aa0a6";
    ul.appendChild(li);
    return;
  }
  for (const it of items) {
    const li = document.createElement("li");
    li.textContent = it.k;
    ul.appendChild(li);
  }
}

function clearResultsUI() {
  elScore.textContent = "—";
  elMissing.innerHTML = "";
  elFound.innerHTML = "";
  lastMissingKeywords = [];
}

function renderResults(res) {
  elScore.textContent = `${res.score}%`;
  lastMissingKeywords = (res.missingTop || []).map(x => x.k);
  renderList(elMissing, res.missingTop);
  renderList(elFound, res.foundTop);
}

/* ---------------------------
   Resume handling
---------------------------- */
async function loadResume() {
  const data = await chrome.storage.local.get(["resumeText"]);
  if (data.resumeText) {
    elResume.value = data.resumeText;
    setStatus(elResumeStatus, "Resume loaded from storage.");
  } else {
    setStatus(elResumeStatus, "Upload a PDF or paste resume text, then Save.");
  }
}

async function saveResume() {
  const resumeText = elResume.value.trim();
  if (!resumeText) {
    setStatus(elResumeStatus, "Nothing to save.");
    return;
  }
  await chrome.storage.local.set({ resumeText });
  setStatus(elResumeStatus, "Saved ✅");
}

async function clearResume() {
  await chrome.storage.local.remove(["resumeText"]);
  elResume.value = "";
  setStatus(elResumeStatus, "Cleared.");
  clearResultsUI();
}

/* ---------------------------
   Job description
---------------------------- */
function clearJobDescription() {
  elJob.value = "";
  setStatus(elScanStatus, "Job description cleared.");
  clearResultsUI();
}

async function analyzePastedJD() {
  setStatus(elScanStatus, "Analyzing job description…");
  const text = elJob.value.trim();

  if (text.length < 50) {
    setStatus(elScanStatus, "Paste a job description first (50+ chars).");
    return;
  }

  await analyzeJobText(text.slice(0, 20000));
  setStatus(elScanStatus, "Done ✅");
}

async function analyzeJobText(jobText) {
  const data = await chrome.storage.local.get(["resumeText"]);
  const resumeText = (data.resumeText || "").trim();

  if (!resumeText) {
    setStatus(elScanStatus, "No resume saved. Upload a PDF or paste + Save first.");
    return;
  }

  const jobKeywords = extractJobKeywords(jobText);
  const res = scoreMatch(jobKeywords, resumeText);
  renderResults(res);
}

/* ---------------------------
   PDF.js text extraction
---------------------------- */
async function extractTextFromPdf(file) {
  if (!window.pdfjsLib) {
    throw new Error("pdfjsLib not loaded yet.");
  }

  const pdfjsLib = window.pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    chrome.runtime.getURL("lib/pdf.worker.mjs");

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    disableAutoFetch: true,
    disableStream: true
  }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent({ normalizeWhitespace: true });
    fullText += content.items.map(it => it.str || "").join(" ") + "\n";
  }
  return fullText;
}

async function loadResumeFromPdfText() {
  const file = elResumeFile.files?.[0];
  if (!file) return setStatus(elResumeStatus, "Choose a PDF first.");

  try {
    setStatus(elResumeStatus, `Reading ${file.name}…`);
    const text = (await extractTextFromPdf(file)).trim();

    if (text.length < 80) {
      setStatus(elResumeStatus, "Use OCR Extract for scanned PDFs.");
      return;
    }

    elResume.value = text.slice(0, 20000);
    await chrome.storage.local.set({ resumeText: elResume.value });
    setStatus(elResumeStatus, "Resume loaded & saved ✅");
    clearResultsUI();
  } catch (err) {
    console.error(err);
    setStatus(elResumeStatus, "Failed to read PDF.");
  }
}

/* ---------------------------
   OCR API
---------------------------- */
async function loadApiUrl() {
  const data = await chrome.storage.local.get(["ocrApiUrl"]);
  elApiUrl.value = data.ocrApiUrl || "http://127.0.0.1:8000";
}

async function saveApiUrl() {
  const url = elApiUrl.value.trim();
  if (url) await chrome.storage.local.set({ ocrApiUrl: url });
}

async function ocrExtractResume() {
  const file = elResumeFile.files?.[0];
  if (!file) return setStatus(elResumeStatus, "Choose a PDF first.");

  const baseUrl = elApiUrl.value.trim().replace(/\/+$/, "");
  if (!baseUrl) return setStatus(elResumeStatus, "Enter OCR API URL.");

  await saveApiUrl();

  try {
    setStatus(elResumeStatus, "Uploading PDF…");
    const form = new FormData();
    form.append("file", file);

    const resp = await fetch(`${baseUrl}/extract`, { method: "POST", body: form });
    const data = await resp.json();

    if (!resp.ok || !data?.ok) {
      setStatus(elResumeStatus, "OCR failed.");
      return;
    }

    elResume.value = data.text.slice(0, 20000);
    await chrome.storage.local.set({ resumeText: elResume.value });
    setStatus(elResumeStatus, "OCR extract saved ✅");
    clearResultsUI();
  } catch (err) {
    console.error(err);
    setStatus(elResumeStatus, "OCR error.");
  }
}

/* ---------------------------
   Copy missing (with feedback)
---------------------------- */
async function copyMissing() {
  if (!lastMissingKeywords.length) return;

  await navigator.clipboard.writeText(lastMissingKeywords.join("\n"));

  const original = elCopyMissing.textContent;
  elCopyMissing.textContent = "Copied ✓";
  elCopyMissing.classList.add("copied");

  setTimeout(() => {
    elCopyMissing.textContent = original;
    elCopyMissing.classList.remove("copied");
  }, 1500);
}

/* ---------------------------
   Auto-clear stale results
---------------------------- */
elJob.addEventListener("input", () => {
  clearResultsUI();
  setStatus(elScanStatus, "Edited — click Analyze JD");
});

elResume.addEventListener("input", () => {
  clearResultsUI();
  setStatus(elResumeStatus, "Edited — click Save Resume");
});

/* ---------------------------
   Events + init
---------------------------- */
elSave.addEventListener("click", saveResume);
elClear.addEventListener("click", clearResume);
elAnalyzePasted.addEventListener("click", analyzePastedJD);
elClearJob.addEventListener("click", clearJobDescription);
elCopyMissing.addEventListener("click", copyMissing);
elLoadResumeFile.addEventListener("click", loadResumeFromPdfText);
elOcrExtract.addEventListener("click", ocrExtractResume);

if (elOpenApp) {
  elOpenApp.addEventListener("click", () =>
    chrome.runtime.sendMessage({ type: "OPEN_APP_WINDOW" })
  );
}

loadResume();
loadApiUrl();
