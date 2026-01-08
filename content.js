// content.js
// Extracts visible page text. This is intentionally simple for the MVP.

function getVisibleText() {
  // Try common job description containers first (best-effort).
  const selectors = [
    "[data-test='job-description']",
    ".job-description",
    ".description__text",
    ".show-more-less-html__markup", // LinkedIn often uses this
    "#jobDescriptionText",
    "article",
    "main"
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText && el.innerText.trim().length > 200) {
      return el.innerText;
    }
  }

  // Fallback: entire body text
  return document.body ? document.body.innerText : "";
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "GET_PAGE_TEXT") {
    const text = getVisibleText();
    sendResponse({ ok: true, text });
  }
  // Return true if you plan async sendResponse (not needed here)
});
