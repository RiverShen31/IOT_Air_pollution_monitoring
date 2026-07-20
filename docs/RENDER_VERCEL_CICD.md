# 🚀 Render, Vercel & CI/CD Pipeline

## 📍 Kiến trúc Deployment Toàn cảnh

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Repository                           │
│                  (RiverShen31/IOT_...)                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ main branch (production)                                   │ │
│  │ - backend/                                                 │ │
│  │ - web/                                                     │ │
│  │ - wokwi/                                                   │ │
│  │ - device-simulator/                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────┬──────────────────────────┬──────────────────────────────┘
         │                          │
         │ (Git push)               │ (Git push)
         │                          │
    ┌────▼────────┐          ┌─────▼─────────┐
    │   RENDER    │          │    VERCEL     │
    │ (Backend)   │          │   (Frontend)  │
    └────┬────────┘          └─────┬─────────┘
         │                         │
         │                         │
    ┌────▼─────────────────────────▼─────┐
    │         CI/CD Pipeline              │
    │  (Automatic build & deploy)         │
    └────┬──────────────────────────────┬─┘
         │                              │
    ┌────▼────────────────┐      ┌──────▼──────────┐
    │  Build & Test       │      │  Build & Test   │
    │  └─ npm install     │      │  └─ npm install │
    │  └─ npm start       │      │  └─ npm run dev │
    │  └─ run tests       │      │  └─ npm run build
    └────┬────────────────┘      └──────┬──────────┘
         │                              │
    ┌────▼────────────────┐      ┌──────▼──────────┐
    │  Deploy to Render   │      │ Deploy to Vercel│
    │  http://localhost   │      │ https://iot-... │
    │  :4000 (backend)    │      │ .vercel.app     │
    └────┬────────────────┘      └──────┬──────────┘
         │                              │
    ┌────▼──────────────────────────────▼──────┐
    │    Production Environment               │
    │  (Users can access live application)    │
    └──────────────────────────────────────────┘
```

---

## 🟠 RENDER (Backend Deployment)

### ❓ Render là gì?

Render là **platform hosting Node.js** (giống Heroku, nhưng free tier tốt hơn):
- Tự động build và deploy
- Webhooks từ GitHub
- Environment variables management
- Database connectivity
- Persistent file storage (tuỳ plan)

### 🔧 Cấu hình Render trong dự án:

**File:** `render.yaml` (Blueprint)
```yaml
services:
  - type: web
    name: iot-backend
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: MONGO_URI
        value: mongodb+srv://...  # MongoDB Atlas
      - key: MQTT_URL
        value: mqtts://...         # HiveMQ Cloud
```

### 📊 Quy trình Render:

```
┌─────────────────────────┐
│  Commit → Push to main  │
│  (GitHub)               │
└────────────┬────────────┘
             │
             │ (GitHub webhook trigger)
             ▼
┌─────────────────────────────────────┐
│  Render detects change              │
│  (monitoring main branch)            │
└────────────┬────────────────────────┘
             │
             │ (Clone repo)
             ▼
┌─────────────────────────────────────┐
│  Build Phase                        │
│  ├─ npm install                     │
│  ├─ Load .env variables             │
│  └─ npm start                       │
└────────────┬────────────────────────┘
             │
             │ ✅ Success
             ▼
┌─────────────────────────────────────┐
│  Deploy to Render                   │
│  ├─ Restart service                 │
│  ├─ Port 4000 (Express server)      │
│  └─ Connect to MongoDB Atlas        │
│     & HiveMQ Cloud                  │
└────────────┬────────────────────────┘
             │
             ▼
    🌐 https://iot-backend.onrender.com
       (API endpoint live)
```

### 📌 Backend Service Details:

```
Render Service:
├─ Name: iot-backend (hoặc tương tự)
├─ Runtime: Node.js (v18+)
├─ Region: Singapore / US
├─ Plan: Free tier (auto-sleep after 15min inactivity)
├─ Start Command: npm start
│  └─ Runs: node src/server.js
├─ Environment Variables:
│  ├─ MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
│  ├─ MQTT_URL=mqtts://broker.hivemq.cloud:8883
│  ├─ MQTT_USERNAME=device-user
│  ├─ MQTT_PASSWORD=****
│  └─ NODE_ENV=production
└─ Logs: Real-time in Render dashboard
```

### 🔗 Backend URL:
```
Local dev:   http://localhost:4000
Render prod: https://iot-backend.onrender.com
             (hoặc tên custom nếu có)
