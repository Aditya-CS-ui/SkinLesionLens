const XAI_URL    = "http://localhost:5000/explain";
const REPORT_URL = "http://localhost:5000/submit-report";

const XAI_TAGS = {
  akiec: ["Rough texture","Scaly surface","UV border damage","Reddish pigmentation"],
  bcc:   ["Pearly border","Telangiectasia","Nodular pattern","Rolled edge"],
  bkl:   ["Stuck-on surface","Warty texture","Sharp demarcation","Brown pigment"],
  df:    ["Central dimple","Fibrous core","Firm nodule","Fitzpatrick sign"],
  mel:   ["Asymmetric border","Multi-tonal color","Irregular shape","Dark pigmentation"],
  nv:    ["Round shape","Smooth border","Uniform pigment","Symmetry"],
  vasc:  ["Vascular pattern","Red/purple tone","Vessel radiations","Bright colouring"],
};

let _xaiData    = null;
let _leafletMap = null;

async function runXAI(file) {
  if (!file) return;

  const xaiSec = document.getElementById("xai-section");
  xaiSec.style.display = "block";
  xaiSec.scrollIntoView({ behavior:"smooth", block:"start" });

  const heatImg  = document.getElementById("xai-heatmap-img");
  const xaiLoad  = document.getElementById("xai-loader");
  const noteText = document.getElementById("xai-note-text");
  const causeTags= document.getElementById("xai-cause-tags");
  const hospSec  = document.getElementById("hospital-section");
  const rptBox   = document.getElementById("report-status-box");
  const submitBtn= document.getElementById("submit-report-btn");

  heatImg.style.display = "none";
  xaiLoad.style.display = "flex";
  noteText.textContent  = "Running Grad-CAM analysis…";
  causeTags.innerHTML   = "";
  hospSec.style.display = "none";
  rptBox.style.display  = "none";
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.querySelector("span").textContent = "Send to Doctor →";
  }

  const form = new FormData();
  form.append("image", file);

  try {
    const res  = await fetch(XAI_URL, { method:"POST", body:form });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _xaiData   = data;

    heatImg.src           = "data:image/png;base64," + data.heatmap_b64;
    heatImg.style.display = "block";
    xaiLoad.style.display = "none";

    noteText.textContent = data.xai_note;

    const tags = XAI_TAGS[data.prediction.code] || [];
    causeTags.innerHTML = tags.map(t =>
      `<span class="detail-tag">${t}</span>`
    ).join("");

    if (data.high_risk) {
      hospSec.style.display = "block";
      findNearestHospital();
    }

  } catch(e) {
    xaiLoad.style.display = "none";
    noteText.textContent  = "⚠ Grad-CAM unavailable — Flask server may not be running. The prediction above is still valid.";
    heatImg.style.display = "none";
  }
}

async function findNearestHospital() {
  const hospLoader = document.getElementById("hospital-loader");
  const hospMap    = document.getElementById("hospital-map");
  const hospInfo   = document.getElementById("hospital-info");

  hospLoader.style.display = "flex";
  hospMap.style.display    = "none";
  hospInfo.style.display   = "none";

  if (!navigator.geolocation) {
    hospLoader.style.display = "none";
    hospInfo.style.display   = "block";
    hospInfo.innerHTML = buildHospitalFallback();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      try {
        const hospital = await queryOverpass(lat, lon);
        hospLoader.style.display = "none";
        hospMap.style.display    = "block";
        hospInfo.style.display   = "block";
        renderMap(lat, lon, hospital);
        renderHospitalInfo(hospital, hospInfo);
      } catch(e) {
        hospLoader.style.display = "none";
        hospInfo.style.display   = "block";
        hospInfo.innerHTML = buildHospitalFallback();
      }
    },
    () => {
      hospLoader.style.display = "none";
      hospInfo.style.display   = "block";
      hospInfo.innerHTML = buildHospitalFallback();
    },
    { timeout:8000 }
  );
}

