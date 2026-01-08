// debug.js (ESM)
// This file is loaded by debug.html via <script type="module" src="debug.js"></script>

const out = document.getElementById("out");
const details = document.getElementById("details");
const btn = document.getElementById("check");

function show(msg) {
  out.textContent = msg;
}
function showDetails(msg) {
  details.textContent = msg;
}

(async () => {
  try {
    console.log("debug.js running ✅");

    // Import PDF.js ESM build
    const pdfjs = await import("./lib/pdf.mjs");

    // Expose it globally for compatibility with popup.js code
    window.pdfjsLib = pdfjs;

    const ok = !!window.pdfjsLib;
    show(`PDF.js loaded: ${ok}`);

    const version = pdfjs?.version || "(unknown)";
    showDetails(`pdfjsLib exists: ${ok} | version: ${version} | worker: lib/pdf.worker.mjs`);

    btn.addEventListener("click", () => {
      console.log("Button clicked ✅");
      show(`PDF.js loaded: ${!!window.pdfjsLib}`);
      showDetails(`pdfjsLib exists: ${!!window.pdfjsLib} | version: ${pdfjs?.version || "(unknown)"}`);
    });
  } catch (err) {
    console.error("PDF.js load failed ❌", err);
    show("PDF.js loaded: false");
    showDetails("Error: " + (err?.message || String(err)));
  }
})();
