// UI-only frontend: send prompt to backend, receive { html, css, js }, populate editors and previews.

const promptInput = document.getElementById("promptInput");
const generateBtn = document.getElementById("generateBtn");
const statusEl = document.getElementById("status");

const htmlInput = document.getElementById("htmlInput");
const cssInput  = document.getElementById("cssInput");
const jsInput   = document.getElementById("jsInput");

const htmlPreview = document.getElementById("htmlPreview");
const cssPreview  = document.getElementById("cssPreview");
const jsPreview   = document.getElementById("jsPreview");

// Safe iframe writer
function writeIframe(iframe, content) {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(content);
    doc.close();
  } catch (e) {
    console.error("iframe write failed:", e);
  }
}

// Build a small HTML document combining produced HTML + CSS + JS
function buildFullDocument(html, css, js) {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <style>${css || ""}</style>
    </head>
    <body>
      ${html || ""}
      <script>
        try {
          ${js || ""}
        } catch(e) { console.error(e) }
      </script>
    </body>
  </html>`;
}

// Update previews from current editor contents (for manual edits)
function updatePreviews() {
  // HTML preview: show HTML fragment inside minimal doc
  writeIframe(htmlPreview, buildFullDocument(htmlInput.value, cssInput.value, "")); // HTML + CSS applied, no JS
  // CSS preview: show a demo wrapper with CSS applied
  writeIframe(cssPreview, buildFullDocument("<div class='rebuild-demo'>CSS preview</div>", cssInput.value, ""));
  // JS preview: run JS inside isolated wrapper
  writeIframe(jsPreview, buildFullDocument("<div id='rebuild-js-root'></div>", "", jsInput.value));
}

// Handle response from backend { html, css, js }
function applyGenerated(result) {
  htmlInput.value = result.html ?? "";
  cssInput.value  = result.css  ?? "";
  jsInput.value   = result.js   ?? "";
  updatePreviews();
}

// Error helper
function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "crimson" : "";
}

// Send prompt to backend
async function generate() {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    setStatus("Please enter a prompt.", true);
    return;
  }

  generateBtn.disabled = true;
  setStatus("Generating…");

  try {
    const resp = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("Backend error:", data);
      setStatus("Generation failed. See console.", true);
      return;
    }

    // Expect { html, css, js }
    if (!data || (typeof data.html === "undefined" && typeof data.css === "undefined" && typeof data.js === "undefined")) {
      console.warn("Unexpected response shape:", data);
      setStatus("Unexpected response from server. See console.", true);
      return;
    }

    applyGenerated(data);
    setStatus("Generated — editors updated.");
  } catch (err) {
    console.error("Request failed:", err);
    setStatus("Network or server error. See console.", true);
  } finally {
    generateBtn.disabled = false;
  }
}

// Wire UI
generateBtn.addEventListener("click", generate);

// live-update previews when user edits editors
htmlInput.addEventListener("input", updatePreviews);
cssInput.addEventListener("input", updatePreviews);
jsInput.addEventListener("input", updatePreviews);

// initial empty previews
updatePreviews();
console.log("UI ready — will POST prompt to /api/generate and expect {html, css, js}");