async function queryOverpass(lat, lon) {
  const r = 10000;
  const query = `
    [out:json][timeout:15];
    (
      node["amenity"="hospital"](around:${r},${lat},${lon});
      node["amenity"="clinic"]["healthcare"](around:${r},${lat},${lon});
      way["amenity"="hospital"](around:${r},${lat},${lon});
    );
    out center 5;
  `;
  const res  = await fetch("https://overpass-api.de/api/interpreter", {
    method:"POST", body: "data=" + encodeURIComponent(query)
  });
  const data = await res.json();

  let bestDist = Infinity;
  let best     = null;      

  data.elements.forEach(el => {
    const elat = el.lat || el.center?.lat;
    const elon = el.lon || el.center?.lon;
    if (!elat || !elon) return;
    const d = haversine(lat, lon, elat, elon);
    if (d < bestDist) {
      bestDist = d;
      best = { ...el, _lat:elat, _lon:elon, _dist:d };
    }
  });

  if (!best) throw new Error("No valid hospital found nearby.");
  return best;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function renderMap(userLat, userLon, hosp) {
  const mapEl = document.getElementById("hospital-map");
  if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; }
  _leafletMap = L.map(mapEl).setView([userLat, userLon], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:'&copy; OpenStreetMap contributors', maxZoom:18
  }).addTo(_leafletMap);

  const userIcon = L.divIcon({ className:"", html:`
    <div style="width:14px;height:14px;background:#00ff88;border:2px solid #0a0a0a;border-radius:50%;box-shadow:0 0 8px #00ff8888"></div>
  `, iconSize:[14,14], iconAnchor:[7,7] });
  L.marker([userLat, userLon], { icon:userIcon })
   .addTo(_leafletMap)
   .bindPopup("Your location");

  const hospIcon = L.divIcon({ className:"", html:`
    <div style="width:18px;height:18px;background:#ff3366;border:2px solid #0a0a0a;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 0 10px #ff336688">+</div>
  `, iconSize:[18,18], iconAnchor:[9,9] });
  const name = hosp.tags?.name || "Nearest Hospital";
  L.marker([hosp._lat, hosp._lon], { icon:hospIcon })
   .addTo(_leafletMap)
   .bindPopup(`<b>${name}</b><br>${hosp._dist.toFixed(1)} km away`)
   .openPopup();

  L.polyline([[userLat,userLon],[hosp._lat,hosp._lon]], {
    color:"#00d2ff", weight:2, dashArray:"6 4", opacity:0.7
  }).addTo(_leafletMap);
}

function renderHospitalInfo(hosp, el) {
  const name    = hosp.tags?.name    || "Nearest Hospital";
  const address = hosp.tags?.["addr:street"] || hosp.tags?.["addr:full"] || "See map above";
  const phone   = hosp.tags?.phone   || hosp.tags?.["contact:phone"] || "—";
  const dist    = hosp._dist.toFixed(1);
  el.innerHTML = `
    <div class="hosp-name">${name}</div>
    <div class="hosp-row"><span class="hosp-key">Distance</span><span class="hosp-val">${dist} km</span></div>
    <div class="hosp-row"><span class="hosp-key">Address</span><span class="hosp-val">${address}</span></div>
    <div class="hosp-row"><span class="hosp-key">Phone</span><span class="hosp-val">${phone}</span></div>
    <a class="hosp-directions" href="https://www.openstreetmap.org/directions?to=${hosp._lat}%2C${hosp._lon}" target="_blank">
      Get directions &#8599;
    </a>
  `;
}

function buildHospitalFallback() {
  return `
    <div class="hosp-name">Location unavailable</div>
    <div class="hosp-row"><span class="hosp-key">Action</span><span class="hosp-val">Please allow location access and refresh, or search manually.</span></div>
    <a class="hosp-directions" href="https://www.openstreetmap.org/search?query=dermatology+hospital" target="_blank">
      Search on OpenStreetMap &#8599;
    </a>
  `;
}

