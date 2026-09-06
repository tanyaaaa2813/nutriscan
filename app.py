from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from functools import wraps
import pickle, os, numpy as np

app = Flask(__name__)
app.secret_key = "nutriscan_secret_2024"   # change this in production!

# ── Load ML model ────────────────────────────────────────────────
BASE = os.path.join(os.path.dirname(__file__), "model")
model     = pickle.load(open(f"{BASE}/model.pkl",    "rb"))
le_edu    = pickle.load(open(f"{BASE}/le_edu.pkl",   "rb"))
le_wealth = pickle.load(open(f"{BASE}/le_wealth.pkl","rb"))

# ── In-memory DB (replace with MySQL later) ──────────────────────
records = []
id_counter = [1]

# ── Fake users (replace with real DB + hashed passwords) ─────────
USERS = {
    "doctor@nutriscan.com":  {"password": "doctor123",  "role": "doctor",        "name": "Dr. Raghav Singh"},
    "worker@nutriscan.com":  {"password": "worker123",  "role": "health_worker", "name": "Priya Sharma"},
    "research@nutriscan.com":{"password": "research123","role": "researcher",    "name": "Dr. Arjun Mehta"},
    "admin@nutriscan.com":   {"password": "admin123",   "role": "admin",         "name": "Admin User"},
}

# ── Role permissions ──────────────────────────────────────────────
PERMISSIONS = {
    "doctor":        ["dashboard", "predict", "records_view", "records_edit", "records_delete", "export", "care_notes"],
    "health_worker": ["dashboard", "predict", "records_view"],
    "researcher":    ["dashboard", "records_view_anon", "export"],
    "admin":         ["dashboard", "records_view", "records_edit", "records_delete", "export", "manage_users"],
}

def has_permission(role, perm):
    return perm in PERMISSIONS.get(role, [])

# ── Auth decorators ───────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user" not in session:
            return jsonify({"error": "Unauthorized. Please login."}), 401
        return f(*args, **kwargs)
    return decorated

def require_permission(perm):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if "user" not in session:
                return jsonify({"error": "Unauthorized"}), 401
            role = session["user"]["role"]
            if not has_permission(role, perm):
                return jsonify({"error": f"Access denied. '{perm}' requires higher privileges."}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

# ── Page routes ───────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")

# ── Auth API ──────────────────────────────────────────────────────
@app.route("/api/login", methods=["POST"])
def login():
    data     = request.json
    email    = data.get("email", "").lower().strip()
    password = data.get("password", "")
    user     = USERS.get(email)
    if not user or user["password"] != password:
        return jsonify({"success": False, "error": "Invalid email or password"}), 401
    session["user"] = {"email": email, "role": user["role"], "name": user["name"]}
    return jsonify({
        "success": True,
        "user": {"name": user["name"], "role": user["role"], "email": email},
        "permissions": PERMISSIONS[user["role"]]
    })

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True})

@app.route("/api/me", methods=["GET"])
@login_required
def me():
    return jsonify({
        "user": session["user"],
        "permissions": PERMISSIONS[session["user"]["role"]]
    })

# ── Predict API ───────────────────────────────────────────────────
@app.route("/api/predict", methods=["POST"])
@require_permission("predict")
def predict():
    data = request.json
    try:
        edu_enc    = le_edu.transform([data["mother_education"]])[0]
        wealth_enc = le_wealth.transform([data["wealth_index"]])[0]
        features   = np.array([[
            int(data["age_months"]),
            float(data["weight_kg"]),
            float(data["height_cm"]),
            edu_enc, wealth_enc,
            int(data["clean_water"]),
            int(data["sanitation"]),
            int(data["breastfed"]),
            int(data["num_siblings"])
        ]])
        prediction  = int(model.predict(features)[0])
        probability = round(float(model.predict_proba(features)[0][1]) * 100, 1)

        rec = {
            "id":               id_counter[0],
            "child_name":       data.get("child_name", "Unknown"),
            "age_months":       int(data["age_months"]),
            "weight_kg":        float(data["weight_kg"]),
            "height_cm":        float(data["height_cm"]),
            "mother_education": data["mother_education"],
            "wealth_index":     data["wealth_index"],
            "clean_water":      int(data["clean_water"]),
            "sanitation":       int(data["sanitation"]),
            "breastfed":        int(data["breastfed"]),
            "num_siblings":     int(data["num_siblings"]),
            "prediction":       prediction,
            "probability":      probability,
            "added_by":         session["user"]["name"],
            "role":             session["user"]["role"],
        }
        records.append(rec)
        id_counter[0] += 1
        return jsonify({"success": True, "prediction": prediction, "probability": probability, "record": rec})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

