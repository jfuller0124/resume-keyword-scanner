// utils.js
// Pure functions used by popup.js
// Safe for MV3 + Chrome: avoids Unicode property escapes (\p{L}) and avoids expensive regex.

const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","else","when","while","of","to","in","on","for","with","at","by","from",
  "as","is","are","was","were","be","been","being","it","this","that","these","those","you","your","we","our","they",
  "their","i","me","my","us","will","can","may","might","should","must","not","no","yes","do","does","did","done",
  "up","down","into","out","over","under","more","most","less","least","very","also","than","such","etc",
  "about","across","after","before","during","within","without","per","each","every","today","role","work","team",
  "experience","including","build","building","support","mission"
]);

// Common tech phrases to detect (you can add more later)
const PHRASES = [
  "unit testing",
  "test driven development",
  "tdd",
  "ci/cd",
  "continuous integration",
  "continuous deployment",
  "rest api",
  "api design",
  "microservices",
  "data pipeline",
  "data pipelines",
  "machine learning",
  "deep learning",
  "real time",
  "real-time",
  "linux",
  "docker",
  "kubernetes",
  "aws",
  "gcp",
  "azure",
  "postgresql",
  "mysql",
  "nosql",
  "javascript",
  "typescript",
  "python",
  "c++",
  "c#",
  "java",
  "git",
  "fastapi",
  "flask",
  "react",
  "node.js",
  "websockets",
  "tcp",
  "udp",
  "data structures",
  "algorithms"
];

// Keep only safe characters for matching:
// letters a-z, digits, space, and a few tech symbols: # + . / -
// (No Unicode \p{} to avoid Chrome regex issues)
function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    // replace anything NOT in this whitelist with space
    // NOTE: put '-' at the end so it doesn't behave like a range
    .replace(/[^a-z0-9#+./\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeWords(s) {
  const t = normalizeText(s);
  if (!t) return [];

  const raw = t.split(" ");
  const words = [];

  for (const w of raw) {
    if (!w) continue;

    // keep short tech tokens
    const isTechShort = (w === "c" || w === "r" || w === "go");

    // filter tiny noise
    if (!isTechShort && w.length < 2) continue;

    if (STOPWORDS.has(w)) continue;

    // ignore pure numbers
    if (/^\d+$/.test(w)) continue;

    words.push(w);
  }

  return words;
}

function countWords(words) {
  const m = new Map();
  for (const w of words) m.set(w, (m.get(w) || 0) + 1);
  return m;
}

function detectPhrases(text) {
  const t = normalizeText(text);
  const found = new Map();

  for (const p of PHRASES) {
    const pn = normalizeText(p);
    if (!pn) continue;

    // simple containment; fast and stable
    if (t.includes(pn)) {
      found.set(pn, (found.get(pn) || 0) + 1);
    }
  }

  return found;
}

// Build keyword candidates from job description
// Returns Map<keyword, weight>
function extractJobKeywords(jobText) {
  // Cap size so someone pasting a whole page dump won't freeze the popup
  const limited = (jobText || "").slice(0, 20000);

  const words = tokenizeWords(limited);
  const wordCounts = countWords(words);
  const phraseCounts = detectPhrases(limited);

  // Merge into one map with weights (phrases heavier)
  const combined = new Map();

  for (const [w, c] of wordCounts.entries()) {
    // Weight by count but cap
    const weight = Math.min(3, c) * 1.0;
    combined.set(w, (combined.get(w) || 0) + weight);
  }

  for (const [p, c] of phraseCounts.entries()) {
    const weight = Math.min(2, c) * 3.0; // phrases are more important
    combined.set(p, (combined.get(p) || 0) + weight);
  }

  return combined;
}

function scoreMatch(jobKeywordWeights, resumeText) {
  const resumeLimited = (resumeText || "").slice(0, 40000);

  const resumeNorm = normalizeText(resumeLimited);
  const resumeWords = tokenizeWords(resumeLimited);
  const resumeSet = new Set(resumeWords);

  const totalWeight = Array.from(jobKeywordWeights.values()).reduce((a, b) => a + b, 0) || 1;

  let matchedWeight = 0;
  const missing = [];
  const found = [];

  for (const [k, w] of jobKeywordWeights.entries()) {
    const isPhrase = k.includes(" ");
    const hit = isPhrase ? resumeNorm.includes(k) : resumeSet.has(k);

    if (hit) {
      matchedWeight += w;
      found.push({ k, w });
    } else {
      missing.push({ k, w });
    }
  }

  missing.sort((a, b) => b.w - a.w);
  found.sort((a, b) => b.w - a.w);

  const score = Math.round((matchedWeight / totalWeight) * 100);

  return {
    score,
    missingTop: missing.slice(0, 15),
    foundTop: found.slice(0, 15)
  };
}