```

---

## 🔵 VERCEL (Frontend Deployment)

### ❓ Vercel là gì?

Vercel là **platform hosting Next.js/React** (chuyên biệt cho frontend):
- Tối ưu hóa React builds
- Edge functions (serverless)
- Auto-scaling
- CDN toàn cầu
- Instant rollbacks

### 🔧 Cấu hình Vercel trong dự án:

**File:** `web/.vercel.json` hoặc `web/vercel.json`
```json
{
  "name": "iot-web",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_API_URL": "https://iot-backend.onrender.com"
  }
}
```

**File:** `web/.env.example`
```
VITE_API_URL=https://iot-backend.onrender.com
VITE_API_TIMEOUT=10000
```

### 📊 Quy trình Vercel:

```
┌─────────────────────────┐
│  Commit → Push to main  │
│  (GitHub - web/ folder) │
└────────────┬────────────┘
             │
             │ (GitHub webhook)
             ▼
┌────────────────────────────────────┐
│  Vercel detects change in /web     │
│  (auto-detect from git structure)  │
└────────────┬───────────────────────┘
             │
             │ (Clone repo)
             ▼
┌────────────────────────────────────┐
│  Build Phase (Vite)                │
│  ├─ npm install                    │
│  ├─ npm run build                  │
│  │  └─ Compiles React + Vite       │
│  │     Output → /dist (static SPA)│
│  └─ Inject env vars                │
│     (VITE_API_URL)                 │
└────────────┬───────────────────────┘
             │
             │ ✅ Build success
             ▼
┌────────────────────────────────────┐
│  Deploy to Vercel CDN              │
│  ├─ Upload /dist files             │
│  ├─ Serve from edge locations      │
│  └─ Cache-busting (automatic)      │
└────────────┬───────────────────────┘
             │
             ▼
  🌐 https://iot-app.vercel.app
     (SPA endpoint live)
```

### 📌 Frontend Service Details:

```
Vercel Project:
├─ Name: iot-air-pollution-monitoring
├─ Framework: React + Vite
├─ Node.js Runtime: 18.x
├─ Build Output: /dist (static files)
├─ Build Command: npm run build
├─ Output Directory: dist
├─ Environment Variables:
│  └─ VITE_API_URL=https://iot-backend.onrender.com
├─ Domains:
│  ├─ iot-air-pollution-monitoring.vercel.app (auto)
│  └─ youromain.com (custom, nếu có)
├─ Preview Deployments: On every PR
└─ Production: Only on main branch
```

### 🔗 Frontend URL:
```
Local dev:   http://localhost:5173
Vercel prod: https://iot-air-pollution-monitoring.vercel.app
```

---

## 🔄 CI/CD Pipeline Chi tiết

### Quy trình đầy đủ từ Git → Sản phẩm:

```
┌──────────────────────────────────────────────────────┐
│  STEP 1: Developer Push Code                         │
│  git add . && git commit -m "..." && git push        │
└──────────────┬───────────────────────────────────────┘
               │
    ┌──────────┴────────────┐
    │                       │
    │ (Git webhook)         │ (Git webhook)
    │                       │
