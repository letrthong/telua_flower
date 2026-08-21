FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1

# Cài Node.js và npm
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cài Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy package.json và lockfile trước để cache npm install
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy toàn bộ project
COPY . .

# Invalidate cache - change this date to force rebuild
ARG CACHEBUST=1

# Build frontend
RUN npm run build

# Copy toàn bộ file tĩnh (HTML, JS, CSS, Assets) sang Flask/Python static và ghi đè index.html gốc
RUN mkdir -p /app/src/static && \
    cp -r /app/dist/* /app/src/static/ || true && \
    cp /app/dist/index.html /app/index.html || true

# Create data directory
RUN mkdir -p /app/data
RUN chmod 777 -R /app/data

EXPOSE 5000

CMD ["python", "/app/src/app.py"]
