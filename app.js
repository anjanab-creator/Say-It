// SAY IT. v3

const BTN_STAGES = [
  "Untangling thoughts\u2026",
  "Finding your voice\u2026",
  "Carrying your emotional furniture\u2026",
  "Here\u2019s what to say."
];

// Rotating microcopy for the subheadline
const TAGLINES = [
  "because ghosting isn\u2019t a long-term strategy",
  "before you accidentally agree to another brunch",
  "your future self says thanks",
  "boundaries are cheaper than resentment",
  "say it. mean it. log off.",
  "for the conversation you\u2019ve been rehearsing in the shower",
];

let selectedCard = null;

document.addEventListener("DOMContentLoaded", () => {
  // rotate tagline on load
  const sub = document.querySelector(".header-sub");
  if (sub) {
    sub.textContent = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
  }

  document.getElementById("situation").addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") generateScripts();
  });
});

async function generateScripts() {
  const situation = document.getElementById("situation").value.trim();
  const goal      = document.getElementById("goal").value;
  const length    = document.getElementById("length").value;

  if (!situation) { shakeField("situation"); return; }
  if (!goal)      { shakeField("goal");      return; }
  if (!length)    { shakeField("length");    return; }

  selectedCard = null;
  setLoading(true);
  await runBtnAnimation();

  try {
    const res = await fetch("/.netlify/functions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ situation, goal, length }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Server error " + res.status);
    }

    const data = await res.json();
    renderScripts(data.scripts);
  } catch (err) {
    showError(err.message || "Something went wrong. Please try again.");
  } finally {
    setLoading(false);
    resetBtn();
  }
}

function runBtnAnimation() {
  return new Promise(resolve => {
    const label = document.getElementById("btnLabel");
    let i = 0;
    const interval = 750;

    const tick = () => {
      label.style.opacity = "0";
      setTimeout(() => {
        label.textContent = BTN_STAGES[i];
        label.style.opacity = "1";
        i++;
        if (i < BTN_STAGES.length) {
          setTimeout(tick, interval);
        } else {
          setTimeout(resolve, 500);
        }
      }, 200);
    };

    tick();
  });
}

function resetBtn() {
  const label = document.getElementById("btnLabel");
  label.style.opacity = "0";
  setTimeout(() => {
    label.textContent = "Generate My Scripts";
    label.style.opacity = "1";
  }, 200);
}

function renderScripts(scripts) {
  const empty  = document.getElementById("resultsEmpty");
  const loaded = document.getElementById("resultsLoaded");
  const stack  = document.getElementById("cardsStack");

  const tones = [
    { key: "gentle", label: "gentle" },
    { key: "direct", label: "direct" },
    { key: "firm",   label: "firm"   },
  ];

  stack.innerHTML = tones.map((t, i) => `
    <div
      class="script-card ${t.key}"
      id="card-${t.key}"
      onclick="selectCard('${t.key}')"
      style="animation-delay: ${i * 0.08}s"
      role="button"
      tabindex="0"
      aria-label="${t.label} script"
      onkeydown="if(event.key==='Enter'||event.key===' ')selectCard('${t.key}')"
    >
      <div class="card-top">
        <span class="card-tone">${t.label}</span>
        <span class="card-check">✓ this feels right</span>
      </div>
      <p class="card-script" id="script-${t.key}">${escapeHtml(scripts[t.key] || "")}</p>
    </div>
  `).join("");

  empty.style.display  = "none";
  loaded.style.display = "flex";
  document.getElementById("floatingCopy").style.display = "none";
}

function selectCard(key) {
  selectedCard = key;
  document.querySelectorAll(".script-card").forEach(c => c.classList.remove("selected"));
  document.getElementById("card-" + key).classList.add("selected");
  document.getElementById("floatingCopy").style.display = "block";
}

function copySelected() {
  if (!selectedCard) return;
  const el = document.getElementById("script-" + selectedCard);
  if (!el) return;

  navigator.clipboard.writeText(el.textContent.trim()).then(() => {
    document.getElementById("copyBtnLabel").textContent = "copied \u2713";
    document.getElementById("toast").classList.add("show");
    setTimeout(() => {
      document.getElementById("copyBtnLabel").textContent = "copy selected script";
      document.getElementById("toast").classList.remove("show");
    }, 2000);
  });
}

function setLoading(on) {
  document.getElementById("generateBtn").disabled = on;
}

function showError(msg) {
  const label = document.getElementById("btnLabel");
  const btn   = document.getElementById("generateBtn");
  label.style.opacity = "0";
  setTimeout(() => {
    label.textContent = "\u26A0 " + msg;
    label.style.opacity = "1";
  }, 200);
  btn.style.background = "#b06060";
  btn.disabled = false;
  setTimeout(() => {
    btn.style.background = "";
    resetBtn();
  }, 4000);
}

function shakeField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.animation = "none";
  void el.offsetHeight;
  el.style.animation = "shake 0.38s ease";
  el.focus();
  if (!document.getElementById("shakeKf")) {
    const s = document.createElement("style");
    s.id = "shakeKf";
    s.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}`;
    document.head.appendChild(s);
  }
  setTimeout(() => el.style.animation = "", 500);
}

function escapeHtml(s) {
  return s
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}
