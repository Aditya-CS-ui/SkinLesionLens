const API_BASE = "http://localhost:5000";


let _reports    = [];
let _filter     = "all";
let _pendingAct = {};

document.getElementById("dp-pass").addEventListener("keydown", e => {
  if (e.key === "Enter") checkPass();
});

function checkPass() {
  const val = document.getElementById("dp-pass").value.trim();
  if (!val) return;
  fetch(API_BASE + "/api/doctor-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: val })
  })
  .then(r => r.json())
  .then(data => {
    if (data.status === "ok") {
      sessionStorage.setItem("dp_token", val);
      document.getElementById("dp-lock").style.display = "none";
      document.getElementById("dp-dash").style.display = "block";
      loadReports();
      setInterval(loadReports, 30000);
    } else {
      document.getElementById("dp-err").style.display = "block";
      document.getElementById("dp-pass").value = "";
      document.getElementById("dp-pass").focus();
    }
  })
  .catch(() => {
    document.getElementById("dp-err").style.display = "block";
    document.getElementById("dp-pass").value = "";
    document.getElementById("dp-pass").focus();
  });
}

function getAuthHeaders() {
  const token = sessionStorage.getItem("dp_token") || "";
  return {
    "Content-Type": "application/json",
    "X-Doctor-Token": token
  };
}

async function loadReports() {
  try {
    const res  = await fetch(API_BASE + "/reports", {
      headers: { "X-Doctor-Token": sessionStorage.getItem("dp_token") || "" }
    });
    const data = await res.json();
    _reports   = data.reports || [];
    updateStats();
    renderList();
    document.getElementById("dp-refresh-txt").textContent =
      "Refreshed " + new Date().toLocaleTimeString();
  } catch(e) {
    document.getElementById("dp-report-list").innerHTML =
      `<div class="dp-empty">⚠ Cannot reach Flask API at ${API_BASE}<br>
       Make sure <code>app.py</code> is running on port 5000.</div>`;
  }
}

function updateStats() {
  const total    = _reports.length;
  const pending  = _reports.filter(r => r.status === "pending").length;
  const approved = _reports.filter(r => r.status === "approved").length;
  const rejected = _reports.filter(r => r.status === "rejected").length;
  animNum("ds-total",    total);
  animNum("ds-pending",  pending);
  animNum("ds-approved", approved);
  animNum("ds-rejected", rejected);
}