async function submitReport() {
  const btn   = document.getElementById("submit-report-btn");
  const box   = document.getElementById("report-status-box");
  const span  = btn.querySelector("span");

  if (!_xaiData) { showReportStatus("⚠ Run analysis first.", "warn"); return; }

  btn.disabled = true;
  span.textContent = "⏳ Submitting…";
  box.style.display = "none";

  const result = window.lastResult ? window.lastResult() : null;

  const payload = {
    patient_email: sessionStorage.getItem("nd_email") || "anonymous",
    prediction:    _xaiData.prediction,
    all_classes:   result?.all_classes || [],
    heatmap_b64:   _xaiData.heatmap_b64,
    xai_note:      _xaiData.xai_note,
    high_risk:     _xaiData.high_risk,
  };

  try {
    const res  = await fetch(REPORT_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Server error");

    showReportStatus(
      `✅ Report <strong>${data.report_id}</strong> submitted — awaiting dermatologist review.`,
      "ok"
    );
    span.textContent = "Submitted ✓";
  } catch(e) {
    btn.disabled     = false;
    span.textContent = "Send to Doctor →";
    showReportStatus("⚠ Submission failed: " + e.message, "warn");
  }
}

function showReportStatus(html, type) {
  const box = document.getElementById("report-status-box");
  box.innerHTML     = html;
  box.style.display = "block";
  box.className     = "report-status-box " + (type==="ok" ? "report-status-ok" : "report-status-warn");
}

async function checkReports() {
  const email = sessionStorage.getItem("nd_email");
  if (!email) {
    showReportStatus("⚠ Please log in to check your reports.", "warn");
    return;
  }

  const box = document.getElementById("report-status-box");
  box.style.display = "none";

  try {
    const res = await fetch(`http://localhost:5000/my-reports?email=${encodeURIComponent(email)}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Failed to fetch reports");

    if (data.reports.length === 0) {
      showReportStatus("📋 No reports found. Submit a report for analysis first.", "warn");
      return;
    }

    let html = "<div style='max-height: 300px; overflow-y: auto;'><h4 style='margin: 0 0 10px 0; color: var(--text);'>Your Reports:</h4>";

    data.reports.forEach(report => {
      const statusIcon = report.status === 'approved' ? '✅' :
                        report.status === 'rejected' ? '❌' : '⏳';
      const statusColor = report.status === 'approved' ? 'var(--green)' :
                         report.status === 'rejected' ? 'var(--red)' : 'var(--amber)';

      const prediction = report.prediction?.label || 'Unknown';
      const submitted = new Date(report.submitted_at).toLocaleDateString();

      html += `
        <div style='border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 8px; background: var(--glass);'>
          <div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;'>
            <strong style='color: var(--text);'>Report ${report.report_id}</strong>
            <span style='color: ${statusColor}; font-weight: 600;'>${statusIcon} ${report.status.toUpperCase()}</span>
          </div>
          <div style='color: var(--muted); font-size: 14px; margin-bottom: 4px;'>
            ${prediction} • Submitted: ${submitted}
          </div>`;

      if (report.status === 'approved') {
        html += `<div style='color: var(--green); font-weight: 500; font-size: 14px;'>✅ Doctor Approved</div>`;
        html += `<button onclick="downloadUserReport('${report.report_id}')" style='padding: 6px 12px; background: linear-gradient(135deg, var(--cyan), var(--purple)); border: none; border-radius: 6px; color: #fff; font-size: 12px; cursor: pointer; margin-top: 8px;'>Download PDF</button>`;
      } else if (report.status === 'rejected' && report.doctor_note) {
        html += `<div style='color: var(--red); font-weight: 500; font-size: 14px;'>❌ Rejected: ${report.doctor_note}</div>`;
      } else if (report.status === 'pending') {
        html += `<div style='color: var(--amber); font-weight: 500; font-size: 14px;'>⏳ Awaiting doctor review</div>`;
      }

      html += `</div>`;
    });

    html += "</div>";
    showReportStatus(html, "ok");

  } catch(e) {
    showReportStatus("⚠ Failed to check reports: " + e.message, "warn");
  }
}

async function downloadUserReport(rid) {
  try {
    const email = sessionStorage.getItem("nd_email");
    const res = await fetch(`http://localhost:5000/my-reports?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    const report = data.reports.find(r => r.report_id === rid);
    if (!report) throw new Error("Report not found");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`LesionLens Report`, 10, 10);
    doc.text(`Report ID: ${report.report_id}`, 10, 20);
    doc.text(`Status: ${report.status}`, 10, 30);
    doc.text(`Prediction: ${report.prediction.label}`, 10, 40);
    doc.text(`Confidence: ${report.prediction.confidence}%`, 10, 50);
    doc.text(`Risk: ${report.prediction.risk}`, 10, 60);
    if (report.doctor_note) {
      doc.text(`Doctor Note: ${report.doctor_note}`, 10, 70);
    }
    doc.save(`report_${report.report_id}.pdf`);
  } catch(e) {
    alert("Error generating PDF: " + e.message);
  }
}

window.runXAI             = runXAI;
window.submitReport       = submitReport;
window.checkReports       = checkReports;
window.downloadUserReport = downloadUserReport;