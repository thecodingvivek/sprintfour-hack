# Deployment Guide: ADK Agent to Google Cloud Run

This guide contains the exact steps and commands used to containerize the FastAPI ADK Agent and deploy it to Google Cloud Run.

---

## 1. Local Testing with Docker

Before deploying to the cloud, it is best practice to test the container locally to ensure there are no missing dependencies.

### Build the Docker Image
Run this from the root of your project:
```bash
docker build -t adk-agent-local .
```

### Run the Docker Container Locally
Since we don't upload the `.env` file for security reasons, we pass it dynamically when running the container.
```bash
docker run -p 8080:8080 --env-file test_agent/.env adk-agent-local
```

### Test the Local Container
In a separate terminal tab, send a POST request to your local container:
```bash
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

---

## 2. Google Cloud Prerequisites

Because this project uses Vertex AI (`GOOGLE_GENAI_USE_VERTEXAI=1`), the following must be set up in your Google Cloud Project (`fourhack-5f384`):

1. **Enable the Vertex AI API:** You must explicitly enable the Agent Platform API.
   👉 [Enable Vertex AI API](https://console.developers.google.com/apis/api/aiplatform.googleapis.com/overview?project=fourhack-5f384)
2. **Enable Billing:** Vertex AI requires a linked billing account (credit card), even for free tier usage.
   👉 [Enable Billing](https://console.developers.google.com/billing/enable?project=fourhack-5f384)
3. **IAM Permissions:** The service account must have the `Vertex AI User` role.

---

## 3. Deploy to Google Cloud Run

Google Cloud Run automatically builds the container in the cloud and hosts it on a serverless architecture with a massive timeout limit (unlike Vercel).

Run this exact single-line command to deploy:

```bash
gcloud run deploy adk-agent-api --source . --allow-unauthenticated --region=us-central1 --project=fourhack-5f384 --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=1,GOOGLE_CLOUD_PROJECT=fourhack-5f384,GOOGLE_CLOUD_LOCATION=us-central1"
```

*(If prompted to enable APIs like Artifact Registry or Cloud Build, type `y` and press enter).*

---

## 4. Test the Live Deployment

Once the deployment succeeds, it will output a service URL. You can test your live agent from anywhere on the internet using this command:

```bash
curl -X POST https://adk-agent-api-1059264190645.us-central1.run.app/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from my agent!"}'
```

### Important Notes
* **Deterministic URLs:** Your Cloud Run URL (e.g. `https://adk-agent-api-1059264190645.us-central1.run.app`) will remain the same forever as long as you deploy using the same service name (`adk-agent-api`).
* **Session Collisions:** We updated `router.py` to use `uuid.uuid4()` for session IDs. This ensures that every HTTP request gets a unique temporary memory session, preventing `500 Internal Server Errors` on consecutive requests.
