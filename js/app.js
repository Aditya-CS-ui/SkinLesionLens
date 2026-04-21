
const API_URL = "http://localhost:5000/predict";

const auth = sessionStorage.getItem("nd_auth");
if (!auth) {
  window.location.href = "login.html";
}
const isGuest = auth === "guest";
document.body.style.opacity = "1";

if (isGuest) {
  const uploadCard = document.querySelector('.main-grid .card');
  if (uploadCard) {
    uploadCard.style.display = 'none';
  }
}

const CLASSES = [
  {
    name:"Melanocytic Nevi", code:"nv", color:"#00ff88", risk:"low",
    short:"Common benign moles. Usually harmless — monitor for ABCDE changes.",
    discoveredBy:"Wallace H. Clark Jr.", discoveredYear:"1969", icdCode:"D22",
    casesPerYear:[{year:"2018",val:62},{year:"2019",val:65},{year:"2020",val:61},{year:"2021",val:68},{year:"2022",val:70},{year:"2023",val:72},{year:"2024",val:75}],
    overview:"Melanocytic nevi (moles) are benign proliferations of melanocytes. Extremely common — most adults have 10–40 moles. Generally harmless but warrant regular monitoring with the ABCDE rule.",
    symptoms:"Round or oval spots, smooth edges, even color from pink to dark brown. Typically under 6 mm. May be flat or raised. Uniform pigmentation throughout.",
    treatment:"No treatment required. Suspicious nevi can be surgically excised. Annual dermatologist check-ups and monthly self-exams recommended.",
    tags:["Common","Benign","Sun protection","Monitor changes"],
    alert:{level:"low", text:"✅ Generally benign. Monitor for ABCDE changes and consult a dermatologist annually."}
  },
  {
    name:"Melanoma", code:"mel", color:"#ff3366", risk:"high",
    short:"Most dangerous skin cancer. Immediate medical attention required.",
    discoveredBy:"René Laennec", discoveredYear:"1804", icdCode:"C43",
    casesPerYear:[{year:"2018",val:287},{year:"2019",val:300},{year:"2020",val:295},{year:"2021",val:325},{year:"2022",val:331},{year:"2023",val:340},{year:"2024",val:352}],
    overview:"Melanoma is the most serious form of skin cancer. It can spread rapidly if not caught early. Stage 1 survival rates exceed 95% — early detection is critical.",
    symptoms:"Asymmetric lesions with irregular borders. Color variation: brown, black, red, white, or blue within one lesion. Often >6mm. May bleed, itch, or crust.",
    treatment:"Surgical excision is primary. Advanced cases may require immunotherapy, targeted therapy (BRAF/MEK inhibitors), or radiation.",
    tags:["Malignant","Urgent care","Biopsy needed","Spreads rapidly"],
    alert:{level:"high", text:"🚨 HIGH RISK — Seek immediate dermatologist consultation. Do not delay."}
  },
  {
    name:"Actinic Keratosis", code:"akiec", color:"#ffb800", risk:"moderate",
    short:"Pre-cancerous rough skin patch from UV damage. Treatable early.",
    discoveredBy:"Ferdinand von Hebra", discoveredYear:"1860", icdCode:"L57.0",
    casesPerYear:[{year:"2018",val:414},{year:"2019",val:430},{year:"2020",val:410},{year:"2021",val:445},{year:"2022",val:460},{year:"2023",val:472},{year:"2024",val:490}],
    overview:"Actinic keratosis is a rough, scaly patch caused by years of UV exposure. Pre-cancerous — 5–10% of untreated AKs progress to squamous cell carcinoma.",
    symptoms:"Rough, dry, scaly patch, typically <2.5cm. Pink to red to brown. May itch, burn, or feel tender. Common on sun-exposed areas.",
    treatment:"Cryotherapy, topical 5-fluorouracil or imiquimod, photodynamic therapy, laser resurfacing, or chemical peels.",
    tags:["Pre-cancerous","UV damage","Treatable","Sun-exposed areas"],
    alert:{level:"moderate", text:"⚠ MODERATE RISK — Schedule a dermatologist appointment for evaluation."}
  },
  {
    name:"Basal Cell Carcinoma", code:"bcc", color:"#ff3366", risk:"high",
    short:"Most common skin cancer. Rarely spreads but needs prompt treatment.",
    discoveredBy:"Arthur Jacob", discoveredYear:"1827", icdCode:"C44",
    casesPerYear:[{year:"2018",val:3300},{year:"2019",val:3450},{year:"2020",val:3290},{year:"2021",val:3600},{year:"2022",val:3720},{year:"2023",val:3800},{year:"2024",val:3950}],
    overview:"Basal cell carcinoma is the most common skin cancer. Rarely metastasizes but causes significant local destruction if untreated. Highly curable when caught early.",
    symptoms:"Pearly or waxy bump with visible blood vessels. Bleeding or scabbing sore that heals and returns. Primarily on head, neck, and hands.",
    treatment:"Mohs surgery (gold standard), excision, cryotherapy, radiation, or topical treatments. Hedgehog pathway inhibitors for advanced cases.",
    tags:["Malignant","Most common","Locally destructive","Highly curable"],
    alert:{level:"high", text:"🚨 HIGH RISK — Consult a dermatologist promptly. BCC is highly treatable when caught early."}
  },
  {
    name:"Benign Keratosis", code:"bkl", color:"#00d2ff", risk:"low",
    short:"Non-cancerous skin growth including seborrheic keratoses and age spots.",
    discoveredBy:"Pierre Antoine Ernest Bazin", discoveredYear:"1857", icdCode:"L82",
    casesPerYear:[{year:"2018",val:830},{year:"2019",val:860},{year:"2020",val:840},{year:"2021",val:890},{year:"2022",val:910},{year:"2023",val:930},{year:"2024",val:955}],
    overview:"Benign keratosis includes seborrheic keratoses, solar lentigines, and lichen planus-like keratoses. Extremely common in older adults. Entirely benign.",
    symptoms:"Waxy, stuck-on appearance. Light tan to black. Usually round or oval. Rough, warty surface. Generally painless, may occasionally itch.",
    treatment:"No treatment necessary. Cosmetically bothersome lesions can be removed with cryotherapy, laser, or electrocautery.",
    tags:["Benign","Common","Age-related","No treatment needed"],
    alert:{level:"low", text:"✅ Benign and harmless. No urgent action required."}
  },
  {
    name:"Dermatofibroma", code:"df", color:"#00d2ff", risk:"low",
    short:"Benign fibrous skin nodule. Common and harmless, usually on legs.",
    discoveredBy:"Theodor Simon Flatau", discoveredYear:"1910", icdCode:"D23",
    casesPerYear:[{year:"2018",val:120},{year:"2019",val:124},{year:"2020",val:118},{year:"2021",val:127},{year:"2022",val:130},{year:"2023",val:133},{year:"2024",val:136}],
    overview:"Dermatofibroma is a common, benign fibrous nodule on the legs. Composed of fibroblasts, thought to be triggered by minor trauma. Entirely benign.",
    symptoms:"Small, firm bump 0.5–1.5 cm. Pink to brown to grey. Dimples inward when pinched (Fitzpatrick sign). May be slightly tender or itchy.",
    treatment:"No treatment required. Excision if painful or cosmetically bothersome, though this leaves a scar.",
    tags:["Benign","Fibrous nodule","Leg common","Pinch dimple sign"],
    alert:{level:"low", text:"✅ Benign and harmless. No treatment required unless symptomatic."}
  },
  {
    name:"Vascular Lesion", code:"vasc", color:"#00d2ff", risk:"moderate",
    short:"Abnormal blood vessel growths: hemangiomas, cherry angiomas, port-wine stains.",
    discoveredBy:"Rudolph Virchow", discoveredYear:"1863", icdCode:"D18",
    casesPerYear:[{year:"2018",val:190},{year:"2019",val:198},{year:"2020",val:185},{year:"2021",val:205},{year:"2022",val:211},{year:"2023",val:218},{year:"2024",val:224}],
    overview:"Vascular lesions are blood vessel abnormalities including cherry angiomas, spider angiomas, hemangiomas, and port-wine stains. Most are benign.",
    symptoms:"Red, purple, or bluish discoloration. May be flat or raised. Hemangiomas: bright red strawberry-like. Spider angiomas: central red spot with radiating vessels.",
    treatment:"Many require no treatment. Options: pulsed dye laser, sclerotherapy, cryotherapy, or surgical excision.",
    tags:["Blood vessel","Usually benign","Laser treatable","Monitor for bleeding"],
    alert:{level:"moderate", text:"⚠ Generally benign — consult a dermatologist to confirm type."}
  }
];

