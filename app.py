from flask import Flask, render_template, jsonify
import json
import random
import os

app = Flask(__name__)

DATASET_DIR = os.path.join(os.path.dirname(__file__), "..", "dataset")


def load_json_file(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"[WARN] Missing file: {path}")
        return []
    except json.JSONDecodeError as e:
        print(f"[ERROR] Invalid JSON in: {path}")
        print(f"        {e}")
        return []


def load_questions():
    split_files = [
        "verbal.json",
        "numerical.json",
        "analytical.json",
        "general.json"
    ]

    all_questions = []

    for filename in split_files:
        path = os.path.join(DATASET_DIR, filename)
        data = load_json_file(path)
        if isinstance(data, list):
            all_questions.extend(data)

    # fallback if split files are empty
    if not all_questions:
        fallback = os.path.join(DATASET_DIR, "questions.json")
        data = load_json_file(fallback)
        if isinstance(data, list):
            all_questions.extend(data)

    return all_questions


@app.route("/")
def home():
    return render_template("index.html")


import json
from flask import jsonify

@app.route("/api/questions")
def get_questions():
    questions = []

    try:
        with open("dataset/analytical.json") as f:
            questions += json.load(f)

        with open("dataset/general.json") as f:
            questions += json.load(f)

        with open("dataset/numerical.json") as f:
            questions += json.load(f)

        with open("dataset/verbal.json") as f:
            questions += json.load(f)

    except Exception as e:
        print("Error loading dataset:", e)
        return jsonify({"error": str(e)})
print("TOTAL QUESTIONS:", len(questions))
print("Analytical:", len(json.load(open("dataset/analytical.json"))))
print("General:", len(json.load(open("dataset/General.json"))))
print("Numerical:", len(json.load(open("dataset/Numerical.json"))))
print("Verbal:", len(json.load(open("dataset/Verbal.json"))))
    # ✅ Always return JSON format
    return jsonify(questions)

    # ✅ Try balanced selection (safe version)
    analytical = [q for q in all_q if q.get("subject") == "Analytical"]
    verbal = [q for q in all_q if q.get("subject") == "Verbal"]
    numerical = [q for q in all_q if q.get("subject") == "Numerical"]
    general = [q for q in all_q if q.get("subject") == "General"]

    selected = []

    try:
        # ✅ Only sample if enough items exist
        selected += random.sample(analytical, min(40, len(analytical)))
        selected += random.sample(verbal, min(50, len(verbal)))
        selected += random.sample(numerical, min(50, len(numerical)))
        selected += random.sample(general, min(30, len(general)))
    except ValueError:
        # fallback if categories are uneven
        pass

    # ✅ If not enough, fill from remaining pool
    if len(selected) < 170:
        remaining = [q for q in all_q if q not in selected]
        needed = 170 - len(selected)
        selected += random.sample(remaining, min(needed, len(remaining)))

    # ✅ Final shuffle
    random.shuffle(selected)

    return jsonify(selected[:170])


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
