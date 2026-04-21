import os
import io
import uuid
import json
import base64
import sqlite3
import datetime
import pathlib
import functools
import torch
import torch.nn as nn
import torchvision.transforms as transforms
import timm
import numpy as np
import requests as http_requests
from PIL import Image
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import gdown
MODEL_PATH = "best_model.pth"
MODEL_GDRIVE_ID = "1BL5CRXXBKrOoasOwG2rRlDsvnhWxhqw4"  # paste just the ID from the link

if not os.path.exists(MODEL_PATH):
    print("[LesionLens] Downloading model weights from Google Drive...")
    gdown.download(id=MODEL_GDRIVE_ID, output=MODEL_PATH, quiet=False)
    print("[LesionLens] Download complete.")
load_dotenv()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
VALID_EMAIL    = os.environ.get("ADMIN_EMAIL",    "")
VALID_PASS     = os.environ.get("ADMIN_PASS",     "")
DOCTOR_TOKEN   = os.environ.get("DOCTOR_TOKEN",   "")

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

CHECKPOINT_PATH  = "best_model.pth"
DEVICE           = torch.device("cuda" if torch.cuda.is_available() else "cpu")
NUM_CLASSES      = 7
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_MIME     = {"image/jpeg", "image/png", "image/webp"}

CLASS_NAMES = {
    0: "Actinic Keratosis",
    1: "Basal Cell Carcinoma",
    2: "Benign Keratosis",
    3: "Dermatofibroma",
    4: "Melanoma",
    5: "Melanocytic Nevi",
    6: "Vascular Lesion",
}
CLASS_CODES = {
    0: "akiec", 1: "bcc", 2: "bkl",
    3: "df",    4: "mel", 5: "nv", 6: "vasc",
}
RISK_LEVEL = {
    0: "moderate", 1: "high",  2: "low",
    3: "low",      4: "high",  5: "low", 6: "moderate",
}
XAI_NOTES = {
    0: "The model focused on rough, scaly surface texture and reddish border regions — characteristic features of Actinic Keratosis caused by UV-damaged keratinocytes.",
    1: "Activation concentrated around pearly nodular borders and telangiectatic vessel patterns — hallmarks of Basal Cell Carcinoma.",
    2: "The model highlighted the stuck-on, warty surface texture and well-demarcated border typical of Benign Keratosis (seborrheic keratosis).",
    3: "Attention focused on the central dimpling zone and fibrous nodular core characteristic of Dermatofibroma.",
    4: "The model strongly activated on irregular pigmentation distribution, asymmetric borders, and multi-tonal coloration — key Melanoma indicators.",
    5: "Activation centred on the uniform round shape, smooth border, and even pigment distribution consistent with benign Melanocytic Nevi.",
    6: "The model highlighted vascular patterns: bright red or purple discolouration and the radiating vessel architecture of Vascular Lesions.",
}

DB_PATH = pathlib.Path("reports.db")

def get_db():
    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row
    return db

