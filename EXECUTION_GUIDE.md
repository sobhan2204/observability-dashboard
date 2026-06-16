# Execution Guide: Observable Crypto Analytics Platform

This guide explains how to run each part of the pipeline and how to test the code.

## 1. Prerequisites Setup
- Install **Docker Desktop**.
- Install **Node.js (v18+)**.
- (Optional but recommended) Install an API client like **Postman** or **Insomnia**.

## 2. Infrastructure Setup
In the root directory, run:
```bash
docker-compose up -d
```
This starts:
- **PostgreSQL** (Port 5432)
- **Redis** (Port 6379)
- **Prometheus** (Port 9090)
- **Alertmanager** (Port 9093)
- **Loki** (Port 3100)
- **Tempo** (Port 3200)
- **Node Exporter** (Port 9100)
- **Grafana** (Port 3000) - Credentials: `admin` / `admin`

## 3. Backend Execution
In the root directory:
1. **Install dependencies:** `npm install`
2. **Setup Database:**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```
3. **Run Application:**
   - Dev mode (instrumented): `npm run dev`
   - The API will listen on **http://localhost:3030**.

## 4. Frontend Execution
In the `frontend` directory:
1. **Install dependencies:** `npm install`
2. **Run Application:** `npm run dev`
3. **Access UI:** Open **http://localhost:3005** in your browser.

## 5. Testing the Pipeline

### Manual Backend Testing (CLI/API Client)
- **Health Check:** `GET http://localhost:3030/ready`
- **Register:** `POST http://localhost:3030/api/auth/register` (JSON: `{"email": "test@test.com", "password": "password123"}`)
- **Login:** `POST http://localhost:3030/api/auth/login` (JSON: `{"email": "test@test.com", "password": "password123"}`) -> Copy the `token`.
- **Add Wallet:** `POST http://localhost:3030/api/wallets` (Headers: `Authorization: Bearer <token>`, JSON: `{"address": "0xabc...", "network": "ethereum"}`)

### Observability Testing
1. Log in to **Grafana** (`http://localhost:3000`).
2. Go to **Dashboards** -> **Crypto Analytics Dashboard**.
3. Perform some API requests (Login, Add Wallet) and watch the **HTTP Request Rate** and **Login Failures** graphs update.
4. Go to **Explore** -> Select **Loki** to see structured JSON logs.
5. Go to **Explore** -> Select **Tempo** to see distributed traces for your requests.

### Alerting & System Testing
1. **Check Alerts**: Open Prometheus (`http://localhost:9090`) and navigate to the **Alerts** tab to see configured rules (e.g., HighRequestRate).
2. **View Alertmanager**: Open Alertmanager (`http://localhost:9093`) to see active alerts being processed for notification.
3. **Simulate Load**: Bombard the API with requests to trigger the `HighRequestRate` alert and observe it moving from "Pending" to "Firing" in Prometheus.

### Frontend UI Testing
1. Navigate to `http://localhost:3005`.
2. You will be redirected to the **Access System** (Login) page.
3. Use the **Initialize Profile** link to register.
4. Log in to access the **Dashboard**.
5. Add a few wallets and observe the **Aggregated Intelligence** (Portfolio Value) update.
6. Delete a wallet and verify it disappears from the list.