┌───▼──────────────┐  ┌────▼───────────────┐
│  STEP 2A:        │  │  STEP 2B:          │
│  Backend change? │  │  Frontend change?  │
│  backend/*       │  │  web/*             │
│  (trigger)       │  │  (trigger)         │
└───┬──────────────┘  └────┬───────────────┘
    │                      │
    │                      │
┌───▼──────────────────────▼──────────────┐
│  STEP 3: Automated Build                │
│  ┌──────────────────────────────────┐  │
│  │ Backend (Render)                 │  │
│  │ ├─ npm install                   │  │
│  │ ├─ Load env vars                 │  │
│  │ ├─ Start: node src/server.js     │  │
│  │ └─ Test MQTT + MongoDB connect   │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ Frontend (Vercel)                │  │
│  │ ├─ npm install                   │  │
│  │ ├─ npm run build (Vite)          │  │
│  │ ├─ Inject VITE_API_URL env       │  │
│  │ └─ Output /dist                  │  │
│  └──────────────────────────────────┘  │
└───┬──────────────────────────────────┬──┘
    │                                  │
    │ ✅ Build success?                │ ✅ Build success?
    │                                  │
┌───▼──────────────────────────────────▼──┐
│  STEP 4: Automated Testing (optional)    │
│  ├─ Run test suite (nếu có)              │
│  ├─ Check build artifacts                │
│  └─ Lint code (ESLint, Prettier)        │
└───┬───────────────────────────────────┬──┘
    │                                  │
    │ ✅ Pass all tests?                │ ✅ Pass all tests?
    │                                  │
┌───▼──────────────────────────────────▼──┐
│  STEP 5: Automated Deployment            │
│                                          │
│  ┌──────────────────────────────────┐  │
│  │ Backend → Render                 │  │
│  │ ├─ Deploy service                │  │
│  │ ├─ Restart container             │  │
│  │ ├─ Health check                  │  │
│  │ └─ Available at                  │  │
│  │   iot-backend.onrender.com       │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ Frontend → Vercel                │  │
│  │ ├─ Upload /dist to CDN           │  │
│  │ ├─ Cache invalidation            │  │
│  │ ├─ SSL cert auto (HTTPS)         │  │
│  │ └─ Available at                  │  │
│  │   iot-app.vercel.app             │  │
│  └──────────────────────────────────┘  │
└───┬──────────────────────────────────┬──┘
    │                                  │
    ▼                                  ▼
  ✅ Backend Live                  ✅ Frontend Live
  (API requests work)              (Users can access)
```

---

## 🔌 Kết nối Between Services

### Bước kết nối (Backend + Frontend):

```
Frontend (Vercel)          Backend (Render)
    ├─ React app              ├─ Express.js
    ├─ Socket.IO client       ├─ Socket.IO server
    └─ API calls              └─ API endpoints
        │                         │
        └─────────────────────────┘
        
        VITE_API_URL environment variable
        = https://iot-backend.onrender.com
        
        Frontend biết gọi API về backend ở đâu!
```

### API Calls Flow:

```
1. User opens frontend:
   https://iot-app.vercel.app
   ↓
2. Frontend loads (React SPA from Vercel CDN)
   ↓
3. React code starts:
   const API_URL = import.meta.env.VITE_API_URL
   // = https://iot-backend.onrender.com
   ↓
4. Make API call:
   fetch(`${API_URL}/devices`)
   ↓
5. Render backend receives request
   ↓
6. Query MongoDB → Return data
   ↓
7. Response goes back to Vercel frontend
   ↓
8. React renders UI with data
```

---

## 📊 Environment Variables (Secret Management)

### Backend (.env trên Render):
```
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
MQTT_URL=mqtts://broker.hivemq.cloud:8883
MQTT_USERNAME=device-user
MQTT_PASSWORD=securepass
NODE_ENV=production
PORT=4000
```

### Frontend (.env trên Vercel):
```
VITE_API_URL=https://iot-backend.onrender.com
VITE_API_TIMEOUT=10000
```

**⚠️ QUAN TRỌNG:**
- Không commit `.env` file lên GitHub (đã .gitignore)
- Nhập variables qua Render/Vercel dashboard
- Frontend env phải bắt đầu bằng `VITE_` để inject

---

## 🔍 Monitoring & Logs

### Render Dashboard:
```
https://dashboard.render.com
├─ Service logs (real-time)
├─ Deployment history
├─ Environment variables
├─ Health checks
└─ Restart service (nếu cần)
```

### Vercel Dashboard:
```
https://vercel.com/dashboard
├─ Build logs
├─ Deployment history
├─ Analytics (performance)
├─ Preview deployments (PR)
└─ Custom domains
```

---

## 🎯 Tóm tắt:

| Thành phần | Nơi hosted | Kích hoạt | Mục đích |
|-----------|-----------|---------|---------|
| **Backend** | Render | Push to `main` branch | Express API + MQTT + MongoDB |
| **Frontend** | Vercel | Push to `main` branch | React SPA dashboard |
| **Database** | MongoDB Atlas | (cloud service) | Data storage |
| **MQTT Broker** | HiveMQ Cloud | (cloud service) | IoT device messaging |
| **CI/CD** | GitHub Actions | Auto on push | Build & deploy |

**Kết quả:** Mỗi lần push → tự động build + deploy → users thấy feature mới trong vài phút! 🚀