const chipsContainer = document.getElementById("class-chips");
if (chipsContainer) {
  CLASSES.forEach((cls, idx) => {
    const chip = document.createElement("div");
    chip.className = "class-chip";
    chip.innerHTML = `
      <div class="chip-header">
        <div class="chip-dot" style="background:${cls.color}"></div>
        <div class="chip-name">${cls.name}</div>
        <div class="chip-code">${cls.code}</div>
        <div class="chip-arrow">▶</div>
      </div>
      <div class="chip-body">
        <div class="chip-body-inner">
          <div class="chip-risk-badge ${cls.risk==="high"?"risk-high-b":cls.risk==="moderate"?"risk-moderate-b":"risk-low-b"}">
            ${cls.risk==="high"?"▲ high risk":cls.risk==="moderate"?"◆ moderate":"● low risk"}
          </div>
          <div class="chip-short">${cls.short}</div>
          <button class="learn-more-btn" onclick="openDetail(${idx})">📖 Learn more →</button>
        </div>
      </div>
    `;
    chipsContainer.appendChild(chip);
  });
}

function openDetail(idx) {
  const c = CLASSES[idx];
  document.getElementById("detail-breadcrumb-name").textContent = c.name;
  document.getElementById("d-eyebrow").textContent = "Diagnostic class · " + c.code.toUpperCase() + " · ICD " + c.icdCode;
  document.getElementById("d-title").textContent   = c.name;
  document.getElementById("d-subtitle").textContent = "HAM10000 category · EfficientNet-B3 classification";
  document.getElementById("d-meta").innerHTML = `
    <div class="risk-tag risk-${c.risk}"><div class="risk-dot"></div>${c.risk} risk</div>
    <div style="font-family:var(--mono);font-size:11px;color:var(--muted)">ICD-10: ${c.icdCode}</div>
  `;
  document.getElementById("d-discovery").innerHTML = `
    <div><div class="disc-item-label">First described by</div><div class="disc-item-val">${c.discoveredBy}</div><div class="disc-item-sub">Dermatologist / Pathologist</div></div>
    <div><div class="disc-item-label">Year discovered</div><div class="disc-item-val">${c.discoveredYear}</div><div class="disc-item-sub">Medical literature</div></div>
    <div><div class="disc-item-label">ICD-10 code</div><div class="disc-item-val">${c.icdCode}</div><div class="disc-item-sub">International classification</div></div>
  `;
  document.getElementById("d-overview").textContent   = c.overview;
  document.getElementById("d-symptoms").textContent   = c.symptoms;
  document.getElementById("d-treatment").textContent  = c.treatment;
  document.getElementById("d-tags").innerHTML = c.tags.map(t => `<span class="detail-tag">${t}</span>`).join("");
  const alertEl = document.getElementById("d-alert");
  alertEl.textContent = c.alert.text;
  alertEl.className   = "detail-alert " + c.alert.level;
  buildChart(c.casesPerYear);
  const overlay = document.getElementById("detail-overlay");
  overlay.classList.add("open");
  overlay.scrollTop = 0;
  document.body.style.overflow = "hidden";
}

