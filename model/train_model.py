"""
NutriScan — ML Model Training Script
Run this once before starting the Flask app:
    python model/train_model.py
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
import pickle, os

np.random.seed(42)
n = 2000

print("🔬 NutriScan — Training ML Model...")
print("=" * 45)

# Generate synthetic training data
df = pd.DataFrame({
    'age_months':       np.random.randint(1, 60, n),
    'weight_kg':        np.round(np.random.uniform(3, 20, n), 1),
    'height_cm':        np.round(np.random.uniform(45, 110, n), 1),
    'mother_education': np.random.choice(['none','primary','secondary','higher'], n, p=[0.3,0.3,0.25,0.15]),
    'wealth_index':     np.random.choice(['poor','middle','rich'], n, p=[0.5,0.3,0.2]),
    'clean_water':      np.random.choice([0, 1], n, p=[0.4, 0.6]),
    'sanitation':       np.random.choice([0, 1], n, p=[0.45, 0.55]),
    'breastfed':        np.random.choice([0, 1], n, p=[0.3, 0.7]),
    'num_siblings':     np.random.randint(0, 7, n),
})

risk_score = (
    (df['wealth_index'] == 'poor').astype(int) * 2 +
    (df['mother_education'] == 'none').astype(int) * 2 +
    (df['clean_water'] == 0).astype(int) +
    (df['sanitation'] == 0).astype(int) +
    (df['breastfed'] == 0).astype(int) +
    (df['num_siblings'] > 3).astype(int) +
    np.random.randint(0, 3, n)
)
df['at_risk'] = (risk_score >= 4).astype(int)

print(f"✅ Dataset created: {len(df)} children")
print(f"   At Risk: {df['at_risk'].sum()} ({df['at_risk'].mean()*100:.1f}%)")
print(f"   Healthy: {(~df['at_risk'].astype(bool)).sum()}")

# Encode categorical features
le_edu    = LabelEncoder().fit(['none','primary','secondary','higher'])
le_wealth = LabelEncoder().fit(['poor','middle','rich'])
df['edu_enc']    = le_edu.transform(df['mother_education'])
df['wealth_enc'] = le_wealth.transform(df['wealth_index'])

features = ['age_months','weight_kg','height_cm','edu_enc','wealth_enc',
            'clean_water','sanitation','breastfed','num_siblings']
X = df[features]; y = df['at_risk']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train
print("\n🤖 Training Random Forest (100 trees)...")
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
print(f"✅ Accuracy: {accuracy_score(y_test, y_pred)*100:.1f}%")
print("\nDetailed Report:")
print(classification_report(y_test, y_pred, target_names=['Healthy','At Risk']))

# Save
out = os.path.dirname(__file__)
pickle.dump(model,    open(os.path.join(out, 'model.pkl'),    'wb'))
pickle.dump(le_edu,   open(os.path.join(out, 'le_edu.pkl'),   'wb'))
pickle.dump(le_wealth,open(os.path.join(out, 'le_wealth.pkl'),'wb'))
print("✅ model.pkl, le_edu.pkl, le_wealth.pkl saved!")
print("\n🚀 Now run: python app.py")
