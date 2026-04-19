/* ═══════════════════════════════════════════════
   LesionLens — login.js
   Auth, localStorage tracking, form validation
   ═══════════════════════════════════════════════ */

document.body.style.opacity = "1";

// ── Storage helpers ───────────────────────────────
function getStats() {
  try { return JSON.parse(localStorage.getItem("ll_stats") || "{}"); } catch { return {}; }
}
function saveStats(s) { localStorage.setItem("ll_stats", JSON.stringify(s)); }

function recordLogin(email) {
  const s = getStats(), now = new Date().toISOString();
  s.total = (s.total || 0) + 1;
  s.gmail = (s.gmail || 0) + 1;
  if (!s.users) s.users = {};
  const key = email.toLowerCase();
  if (!s.users[key]) s.users[key] = { email: key, count: 0, first: now, last: now };
  s.users[key].count++;
  s.users[key].last = now;
  if (!s.log) s.log = [];
  s.log.unshift({ type: "gmail", email: key, time: now });
  if (s.log.length > 50) s.log = s.log.slice(0, 50);
  saveStats(s);
}

function recordGuest() {
  const s = getStats(), now = new Date().toISOString();
  s.total = (s.total || 0) + 1;
  s.guest = (s.guest || 0) + 1;
  if (!s.log) s.log = [];
  s.log.unshift({ type: "guest", time: now });
  if (s.log.length > 50) s.log = s.log.slice(0, 50);
  saveStats(s);
}

// ── Password toggle ───────────────────────────────
function togglePwd(btn) {
  const inp = document.getElementById("password");
  const show = inp.type === "text";
  inp.type = show ? "password" : "text";
  btn.querySelector("svg").innerHTML = show
    ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
    : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
}

// ── Error helpers ─────────────────────────────────
function showErr(msg) {
  const el = document.getElementById("form-error");
  el.textContent = "⚠  " + msg; el.style.display = "block";
  const fc = document.querySelector(".form-card");
  fc.style.animation = "none"; void fc.offsetWidth; fc.style.animation = "shake 0.42s ease";
}
function hideErr() { document.getElementById("form-error").style.display = "none"; }

// ── Login handler ─────────────────────────────────
function handleLogin() {
  const email = document.getElementById("email").value.trim().toLowerCase();
  const pass  = document.getElementById("password").value;
  hideErr();
  if (!email)                           { showErr("Email address is required."); return; }
  if (!email.endsWith("@gmail.com"))    { showErr("Please use a Gmail address (e.g. yourname@gmail.com)"); return; }
  if (email.length < 12)               { showErr("Please enter a valid Gmail address."); return; }
  if (!pass)                            { showErr("Password is required."); return; }
  if (pass.length < 6)                  { showErr("Password must be at least 6 characters."); return; }

  const btn = document.getElementById("login-btn");
  const txt = document.getElementById("login-txt");
  btn.disabled = true; txt.textContent = "⏳  Signing in…";
  recordLogin(email);
  setTimeout(goToApp, 900);
}

function handleGuest() {
  recordGuest();
  goToApp();
}

function goToApp() {
  sessionStorage.setItem("nd_auth", "1");
  document.body.style.opacity = "0";
  document.body.style.transition = "opacity 0.4s ease";
  setTimeout(() => window.location.href = "index.html", 420);
}

document.addEventListener("keydown", e => { if (e.key === "Enter") handleLogin(); });

// Expose globally
window.handleLogin  = handleLogin;
window.handleGuest  = handleGuest;
window.togglePwd    = togglePwd;