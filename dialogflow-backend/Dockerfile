# Use official Python 3.9 image as the base
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies (e.g., for sentence-transformers, chromadb)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libatlas-base-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements.txt and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your application code and other files
COPY . .

# Expose the port Cloud Run will use
EXPOSE 8080

# Set environment variables (override in Cloud Run if needed)
ENV FIRESTORE_PROJECT_ID="your-gcp-project-id" \
    GROQ_API_KEY="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" \
    GOOGLE_APPLICATION_CREDENTIALS="/app/service-account.json" \
    CUDA_AVAILABLE="false"

# Run the FastAPI app with Uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]