def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                report_id     TEXT PRIMARY KEY,
                patient_email TEXT,
                prediction    TEXT,
                all_classes   TEXT,
                heatmap_b64   TEXT,
                xai_note      TEXT,
                high_risk     INTEGER,
                status        TEXT DEFAULT 'pending',
                doctor_note   TEXT DEFAULT '',
                submitted_at  TEXT,
                reviewed_at   TEXT
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                email      TEXT PRIMARY KEY,
                password   TEXT NOT NULL,
                created_at TEXT
            )
        """)
        db.commit()

init_db()

def require_doctor(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        if DOCTOR_TOKEN:
            token = request.headers.get("X-Doctor-Token", "")
            if token != DOCTOR_TOKEN:
                return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

_gradients   = {}
_activations = {}

def build_model():
    return timm.create_model("efficientnet_b3", pretrained=False, num_classes=NUM_CLASSES)

def load_model(path):
    m = build_model()
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"\n{'='*55}\n"
            f"  Checkpoint not found: '{path}'\n"
            f"  1. Download fold1_best.pth from Kaggle\n"
            f"  2. Rename to best_model.pth\n"
            f"  3. Place beside app.py\n"
            f"{'='*55}"
        )
    ckpt  = torch.load(path, map_location=DEVICE)
    state = (
        ckpt["model_state_dict"]
        if isinstance(ckpt, dict) and "model_state_dict" in ckpt
        else ckpt
    )
    try:
        m.load_state_dict(state, strict=True)
        print("[LesionLens] Weights loaded — strict=True ✓")
    except RuntimeError as e:
        print(f"[LesionLens] strict=True failed: {e}")
        print("[LesionLens] Retrying with strict=False …")
        missing, unexpected = m.load_state_dict(state, strict=False)
        if missing:
            print(f"[LesionLens] Missing keys  ({len(missing)}): {missing[:5]} …")
        if unexpected:
            print(f"[LesionLens] Unexpected keys ({len(unexpected)}): {unexpected[:5]} …")
        if len(missing) > 10:
            print("[LesionLens] WARNING: Many missing keys — predictions will be unreliable!")
    m.to(DEVICE)
    m.eval()
    print(f"[LesionLens] Model ready on {DEVICE}")
    return m

TRANSFORM = transforms.Compose([
    transforms.Resize((300, 300)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

INV_NORM = transforms.Normalize(
    mean=[-0.485 / 0.229, -0.456 / 0.224, -0.406 / 0.225],
    std=[1 / 0.229,       1 / 0.224,       1 / 0.225],
)

model = load_model(CHECKPOINT_PATH)

try:
    with torch.no_grad():
        _dummy = torch.randn(1, 3, 300, 300).to(DEVICE)
        _out   = model(_dummy)
        _probs = torch.softmax(_out, dim=1)[0]
        print(f"[LesionLens] Sanity check — output shape: {_out.shape}")
        print(f"[LesionLens] Sanity check — max prob: {_probs.max().item()*100:.1f}%")
        if _probs.max().item() < 0.20:
            print("[LesionLens] ⚠ WARNING: Max probability on random input < 20% — weights may not have loaded correctly!")
except Exception as e:
    print(f"[LesionLens] Sanity check failed: {e}")

def _save_act(mod, inp, out):
    _activations["v"] = out.detach()

def _save_grad(mod, grad_in, grad_out):
    _gradients["v"] = grad_out[0].detach()

model.conv_head.register_forward_hook(_save_act)
model.conv_head.register_full_backward_hook(_save_grad)

def validate_image(f):
    if f.mimetype not in ALLOWED_MIME:
        return None, f"Only JPEG, PNG, and WebP images are accepted (got {f.mimetype})."
    data = f.read()
    if len(data) > MAX_UPLOAD_BYTES:
        return None, "File too large — maximum is 10 MB."
    return data, None

def preprocess(file_bytes):
    img    = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    tensor = TRANSFORM(img).unsqueeze(0).to(DEVICE)
    return tensor, img

def run_inference(tensor):
    with torch.no_grad():
        logits  = model(tensor)
        probs   = torch.softmax(logits, dim=1)[0]
        top_idx = int(torch.argmax(probs))
        top_c   = float(probs[top_idx])
    top3 = torch.topk(probs, 3)
    print(
        f"[LesionLens] Top-3: "
        + " | ".join(
            f"{CLASS_NAMES[int(top3.indices[i])]} {top3.values[i]*100:.1f}%"
            for i in range(3)
        )
    )
    return probs, top_idx, top_c

def build_all_classes(probs):
    return sorted(
        [
            {
                "class_idx":  i,
                "code":       CLASS_CODES[i],
                "label":      CLASS_NAMES[i],
                "confidence": round(float(probs[i]) * 100, 2),
                "risk":       RISK_LEVEL[i],
            }
            for i in range(NUM_CLASSES)
        ],
        key=lambda x: x["confidence"],
        reverse=True,
    )

def gradcam_b64(tensor, class_idx):
    from matplotlib.colors import hsv_to_rgb
    t = tensor.clone().requires_grad_(True)
    logits = model(t)
    model.zero_grad()
    logits[0, class_idx].backward()
    grads = _gradients.get("v")
    acts  = _activations.get("v")
    if grads is None or acts is None:
        raise RuntimeError("Grad-CAM hooks did not fire.")
    grads = grads.cpu()
    acts  = acts.cpu()
    w   = grads.mean(dim=(2, 3), keepdim=True)
    cam = torch.relu((w * acts).sum(1, keepdim=True))
    cam = cam - cam.min()
    if cam.max() > 0:
        cam = cam / cam.max()
    cam_np  = cam.squeeze().numpy()
    cam_pil = Image.fromarray((cam_np * 255).astype(np.uint8)).resize((300, 300), Image.BILINEAR)
    cam_np  = np.array(cam_pil).astype(np.float32) / 255.0
    hue = (1.0 - cam_np) * 0.667
    hsv = np.stack([hue, np.ones_like(hue), np.ones_like(hue)], axis=-1)
    rgb = (hsv_to_rgb(hsv) * 255).astype(np.uint8)
    alpha = (cam_np * 180).astype(np.uint8)
    heat  = np.dstack([rgb, alpha])
    orig = INV_NORM(tensor[0].detach().cpu())
    orig_np  = np.clip(orig.permute(1, 2, 0).numpy(), 0, 1)
    orig_pil = Image.fromarray((orig_np * 255).astype(np.uint8)).convert("RGBA")
    heat_pil = Image.fromarray(heat, "RGBA")
    if orig_pil.size != heat_pil.size:
        heat_pil = heat_pil.resize(orig_pil.size, Image.BILINEAR)
    comp = Image.alpha_composite(orig_pil, heat_pil).convert("RGB")
    buf = io.BytesIO()
    comp.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()

@app.route("/")
def index():
    return send_from_directory(".", "login.html")

@app.route("/app")
def app_page():
    return send_from_directory(".", "index.html")

@app.route("/doctor")
def doctor_page():
    return send_from_directory(".", "doctor.html")

@app.route("/admin")
def admin_page():
    return send_from_directory(".", "admin.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(".", path)

@app.route("/api/signup", methods=["POST"])
def signup():
    d = request.get_json(silent=True) or {}
    email    = d.get("email", "").strip().lower()
    password = d.get("password", "")
    if not email or not password:
        return jsonify({"error": "Email and password required."}), 400
    if not email.endswith("@gmail.com"):
        return jsonify({"error": "Only Gmail addresses are allowed."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400
    with get_db() as db:
        existing = db.execute("SELECT email FROM users WHERE email=?", (email,)).fetchone()
        if existing:
            return jsonify({"error": "Account already exists. Please sign in."}), 409
        db.execute(
            "INSERT INTO users (email, password, created_at) VALUES (?,?,?)",
            (email, password, datetime.datetime.utcnow().isoformat() + "Z")
        )
        db.commit()
    return jsonify({"status": "ok", "message": "Account created."})

@app.route("/api/doctor-auth", methods=["POST"])
def doctor_auth():
    """Validates the doctor portal token server-side so it's never hardcoded in JS."""
    d = request.get_json(silent=True) or {}
    token = d.get("token", "").strip()
    if DOCTOR_TOKEN and token == DOCTOR_TOKEN:
        return jsonify({"status": "ok"})
    return jsonify({"error": "Invalid token"}), 401

