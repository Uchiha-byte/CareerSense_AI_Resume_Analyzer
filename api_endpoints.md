# CareerSense API Documentation

This document outlines the endpoints for the CareerSense backend, including request structures, response formats, and the internal AI routing logic.

## 🟢 Base URL
`http://localhost:xxxx`

---

## 🦾 AI Routing Protocol
The API does not rely on a single model. It traverses a **Priority Hierarchy** to ensure reliability:

1.  **Tier 1 (Priority 0)**: 6 Free OpenRouter Models (Gemma, Mistral, Llama, Qwen, etc.)
2.  **Tier 2 (Priority 1)**: Google Gemini 2.0 Flash / 1.5 Pro
3.  **Tier 3 (Priority 2)**: OpenAI GPT-4o / GPT-4o-mini

---

## 1. Create Analysis Session
**`POST /api/sessions`**

Initializes a new resume analysis. Supports both raw text and file uploads.

### Request Format
`Content-Type: multipart/form-data`

| Key | Type | Description |
|---|---|---|
| `resumeFile` | `File` | (Optional) PDF, PNG, or JPG file. |
| `resume` | `String` | (Optional) Raw resume text if no file provided. |
| `targetRole` | `String` | **Required**. The job title to analyze against. |
| `targetCompanies` | `JSON` | (Optional) Array of company names (e.g., `["Apple", "Google"]`). |

### Response
```json
{
  "sessionId": "49b...-45aa-...",
  "status": "processing"
}
```

---

## 2. Retrieve Session Result
**`GET /api/sessions/:id`**

Fetches the current status or the finalized analysis result for a session.

### Possible Statuses
- `pending`: Session created, analysis not yet started.
- `processing`: AI engines are currently generating the report.
- `complete`: Analysis successful; results included in payload.
- `error`: Analysis failed after all retry attempts.

### Response (Status: Complete)
```json
{
  "id": "...",
  "status": "complete",
  "result": {
    "resumeScore": { "overall": 85, "breakdown": { ... }, "rationale": [...] },
    "heatmap": { "sections": [...], "missingSections": [...] },
    "gapAnalysis": { "readinessPercentage": 72, "gaps": [...] },
    "bulletImprovements": [...],
    "roadmap": { "phases": [...] },
    "finalVerdict": { ... }
  },
  "createdAt": 171...
}
```

---

## 3. System Pool Status
**`GET /api/pool-status`**

Monitoring endpoint to view current AI engine health and capacity.

### Response
```json
[
  {
    "modelId": "or-gemma-2-9b",
    "provider": "openrouter",
    "activeSessions": 2,
    "maxConcurrent": 10,
    "available": true
  },
  ...
]
```

---

## 🛑 Fault Tolerance
- **Timeouts**: Every model call has a **60s** hard limit. 
- **Retry Loop**: The system attempts up to **5 different models** from the pool before returning an `error` status.
- **Circuit Breaking**: If a provider fails, it is marked as `unavailable` for **120 seconds**, preventing the system from retrying dead endpoints.
