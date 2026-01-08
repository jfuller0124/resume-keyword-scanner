// pdf_loader.js (ESM) - loaded before popup.js
(async () => {
  try {
    const pdfjs = await import("./lib/pdf.mjs");
    window.pdfjsLib = pdfjs;
    console.log("PDF.js loaded in popup ✅", !!window.pdfjsLib);
  } catch (e) {
    console.error("Failed to load PDF.js in popup ❌", e);
  }
})();
