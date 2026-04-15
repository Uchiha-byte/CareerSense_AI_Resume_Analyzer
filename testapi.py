import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


def test_openai():
    print("\n🔍 Testing OpenAI...")
    try:
        from openai import OpenAI

        if not OPENAI_API_KEY:
            raise ValueError("Missing OPENAI_API_KEY")

        client = OpenAI(api_key=OPENAI_API_KEY)

        res = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Reply with OK"}],
        )

        print("✅ OpenAI OK:", res.choices[0].message.content.strip())

    except Exception as e:
        print("❌ OpenAI FAILED:", str(e))


def test_gemini():
    print("\n🔍 Testing Gemini...")
    try:
        import google.generativeai as genai

        if not GEMINI_API_KEY:
            raise ValueError("Missing GEMINI_API_KEY")

        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")

        res = model.generate_content("Reply with OK")

        print("✅ Gemini OK:", res.text.strip())

    except Exception as e:
        print("❌ Gemini FAILED:", str(e))


def test_openrouter():
    print("\n🔍 Testing OpenRouter...")
    try:
        if not OPENROUTER_API_KEY:
            raise ValueError("Missing OPENROUTER_API_KEY")

        url = "https://openrouter.ai/api/v1/chat/completions"

        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        }

        data = {
            "model": "openai/gpt-3.5-turbo",
            "messages": [{"role": "user", "content": "Reply with OK"}],
        }

        res = requests.post(url, headers=headers, json=data)

        if res.status_code == 200:
            output = res.json()["choices"][0]["message"]["content"]
            print("✅ OpenRouter OK:", output.strip())
        else:
            print("❌ OpenRouter FAILED:", res.status_code, res.text)

    except Exception as e:
        print("❌ OpenRouter FAILED:", str(e))


def main():
    print("🚀 Starting API Key Tests...")

    test_openai()
    test_gemini()
    test_openrouter()

    print("\n✅ Done.")


if __name__ == "__main__":
    main()