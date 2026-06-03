import json

def generate_explanation(q):
    question = q.get("question", "").lower()
    answer = q.get("answer", "")
    subtopic = q.get("subtopic", "").lower()

    # ---- ANALOGY ----
    if "::" in question or "analogy" in subtopic:
        return f"This is an analogy question. The relationship between the first pair is applied to the second pair. '{answer}' correctly maintains that relationship."

    # ---- LOGICAL ----
    if answer.lower() in ["true", "false", "uncertain"] or "logical" in subtopic:
        return f"This question tests logical reasoning. Based on the given information, the correct conclusion is '{answer}'."

    # ---- PARAGRAPH ----
    if "paragraph" in subtopic or "sequence" in question:
        return f"This question checks logical flow. The sequence '{answer}' correctly organizes the ideas into a meaningful paragraph."

    # ---- DATA INTERPRETATION ----
    if any(k in question for k in ["percent", "ratio", "difference", "average"]):
        return f"This question requires interpreting data or performing calculations. The correct answer '{answer}' comes from properly analyzing the given values."

    # ---- FALLBACK ----
    return f"The correct answer is '{answer}' based on applying the appropriate reasoning method."


def process_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for q in data:
        if "explanation" not in q:
            q["explanation"] = generate_explanation(q)

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"✅ Updated: {file_path}")


if __name__ == "__main__":
    print("=== Generating Explanations ===")

    files = [
        "analytical.json",
        "numerical.json",
        "verbal.json",
        "general.json"
    ]

    for file in files:
        try:
            process_file(file)
        except FileNotFoundError:
            print(f"⚠ Skipped (not found): {file}")

    print("✅ All done!")