function closeDetail() {
  document.getElementById("detail-overlay").classList.remove("open");
  document.body.style.overflow = "";
}

function buildChart(data) {
  const container = document.getElementById("d-chart");
  container.innerHTML = "";
  const maxVal = Math.max(...data.map(d => d.val));
  const chartH = 140;
  data.forEach(d => {
    const h = Math.round((d.val / maxVal) * chartH);
    const wrap = document.createElement("div");
    wrap.className = "chart-bar-wrap";
    wrap.innerHTML = `
      <div class="chart-bar-val">${d.val}k</div>
      <div class="chart-bar" style="height:0;width:100%" data-h="${h}px"></div>
      <div class="chart-bar-year">${d.year}</div>
    `;
    container.appendChild(wrap);
  });
  setTimeout(() => {
    container.querySelectorAll(".chart-bar").forEach(b => { b.style.height = b.dataset.h; });
  }, 120);
}

document.addEventListener("keydown", e => { if (e.key === "Escape") closeDetail(); });

const dropZone   = document.getElementById("drop-zone");
const fileInput  = document.getElementById("file-input");
const previewWrap = document.getElementById("preview-wrap");
const previewImg  = document.getElementById("preview-img");
const scanOverlay = document.getElementById("scan-overlay");
const analyseBtn  = document.getElementById("analyse-btn");

let selectedFile = null, lastResult = null;

if (dropZone) {
  dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("dragover"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault(); dropZone.classList.remove("dragover");
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) handleFile(f);
  });
}