@app.route("/api/login", methods=["POST"])
def login():
    d = request.get_json(silent=True) or {}
    email    = d.get("email", "").strip().lower()
    password = d.get("password", "")
    if not email or not password:
        return jsonify({"error": "Email and password required."}), 400
    with get_db() as db:
        row = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not row or row["password"] != password:
        return jsonify({"error": "Invalid email or password."}), 401
    return jsonify({"status": "ok", "message": "Login successful"})

@app.route("/api/chat", methods=["POST"])
def chat():
    if not OPENAI_API_KEY:
        return jsonify({"error": "OpenAI API key not configured on server."}), 500

    data     = request.get_json(silent=True) or {}
    messages = data.get("messages", [])

    if not messages:
        return jsonify({"error": "No messages provided."}), 400

    try:
        resp = http_requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type":  "application/json",
            },
            json={
                "model":       "gpt-3.5-turbo",
                "messages":    messages,
                "max_tokens":  200,
                "temperature": 0.7,
            },
            timeout=15,
        )
        return jsonify(resp.json()), resp.status_code
    except http_requests.exceptions.Timeout:
        return jsonify({"error": "OpenAI request timed out. Please try again."}), 504
    except Exception as e:
        return jsonify({"error": f"Chat request failed: {str(e)}"}), 500


@app.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No image field in request."}), 400
    data, err = validate_image(request.files["image"])
    if err:
        return jsonify({"error": err}), 400
    try:
        tensor, _ = preprocess(data)
    except Exception as e:
        return jsonify({"error": f"Could not open image: {e}"}), 400
    probs, top_idx, top_c = run_inference(tensor)
    if top_c < 0.5:
        return jsonify({"error": "Irrelevant image detected. Please upload a skin lesion image."}), 400
    all_p = build_all_classes(probs)
    return jsonify({
        "prediction": {
            "class_idx":  top_idx,
            "code":       CLASS_CODES[top_idx],
            "label":      CLASS_NAMES[top_idx],
            "confidence": round(top_c * 100, 2),
            "risk":       RISK_LEVEL[top_idx],
        },
        "all_classes": all_p,
        "device":      str(DEVICE),
    })

