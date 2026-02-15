FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the FinBERT-ESG-9 model at build time (baked into image)
RUN python -c "from transformers import AutoTokenizer, AutoModelForSequenceClassification; \
    AutoTokenizer.from_pretrained('yiyanghkust/finbert-esg-9-categories'); \
    AutoModelForSequenceClassification.from_pretrained('yiyanghkust/finbert-esg-9-categories')"

# Copy application code
COPY server.py .

# Expose the port
EXPOSE 8080

# Run the inference server (gunicorn). Keep workers=1 to avoid loading the model multiple times.
CMD ["sh", "-lc", "gunicorn -w 1 --threads 4 -b 0.0.0.0:${PORT:-8080} --timeout 120 server:app"]