if (fileInput) {
  fileInput.addEventListener("change", () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
}

function handleFile(f) {
  selectedFile = f;
  const r = new FileReader();
  r.onload = e => {
    previewImg.src = e.target.result;
    dropZone.style.display = "none";
    previewWrap.style.display = "block";
    analyseBtn.style.display  = "flex";
    hideError(); clearResults();
  };
  r.readAsDataURL(f);
}

function clearImage() {
  selectedFile = null;
  previewWrap.style.display = "none";
  dropZone.style.display    = "flex";
  analyseBtn.style.display  = "none";
  scanOverlay.style.display = "none";
  fileInput.value = "";
  clearResults(); hideError();
}

function clearResults() {
  document.getElementById("results-section").style.display = "none";
  lastResult = null;
}

async function runAnalysis() {
  if (!selectedFile) return;
  setLoading(true); hideError(); clearResults();
  scanOverlay.style.display = "block";
  const form = new FormData();
  form.append("image", selectedFile);
  try {
    const r = await fetch(API_URL, { method: "POST", body: form });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || `HTTP ${r.status} — Is Flask running?`);
    }
    const data = await r.json();
    lastResult = data;
    try {
      const s = JSON.parse(localStorage.getItem("ll_stats") || "{}");
      s.scans = (s.scans || 0) + 1;
      localStorage.setItem("ll_stats", JSON.stringify(s));
    } catch(e) {}
    renderResults(data);
  } catch (e) {
    showError("⚠ " + e.message);
  } finally {
    setLoading(false);
    scanOverlay.style.display = "none";
  }
}

function renderResults(data) {
  const { prediction, all_classes } = data;
  const conf = prediction.confidence, risk = prediction.risk;
  document.getElementById("acc-stat").textContent   = conf.toFixed(1) + "%";
  document.getElementById("res-conf").textContent   = conf.toFixed(1);
  document.getElementById("res-label").textContent  = prediction.label;
  document.getElementById("res-code").textContent   = prediction.code.toUpperCase() + " · " + prediction.label;
  const riskEl = document.getElementById("res-risk");
  riskEl.className = "risk-tag risk-" + risk;
  document.getElementById("res-risk-text").textContent = risk + " risk";

  const circ = 408, fill = document.getElementById("gauge-fill");
  fill.style.strokeDashoffset = circ;
  setTimeout(() => fill.style.strokeDashoffset = circ - (conf / 100) * circ, 100);
  animNum(document.getElementById("gauge-pct"), 0, Math.round(conf), 1200, n => n + "%");
  document.getElementById("gauge-sub").textContent = prediction.label;

  const cont = document.getElementById("bars-container");
  cont.innerHTML = "";
  all_classes.forEach((cls, i) => {
    const top = i === 0;
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-name ${top ? "top" : ""}">${cls.label}</div>
      <div class="bar-track"><div class="bar-fill ${top ? "top" : ""}" data-w="${cls.confidence}"></div></div>
      <div class="bar-pct ${top ? "top" : ""}">${cls.confidence.toFixed(1)}%</div>
    `;
    cont.appendChild(row);
  });

  const sec = document.getElementById("results-section");
  sec.style.display = "block";
  cont.querySelectorAll(".bar-fill").forEach((el, i) =>
    setTimeout(() => el.style.width = el.dataset.w + "%", 100 + i * 80)
  );

  if (typeof window.runXAI === "function" && selectedFile) {
    window.runXAI(selectedFile);
  }
}

function animNum(el, from, to, dur, fmt = n => n) {
  const s = performance.now();
  (function t(now) {
    const p = Math.min((now - s) / dur, 1), e = 1 - Math.pow(1 - p, 4);
    el.textContent = fmt(Math.round(from + (to - from) * e));
    if (p < 1) requestAnimationFrame(t);
  })(performance.now());
}

function setLoading(on) {
  document.getElementById("loader").style.display = on ? "flex" : "none";
  analyseBtn.disabled = on;
  analyseBtn.querySelector("span").textContent = on ? "⏳ Analysing…" : "⚡ Analyse Image";
}

function showError(m) {
  const el = document.getElementById("error-box");
  el.textContent = m; el.style.display = "block";
}

function hideError() {
  document.getElementById("error-box").style.display = "none";
}

function logout() {
  sessionStorage.removeItem("nd_auth");
  document.body.style.opacity = "0";
  document.body.style.transition = "opacity 0.4s ease";
  setTimeout(() => window.location.href = "login.html", 400);
}

window.runAnalysis  = runAnalysis;
window.clearImage   = clearImage;
window.openDetail   = openDetail;
window.closeDetail  = closeDetail;
window.logout       = logout;
window.lastResult   = () => lastResult;