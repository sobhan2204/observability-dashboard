# Observable Crypto Analytics Platform

A production-grade, full-stack platform for crypto portfolio management with a heavy focus on **observability**, **security**, and **scalable analytics**. This platform demonstrates how to build a modern fintech application with deep visibility into system performance and security events.

## 🚀 Key Features

- **Wallet Management**: Seamlessly add and track crypto wallets across multiple networks (Ethereum, Bitcoin).
- **Real-time Portfolio Valuation**: Automated value calculation using the CoinGecko API with high-performance caching.
- **Deep Observability**:
  - **Metrics**: Detailed system and business metrics scraped by **Prometheus**.
  - **Distributed Tracing**: End-to-end request tracking using **OpenTelemetry** and **Grafana Tempo**.
  - **Centralized Logging**: Structured logging with **Winston** and **Grafana Loki**.
  - **Visual Dashboards**: Pre-configured **Grafana** dashboards for real-time monitoring.
- **Enterprise Security**:
  - **Authentication**: Secure JWT-based user authentication.
  - **Audit Logging**: Comprehensive tracking of all user actions and system changes.
  - **Security Events**: Automatic detection and logging of suspicious activities (e.g., failed wallet additions).
  - **Rate Limiting**: Protection against DDoS and brute-force attacks.
- **Performance**: High-speed price data retrieval via **Redis** caching.

## 🛠️ Tech Stack

- **Frontend**: [Next.js](https://nextjs.org/) (App Router), TypeScript, Lucide Icons, Vanilla CSS.
- **Backend**: [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), TypeScript.
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/).
- **Cache**: [Redis](https://r
edis.io/).
- **Observability**: 
  - [Prometheus](https://prometheus.io/) (Metrics)
  - [Grafana](https://grafana.com/) (Visualization)
  - [Loki](https://grafana.com/oss/loki/) (Logs)
  - [Tempo](https://grafana.com/oss/tempo/) (Traces)
  - [OpenTelemetry](https://opentelemetry.io/) (Instrumentation)
- **Infrastructure**: [Docker Compose](https://www.docker.com/).

## 📂 Project Structure

- `src/` - Backend API source code (Services, Routes, Middlewares).
- `frontend/` - Next.js client application.
- `prisma/` - Database schema and migrations.
- `docker-compose.yml` - Full infrastructure orchestration.
- `prometheus-config.yml` - Metrics scraping configuration.
- `grafana-dashboards.yml` / `grafana-datasources.yml` - Automated Grafana provisioning.

## 🏁 Getting Started

To get the platform up and running, please refer to the detailed **[EXECUTION_GUIDE.md](./EXECUTION_GUIDE.md)**.

### Quick Start Summary:
1. **Infrastructure**: `docker-compose up -d`
2. **Backend**: 
   - `npm install`
   - `npx prisma migrate dev`
   - `npm run dev`
3. **Frontend**:
   - `cd frontend && npm install`
   - `npm run dev`

## 📊 Observability & Monitoring

The platform is designed to be fully observable. Once running, you can access:
- **Grafana**: `http://localhost:3000` (Default: admin/admin)
- **Prometheus**: `http://localhost:9090`
- **Loki/Tempo**: Integrated directly into Grafana's Explore view.

Custom metrics include:
- `http_requests_total`: Request counter by method and status.
- `wallet_lookup_total`: Business logic counter for wallet access.
- `portfolio_requests_total`: Counter for portfolio value calculations.
- `external_api_latency`: Latency tracking for CoinGecko API calls.

## 🔒 Security Measures

- **JWT Auth**: Tokens are required for all sensitive routes.
- **Audit Trails**: Every wallet addition or removal is logged with user ID, IP, and timestamp.
- **Error Handling**: Standardized error responses to prevent sensitive data leakage.
- **Rate Limiting**: Configured to prevent API abuse.
- **Helmet.js**: HTTP headers security.
