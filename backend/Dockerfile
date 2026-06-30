# Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Ensure Python output is sent straight to terminal without buffering
ENV PYTHONUNBUFFERED=1

# Set the service account credentials path for the container
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/fourhack-5f384-136980915a0a.json

# Cloud Run expects the server to listen on port 8080 by default
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
