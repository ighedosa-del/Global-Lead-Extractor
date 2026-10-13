FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt package.json ./
RUN pip install --no-cache-dir -r requirements.txt && npm install --omit=dev
COPY . .
ENV PORT=10000
EXPOSE 10000
CMD ["node","server.js"]
