import os
import io
import torch
import torch.nn as nn
import torchvision.transforms as transforms
from torchvision import models
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

CHECKPOINT_PATH = "best_model.pth"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
NUM_CLASSES = 7

VALID_EMAIL = "team@neuralderm.ai"
VALID_PASS  = "Hackdiwas30"

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
    0: "akiec",
    1: "bcc",
    2: "bkl",
    3: "df",
    4: "mel",
    5: "nv",
    6: "vasc",
}

RISK_LEVEL = {
    0: "moderate",   
    1: "high",       
    2: "low",        
    3: "low",        
    4: "high",       
    5: "low",        
    6: "moderate",   
}


def build_model():
    """EfficientNet-B3 — identical architecture used in Kaggle training."""
    model = models.efficientnet_b3(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3, inplace=True),
        nn.Linear(in_features, NUM_CLASSES),
    )
    return model


def load_model(checkpoint_path: str):
    model = build_model()
    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(
            f"\n{'='*55}\n"
            f"  Checkpoint not found: '{checkpoint_path}'\n"
            f"  Steps to fix:\n"
            f"  1. Download fold1_best.pth from Kaggle Output tab\n"
            f"  2. Rename it to: best_model.pth\n"
            f"  3. Place it in the same folder as app.py\n"
            f"{'='*55}"
        )
    checkpoint = torch.load(checkpoint_path, map_location=DEVICE)
    # Handle both raw state_dict and wrapped checkpoint dicts
    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        state_dict = checkpoint["model_state_dict"]
    else:
        state_dict = checkpoint
    model.load_state_dict(state_dict)
    model.to(DEVICE)
    model.eval()
    print(f"[LesionLens] ✅ Model loaded from '{checkpoint_path}' on {DEVICE}")
    return model



TRANSFORM = transforms.Compose([
    transforms.Resize((300, 300)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],  
        std=[0.229, 0.224, 0.225],
    ),
])


def preprocess_image(file_bytes: bytes) -> torch.Tensor:
    image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    tensor = TRANSFORM(image).unsqueeze(0)
    return tensor.to(DEVICE)


model = load_model(CHECKPOINT_PATH)



@app.route("/", methods=["GET"])
def health():
    """Health check — verify API is running."""
    return jsonify({
        "status": "ok",
        "app": "LesionLens API",
        "model": "EfficientNet-B3",
        "classes": NUM_CLASSES,
        "device": str(DEVICE),
        "accuracy": "84.07% mean CV (5-fold)",
        "hackathon": "Hackdiwas 3.0 · Team Neural",
    })


@app.route("/login", methods=["POST"])
def login():
    """
    Optional server-side login check.
    Accepts: JSON { "email": "...", "password": "..." }
    Note: login.html handles auth client-side, this is for completeness.
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    if email == VALID_EMAIL and password == VALID_PASS:
        return jsonify({"status": "ok", "message": "Login successful"})
    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/predict", methods=["POST"])
def predict():
    """
    Main inference endpoint.
    Accepts : multipart/form-data with field 'image' (jpg / png)
    Returns : JSON with top prediction + full 7-class probability distribution
    """
    if "image" not in request.files:
        return jsonify({
            "error": "No image file found. Send as multipart form field named 'image'."
        }), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty filename."}), 400

    try:
        image_bytes = file.read()
        tensor = preprocess_image(image_bytes)
    except Exception as e:
        return jsonify({"error": f"Image processing failed: {str(e)}"}), 400

    with torch.no_grad():
        logits = model(tensor)                      
        probs  = torch.softmax(logits, dim=1)[0]    
        top_idx  = int(torch.argmax(probs).item())
        top_conf = float(probs[top_idx].item())

    all_probs = [
        {
            "class_idx":  i,
            "code":       CLASS_CODES[i],
            "label":      CLASS_NAMES[i],
            "confidence": round(float(probs[i].item()) * 100, 2),
            "risk":       RISK_LEVEL[i],
        }
        for i in range(NUM_CLASSES)
    ]
    all_probs.sort(key=lambda x: x["confidence"], reverse=True)

    return jsonify({
        "prediction": {
            "class_idx":  top_idx,
            "code":       CLASS_CODES[top_idx],
            "label":      CLASS_NAMES[top_idx],
            "confidence": round(top_conf * 100, 2),
            "risk":       RISK_LEVEL[top_idx],
        },
        "all_classes": all_probs,
        "device": str(DEVICE),
    })



if __name__ == "__main__":
    print("\n" + "="*55)
    print("  LesionLens API — Hackdiwas 3.0")
    print("  Team Neural · EfficientNet-B3 · HAM10000")
    print(f"  Device  : {DEVICE}")
    print(f"  Classes : {NUM_CLASSES}")
    print("  Running : http://localhost:5000")
    print("="*55 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=False)