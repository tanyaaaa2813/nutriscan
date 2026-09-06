# 🔬 NutriScan — Child Malnutrition Risk Predictor

## 📁 Project Structure
```
nutriscan/
├── app.py                  ← Flask backend + REST API + Role-based auth
├── requirements.txt        ← Python dependencies
├── README.md
│
├── model/
│   ├── train_model.py      ← Train ML model (run once)
│   ├── model.pkl           ← Trained Random Forest
│   ├── le_edu.pkl          ← Education label encoder
│   └── le_wealth.pkl       ← Wealth label encoder
│
├── templates/
│   └── index.html          ← Full frontend (all pages)
│
└── static/
    ├── css/
    │   └── style.css       ← All styles (kid-friendly theme)
    └── js/
        └── app.js          ← All frontend JavaScript
```

---

## ⚡ Setup in VS Code

### Step 1 — Open in VS Code
```
File → Open Folder → select nutriscan/
```

### Step 2 — Create virtual environment (recommended)
```bash
python -m venv venv

# Activate:
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
```

### Step 3 — Install dependencies
```bash
pip install -r requirements.txt
```

### Step 4 — Train the ML model (run only once)
```bash
python model/train_model.py
```

### Step 5 — Run the app
```bash
python app.py
```

### Step 6 — Open browser
```
http://localhost:5000
```

---

## 🔑 Demo Login Accounts

| Role         | Email                      | Password     | Access |
|--------------|----------------------------|--------------|--------|
| Doctor       | doctor@nutriscan.com       | doctor123    | Full   |
| Health Worker| worker@nutriscan.com       | worker123    | View + Predict |
| Researcher   | research@nutriscan.com     | research123  | Analytics only |
| Admin        | admin@nutriscan.com        | admin123     | System management |

---

## 🔒 Role Permissions

| Feature              | Doctor | Health Worker | Researcher | Admin |
|----------------------|:------:|:-------------:|:----------:|:-----:|
| Dashboard & charts   | ✅     | ✅            | ✅         | ✅    |
| Run ML prediction    | ✅     | ✅            | ❌         | ❌    |
| View records (full)  | ✅     | ✅            | ❌         | ✅    |
| View records (anon)  | ❌     | ❌            | ✅         | ❌    |
| Edit records         | ✅     | ❌            | ❌         | ✅    |
| Delete records       | ✅     | ❌            | ❌         | ✅    |
| Export CSV           | ✅     | ❌            | ✅         | ✅    |
| Manage users         | ❌     | ❌            | ❌         | ✅    |

---

## 🗄️ Connect MySQL (Production)

### 1. Install
```bash
pip install flask-mysqldb
```

### 2. Create database
```sql
CREATE DATABASE nutriscan_db;
USE nutriscan_db;

CREATE TABLE child_records (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  child_name       VARCHAR(100),
  age_months       INT,
  weight_kg        DECIMAL(5,2),
  height_cm        DECIMAL(5,2),
  mother_education VARCHAR(20),
  wealth_index     VARCHAR(20),
  clean_water      TINYINT(1),
  sanitation       TINYINT(1),
  breastfed        TINYINT(1),
  num_siblings     INT,
  prediction       TINYINT(1),
  probability      DECIMAL(5,2),
  added_by         VARCHAR(100),
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Update app.py
```python
from flask_mysqldb import MySQL
app.config['MYSQL_HOST']     = 'localhost'
app.config['MYSQL_USER']     = 'root'
app.config['MYSQL_PASSWORD'] = 'your_password'
app.config['MYSQL_DB']       = 'nutriscan_db'
mysql = MySQL(app)
```

---

## 🤖 ML Model
- **Algorithm:** Random Forest Classifier (100 trees)
- **Accuracy:** ~83%
- **Features:** Age, Weight, Height, Mother's Education, Wealth Index, Clean Water, Sanitation, Breastfeeding, Siblings

## 🛠️ Tech Stack
- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript + Chart.js
- **Backend:** Python 3 + Flask (REST API)
- **Auth:** Flask sessions with role-based access control
- **ML:** Scikit-learn Random Forest
- **Database:** In-memory (dev) → MySQL (production)