# ── Records API ───────────────────────────────────────────────────
@app.route("/api/records", methods=["GET"])
@login_required
def get_records():
    role = session["user"]["role"]
    if has_permission(role, "records_view_anon"):
        # Researcher sees anonymised data only
        anon = [{
            "id": r["id"], "child_name": "Anonymous",
            "age_months": r["age_months"], "weight_kg": r["weight_kg"],
            "height_cm": r["height_cm"], "mother_education": r["mother_education"],
            "wealth_index": r["wealth_index"], "prediction": r["prediction"],
            "probability": r["probability"]
        } for r in records]
        return jsonify(sorted(anon, key=lambda x: x["id"], reverse=True))
    if has_permission(role, "records_view"):
        return jsonify(sorted(records, key=lambda x: x["id"], reverse=True))
    return jsonify({"error": "Access denied"}), 403

@app.route("/api/records/<int:rid>", methods=["PUT"])
@require_permission("records_edit")
def edit_record(rid):
    data = request.json
    for r in records:
        if r["id"] == rid:
            r.update({k: v for k, v in data.items() if k != "id"})
            return jsonify({"success": True, "record": r})
    return jsonify({"error": "Record not found"}), 404

@app.route("/api/records/<int:rid>", methods=["DELETE"])
@require_permission("records_delete")
def delete_record(rid):
    global records
    records = [r for r in records if r["id"] != rid]
    return jsonify({"success": True})

# ── Analytics API ─────────────────────────────────────────────────
@app.route("/api/analytics", methods=["GET"])
@require_permission("dashboard")
def analytics():
    total   = len(records)
    at_risk = sum(1 for r in records if r["prediction"] == 1)
    by_wealth = {}
    by_edu    = {}
    for r in records:
        w = r["wealth_index"]
        e = r["mother_education"]
        by_wealth.setdefault(w, {"total": 0, "at_risk": 0})
        by_wealth[w]["total"]   += 1
        by_wealth[w]["at_risk"] += r["prediction"]
        by_edu.setdefault(e, {"total": 0, "at_risk": 0})
        by_edu[e]["total"]   += 1
        by_edu[e]["at_risk"] += r["prediction"]
    return jsonify({
        "total": total, "at_risk": at_risk,
        "healthy": total - at_risk,
        "risk_rate": round(at_risk / total * 100, 1) if total else 0,
        "by_wealth": by_wealth, "by_education": by_edu,
        "recent": sorted(records, key=lambda x: x["id"], reverse=True)[:8]
    })

# ── Export API ────────────────────────────────────────────────────
@app.route("/api/export", methods=["GET"])
@require_permission("export")
def export_csv():
    import csv, io
    role = session["user"]["role"]
    output = io.StringIO()
    fields = ["id","child_name","age_months","weight_kg","height_cm",
              "mother_education","wealth_index","clean_water","sanitation",
              "breastfed","num_siblings","prediction","probability"]
    if role == "researcher":
        fields = [f for f in fields if f != "child_name"]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(records)
    from flask import Response
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=nutriscan_records.csv"}
    )

# ── Users API (Admin only) ────────────────────────────────────────
@app.route("/api/users", methods=["GET"])
@require_permission("manage_users")
def get_users():
    return jsonify([
        {"email": e, "name": u["name"], "role": u["role"]}
        for e, u in USERS.items()
    ])

if __name__ == "__main__":
    app.run(debug=True, port=5000)