function setFilter(f, btn) {
  _filter = f;
  document.querySelectorAll(".dp-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  renderList();
}

function renderList() {
  const list = document.getElementById("dp-report-list");
  const rows = _filter === "all" ? _reports : _reports.filter(r => r.status === _filter);
  if (!rows.length) {
    const label = _filter === "all" ? "reports" : _filter + " reports";
    list.innerHTML = `<div class="dp-empty">No ${label} found.</div>`;
    return;
  }
  list.innerHTML = "";
  rows.forEach(r => list.appendChild(buildCard(r)));
}

function buildCard(r) {
  const wrap  = document.createElement("div");
  const pred  = r.prediction || {};
  const risk  = pred.risk || "low";
  const rTag  = risk === "high" ? "rr-high" : risk === "moderate" ? "rr-mod" : "rr-low";
  const sTag  = "rs-" + r.status;
  const confClass = pred.confidence < 30 ? "low-conf" : pred.confidence < 70 ? "med-conf" : "high-conf";
  const tStr  = timeSince(r.submitted_at);

  wrap.className = `dp-rcard ${r.status}`;
  wrap.id        = "rcard-" + r.report_id;
  wrap.innerHTML = `
    <div class="dp-rcard-header" onclick="toggleDetail('${r.report_id}')">
      <div class="dp-rid">${r.report_id}</div>
      <div class="dp-rlabel">${pred.label || "—"}</div>
      <div class="dp-rconf ${confClass}" title="Model confidence in this prediction.">${pred.confidence != null ? pred.confidence.toFixed(1) + "%" : "—"}</div>
      <div class="dp-rrisk ${rTag}">${risk} risk</div>
      <div class="dp-rstatus ${sTag}">${r.status}</div>
      <div class="dp-rtime">${tStr}</div>
    </div>
    <div class="dp-rdetail" id="rdetail-${r.report_id}"></div>
  `;
  return wrap;
}

async function toggleDetail(rid) {
  const el = document.getElementById("rdetail-" + rid);
  if (el.classList.contains("open")) { el.classList.remove("open"); return; }
  el.classList.add("open");
  if (el.innerHTML.trim()) return;

  el.innerHTML = `<div class="dp-empty" style="padding:20px">Loading…</div>`;
  try {
    const res = await fetch(API_BASE + "/reports/" + rid, {
      headers: { "X-Doctor-Token": sessionStorage.getItem("dp_token") || "" }
    });
    const r   = await res.json();
    el.innerHTML = buildDetail(r);
    setTimeout(() => {
      el.querySelectorAll(".dp-mbar-fill").forEach(b => b.style.width = b.dataset.w + "%");
    }, 80);
  } catch(e) {
    el.innerHTML = `<div class="dp-empty" style="padding:16px">Failed to load detail.</div>`;
  }
}

function buildDetail(r) {
  const pred = r.prediction || {};
  const all  = r.all_classes || [];

  const heatHtml = r.heatmap_b64
    ? `<img src="data:image/png;base64,${r.heatmap_b64}" alt="Grad-CAM"/>`
    : `<div class="dp-heat-none">No heatmap<br>available</div>`;

  const barsHtml = all.map((c, i) => `
    <div class="dp-mini-bar">
      <div class="dp-mbar-name">${c.label}</div>
      <div class="dp-mbar-track">
        <div class="dp-mbar-fill ${i === 0 ? "top" : ""}" data-w="${c.confidence}" style="width:0"></div>
      </div>
      <div class="dp-mbar-pct">${c.confidence.toFixed(1)}%</div>
    </div>
  `).join("");

  const isPending = r.status === "pending";
  const actionHtml = isPending ? `
    <div class="dp-action">
      <div class="dp-action-title">Dermatologist decision</div>
      <div class="dp-action-btns">
        <button class="dp-btn-approve" onclick="prepareAction('${r.report_id}','approve')">✓ Approve report</button>
        <button class="dp-btn-reject"  onclick="prepareAction('${r.report_id}','reject')">✕ Reject — false positive</button>
      </div>
      <textarea class="dp-note-area" id="note-${r.report_id}"
        placeholder="Rejection reason — required when rejecting…"></textarea>
      <button class="dp-confirm" id="confirm-${r.report_id}"
        onclick="submitDecision('${r.report_id}')">Confirm →</button>
    </div>
  ` : `
    <div class="dp-action">
      <div class="dp-reviewed-box">
        Report <strong>${r.status}</strong> on
        <strong>${r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : "—"}</strong>
        ${r.doctor_note ? `<br>Doctor note: "<em>${r.doctor_note}</em>"` : ""}
      </div>
    </div>
  `;

  return `
    <div class="dp-detail-grid">
      <div class="dp-heat-wrap">${heatHtml}</div>
      <div>
        <div class="dp-xai-block">
          <div class="dp-xai-lbl">Model reasoning · Grad-CAM</div>
          <div class="dp-xai-txt">${r.xai_note || "No explanation available."}</div>
        </div>
        ${barsHtml}
      </div>
    </div>
    <div class="dp-meta-row">
      Patient: ${r.patient_email} &nbsp;·&nbsp;
      Submitted: ${r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"} &nbsp;·&nbsp;
      High risk: ${r.high_risk ? "Yes" : "No"}
    </div>
    ${actionHtml}
  `;
}

function prepareAction(rid, action) {
  _pendingAct = { rid, action };
  const noteEl    = document.getElementById("note-"    + rid);
  const confirmEl = document.getElementById("confirm-" + rid);
  const isReject  = action === "reject";
  noteEl.classList.toggle("show", isReject);
  confirmEl.classList.add("show");
  confirmEl.className = "dp-confirm show " + (isReject ? "c-reject" : "c-approve");
  confirmEl.textContent = isReject ? "Confirm rejection →" : "Confirm approval →";
}

async function submitDecision(rid) {
  const { action }  = _pendingAct;
  const noteEl      = document.getElementById("note-"    + rid);
  const confirmEl   = document.getElementById("confirm-" + rid);
  const note        = (noteEl?.value || "").trim();

  if (action === "reject" && !note) {
    noteEl.style.borderColor = "rgba(255,51,102,0.6)";
    noteEl.placeholder       = "⚠ Reason is required when rejecting.";
    noteEl.focus();
    return;
  }

  confirmEl.disabled    = true;
  confirmEl.textContent = "⏳ Submitting…";

  try {
    const res  = await fetch(API_BASE + "/update-report", {
      method:  "POST",
      headers: getAuthHeaders(),
      body:    JSON.stringify({ report_id:rid, action, doctor_note:note }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Server error");

    await loadReports();
    setTimeout(() => {
      const detail = document.getElementById("rdetail-" + rid);
      if (detail) detail.innerHTML = "";
      toggleDetail(rid);
    }, 200);

    showModal(rid, action);
  } catch(e) {
    confirmEl.disabled    = false;
    confirmEl.textContent = "Confirm →";
    alert("Error: " + e.message);
  }
}

function animNum(id, target) {
  const el  = document.getElementById(id);
  if (!el) return;
  const dur = 700, s = performance.now();
  (function tick(now) {
    const p = Math.min((now - s) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * e);
    if (p < 1) requestAnimationFrame(tick);
  })(performance.now());
}

function timeSince(iso) {
  if (!iso) return "—";
  const diff = Math.round((Date.now() - new Date(iso)) / 60000);
  if (diff < 1)    return "just now";
  if (diff < 60)   return diff + "m ago";
  if (diff < 1440) return Math.round(diff / 60) + "h ago";
  return Math.round(diff / 1440) + "d ago";
}

function showModal(rid, action) {
  document.getElementById("dp-modal-title").textContent = `Report ${action}d successfully!`;
  document.getElementById("dp-download-btn").onclick = () => downloadPDF(rid);
  document.getElementById("dp-modal").style.display = "flex";
}

function closeModal() {
  document.getElementById("dp-modal").style.display = "none";
}

async function downloadPDF(rid) {
  try {
    const res = await fetch(API_BASE + "/reports/" + rid, {
      headers: { "X-Doctor-Token": sessionStorage.getItem("dp_token") || "" }
    });
    const r = await res.json();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`LesionLens Report`, 10, 10);
    doc.text(`Report ID: ${r.report_id}`, 10, 20);
    doc.text(`Status: ${r.status}`, 10, 30);
    doc.text(`Patient: ${r.patient_email}`, 10, 40);
    doc.text(`Prediction: ${r.prediction.label}`, 10, 50);
    doc.text(`Confidence: ${r.prediction.confidence}%`, 10, 60);
    doc.text(`Risk: ${r.prediction.risk}`, 10, 70);
    if (r.doctor_note) {
      doc.text(`Doctor Note: ${r.doctor_note}`, 10, 80);
    }
    doc.save(`report_${r.report_id}.pdf`);
  } catch(e) {
    alert("Error generating PDF: " + e.message);
  }
}

window.checkPass      = checkPass;
window.setFilter      = setFilter;
window.loadReports    = loadReports;
window.toggleDetail   = toggleDetail;
window.prepareAction  = prepareAction;
window.submitDecision = submitDecision;
window.closeModal     = closeModal;