@app.route("/explain", methods=["POST"])
def explain():
    if "image" not in request.files:
        return jsonify({"error": "No image field in request."}), 400
    data, err = validate_image(request.files["image"])
    if err:
        return jsonify({"error": err}), 400
    try:
        tensor, _ = preprocess(data)
    except Exception as e:
        return jsonify({"error": f"Could not open image: {e}"}), 400
    probs, top_idx, top_c = run_inference(tensor)
    class_idx = int(request.form.get("class_idx", top_idx))
    try:
        hmap = gradcam_b64(tensor, class_idx)
    except Exception as e:
        return jsonify({"error": f"Grad-CAM failed: {e}"}), 500
    return jsonify({
        "heatmap_b64": hmap,
        "prediction": {
            "class_idx":  top_idx,
            "code":       CLASS_CODES[top_idx],
            "label":      CLASS_NAMES[top_idx],
            "confidence": round(top_c * 100, 2),
            "risk":       RISK_LEVEL[top_idx],
        },
        "xai_note":  XAI_NOTES[top_idx],
        "high_risk": RISK_LEVEL[top_idx] == "high",
    })

@app.route("/submit-report", methods=["POST"])
def submit_report():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body required."}), 400
    rid = str(uuid.uuid4())[:8].upper()
    now = datetime.datetime.utcnow().isoformat() + "Z"
    with get_db() as db:
        db.execute(
            """
            INSERT INTO reports
              (report_id, patient_email, prediction, all_classes, heatmap_b64,
               xai_note, high_risk, status, doctor_note, submitted_at, reviewed_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                rid,
                data.get("patient_email", "anonymous"),
                json.dumps(data.get("prediction", {})),
                json.dumps(data.get("all_classes", [])),
                data.get("heatmap_b64", ""),
                data.get("xai_note", ""),
                1 if data.get("high_risk") else 0,
                "pending",
                "",
                now,
                None,
            ),
        )
        db.commit()
    print(f"[LesionLens] New report {rid} — {data.get('prediction', {}).get('label', '?')}")
    return jsonify({"report_id": rid, "status": "pending"})

@app.route("/reports", methods=["GET"])
@require_doctor
def list_reports():
    sf = request.args.get("status")
    with get_db() as db:
        if sf:
            rows = db.execute(
                "SELECT * FROM reports WHERE status=? ORDER BY submitted_at DESC", (sf,)
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM reports ORDER BY submitted_at DESC"
            ).fetchall()
    out = []
    for r in rows:
        row = dict(r)
        row["prediction"]  = json.loads(row["prediction"]  or "{}")
        row["all_classes"] = json.loads(row["all_classes"] or "[]")
        row["high_risk"]   = bool(row["high_risk"])
        row.pop("heatmap_b64", None)
        out.append(row)
    return jsonify({"reports": out, "total": len(out)})

@app.route("/reports/<report_id>", methods=["GET"])
@require_doctor
def get_report(report_id):
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM reports WHERE report_id=?", (report_id.upper(),)
        ).fetchone()
    if not row:
        return jsonify({"error": "Report not found."}), 404
    r = dict(row)
    r["prediction"]  = json.loads(r["prediction"]  or "{}")
    r["all_classes"] = json.loads(r["all_classes"] or "[]")
    r["high_risk"]   = bool(r["high_risk"])
    return jsonify(r)

@app.route("/update-report", methods=["POST"])
@require_doctor
def update_report():
    data   = request.get_json(silent=True) or {}
    rid    = data.get("report_id", "").upper()
    action = data.get("action", "")
    note   = data.get("doctor_note", "").strip()
    if action not in ("approve", "reject"):
        return jsonify({"error": "action must be 'approve' or 'reject'."}), 400
    if action == "reject" and not note:
        return jsonify({"error": "doctor_note is required when rejecting."}), 400
    new_status = "approved" if action == "approve" else "rejected"
    now = datetime.datetime.utcnow().isoformat() + "Z"
    with get_db() as db:
        result = db.execute(
            "UPDATE reports SET status=?, doctor_note=?, reviewed_at=? WHERE report_id=?",
            (new_status, note, now, rid),
        )
        db.commit()
        if result.rowcount == 0:
            return jsonify({"error": "Report not found."}), 404
    print(f"[LesionLens] Report {rid} → {new_status}")
    return jsonify({"report_id": rid, "status": new_status, "message": "Updated."})

@app.route("/my-reports", methods=["GET"])
def get_user_reports():
    email = request.args.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "email parameter required."}), 400
    with get_db() as db:
        rows = db.execute(
            """SELECT report_id, patient_email, prediction, status,
                      doctor_note, submitted_at, reviewed_at
               FROM reports
               WHERE patient_email=?
               ORDER BY submitted_at DESC""",
            (email,),
        ).fetchall()
    reports = []
    for row in rows:
        reports.append({
            "report_id":    row["report_id"],
            "status":       row["status"],
            "prediction":   json.loads(row["prediction"] or "{}"),
            "doctor_note":  row["doctor_note"],
            "submitted_at": row["submitted_at"],
            "reviewed_at":  row["reviewed_at"],
        })
    return jsonify({"reports": reports})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)