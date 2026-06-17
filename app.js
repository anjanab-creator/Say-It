async function generateScripts() {
  const situation = document.getElementById("situation").value.trim();
  const relationship = document.getElementById("relationship").value;
  const goal = document.getElementById("goal").value;

  if (!situation) { shakeField("situation"); return; }
  if (!relationship) { shakeField("relationship"); return; }
  if (!goal) { shakeField("goal"); return; }

  setLoading(true);

  try {
    const response = await fetch("/.netlify/functions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ situation, relationship, goal }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Server error: " + response.status);
    }

    const data = await response.json();
    renderScripts(data.scripts);
  } catch (err) {
    showError(err.message || "Something went wrong. Please try again.");
  } finally {
    setLoading(false);
  }
}

function renderScripts(scripts) {
  const section = document.getElementById("resultsSection");
  const grid = document.getElementById("scriptsGrid");

  const tones = [
    { key: "gentle", label: "Gentle", title: "Kind & warm", description: "Preserves the relationship. Good for people you care about or ongoing dynamics.", delay: "0s" },
    { key: "direct", label: "Direct", title: "Clear & confident", description: "No waffle, no apology tour. Respectful but unmistakably clear.", delay: "0.1s" },
    { key: "firm",   label: "Firm",   title: "Strong & final",  description: "For when it's not the first time — or when you need them to really hear you.", delay: "0.2s" },
  ];

  grid.innerHTML = tones.map(tone => `
    <div class="script-card ${tone.key}" style="animation: fadeUp 0.4s ease both; animation-delay: ${tone.delay}">
      <div class="card-tone">
        <span class="tone-dot"></span>
        <span class="tone-label">${tone.label}</span>
      </div>
      <div class="card-title">${tone.title}</div>
      <p class="card-description">${tone.description}</p>
      <p class="card-script" id="script-${tone.key}">${escapeHtml(scripts[tone.key] || "")}</p>
      <button class="copy-btn" onclick="copyScript('${tone.key}')">Copy</button>
    </div>
  `).join("");

  section.style.display = "block";
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function copyScript(key) {
  const el = document.getElementById("script-" + key);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent.trim()).then(showToast);
}

function showToast() {
  const t = document.getElementById("toast");
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

function resetForm() {
  document.getElementById("resultsSection").style.display = "none";
  document.getElementById("situation").value = "";
  document.getElementById("relationship").value = "";
  document.getElementById("goal").value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setLoading(isLoading) {
  const btn = document.getElementById("generateBtn");
  btn.disabled = isLoading;
  btn.querySelector(".btn-text").style.display = isLoading ? "none" : "inline";
  btn.querySelector(".btn-loader").style.display = isLoading ? "flex" : "none";
}

function showError(message) {
  const btn = document.getElementById("generateBtn");
  btn.querySelector(".btn-text").textContent = "⚠ " + message;
  btn.querySelector(".btn-text").style.display = "inline";
  btn.style.background = "#b87070";
  btn.disabled = false;
  setTimeout(() => {
    btn.querySelector(".btn-text").textContent = "Generate my scripts";
    btn.style.background = "";
  }, 4000);
}

function shakeField(id) {
  const el = document.getElementById(id);
  el.style.animation = "none";
  el.offsetHeight;
  el.style.animation = "shake 0.4s ease";
  el.focus();
  setTimeout(() => el.style.animation = "", 500);
  if (!document.getElementById("shakeStyle")) {
    const s = document.createElement("style");
    s.id = "shakeStyle";
    s.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}`;
    document.head.appendChild(s);
  }
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("situation").addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") generateScripts();
  });
});
