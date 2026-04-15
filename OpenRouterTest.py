import os
import requests
import json
from dotenv import load_dotenv

# Load env
load_dotenv()
API_KEY = os.getenv("OPENROUTER_API_KEY")

if not API_KEY:
    raise ValueError("❌ OPENROUTER_API_KEY missing in .env")

# ✅ Your model list
MODELS = [
    ("or-nemotron-super", "nvidia/nemotron-3-super-120b-a12b:free"),
    ("or-trinity-large", "arcee-ai/trinity-large-preview:free"),
    ("or-glm-4.5", "z-ai/glm-4.5-air:free"),
    ("or-gpt-oss", "openai/gpt-oss-120b:free"),
    ("or-nemotron-nano", "nvidia/nemotron-3-nano-30b-a3b:free"),
    ("or-minimax", "minimax/minimax-m2.5:free"),
    ("or-nemotron-9b", "nvidia/nemotron-nano-9b-v2:free"),
    ("or-gemma-4", "google/gemma-4-31b-it:free"),
    ("or-nemotron-vl", "nvidia/nemotron-nano-12b-v2-vl:free"),
]

# ✅ JSON-style input prompt
json_input = {
    "query": "what is the current time and date?",
    "format": "json",
    "instruction": "Respond in JSON with keys: time, date"
}

URL = "https://openrouter.ai/api/v1/chat/completions"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


def test_model(model_id, model_name):
    print(f"\n🔍 Testing {model_id} ({model_name})")

    try:
        payload = {
            "model": model_name,
            "messages": [
                {
                    "role": "user",
                    "content": json.dumps(json_input)
                }
            ],
            "temperature": 0.2
        }

        response = requests.post(URL, headers=HEADERS, json=payload, timeout=30)

        if response.status_code == 200:
            data = response.json()
            output = data["choices"][0]["message"]["content"]

            print("✅ WORKING")
            print("Response:", output[:200], "...")  # trim long output

        else:
            print("❌ FAILED")
            print("Status:", response.status_code)
            print("Error:", response.text)

    except Exception as e:
        print("❌ ERROR:", str(e))


def main():
    print("🚀 Testing OpenRouter Models...\n")

    for model_id, model_name in MODELS:
        test_model(model_id, model_name)

    print("\n✅ Testing Complete")


if __name__ == "__main__":
    main()