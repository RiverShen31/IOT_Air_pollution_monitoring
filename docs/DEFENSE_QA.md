# 🎓 Chuẩn bị Bảo vệ Đồ án - Q&A + Code Critical

## 📋 MỤC LỤC
1. [Kiến trúc & Thiết kế](#kiến-trúc--thiết-kế)
2. [Security & Authentication](#security--authentication)
3. [Xử lý Dữ liệu & MQTT](#xử-lý-dữ-liệu--mqtt)
4. [Code Critical](#code-critical)
5. [Demo & Testing](#demo--testing)

---

## 🏗️ Kiến trúc & Thiết kế

### Q1: Hệ thống gồm những thành phần nào? Tại sao chọn kiến trúc này?

**A:** 4 tầng + 3 dịch vụ cloud:

```
┌─────────────────────────────────────┐
│  Layer 1: Device                    │
│  ├─ Wokwi simulation (3 devices)    │
│  └─ Real Arduino (via USB serial)   │
└──────────────┬──────────────────────┘
               │ MQTT + HTTP
┌──────────────▼──────────────────────┐
│  Layer 2: MQTT Broker               │
│  └─ HiveMQ Cloud                    │
│     (mqtts://...cloud:8883)         │
└──────────────┬──────────────────────┘
               │ Subscribe topics
┌──────────────▼──────────────────────┐
│  Layer 3: Backend                   │
│  ├─ Express.js (Render)             │
│  ├─ MQTT subscriber                 │
│  ├─ MongoDB (Atlas)                 │
│  └─ Socket.IO (realtime)            │
└──────────────┬──────────────────────┘
               │ REST API + WebSocket
┌──────────────▼──────────────────────┐
│  Layer 4: Frontend                  │
│  ├─ React + Vite (Vercel)           │
│  ├─ Real-time dashboard             │
│  └─ Device management               │
└─────────────────────────────────────┘
```

**Tại sao:**
- ✅ **MQTT**: Pub/sub model → dễ scale (N devices)
- ✅ **Broker tách riêng**: Device không cần biết backend ở đâu
- ✅ **Cloud services**: No-ops (auto-scaling, HTTPS, monitoring)
- ✅ **Separation of concerns**: Frontend ≠ Backend
- ✅ **Real-time (Socket.IO)**: Push data ngay tới user (không polling)

---

### Q2: Tại sao dùng HiveMQ Cloud thay vì Mosquitto local?

**A:**

| | HiveMQ Cloud | Mosquitto Local |
|---|---|---|
| **Scalability** | ✅ 1M+ connections | ❌ Giới hạn server |
| **Uptime** | ✅ 99.9% SLA | ❌ Phụ thuộc máy tính |
| **TLS/Security** | ✅ Built-in MQTTS | ❌ Cấu hình phức tạp |
| **Public network** | ✅ Internet | ❌ LAN only |
| **Monitoring** | ✅ Dashboard | ❌ Manual logs |

**Production choice:** HiveMQ Cloud (cloud path khuyến cáo)

---

### Q3: Tại sao có cả device-simulator, Wokwi lẫn Arduino thật?

**A:** 3 cách test khác nhau:

1. **device-simulator** (Node.js):
   - Nhanh, không cần hardware
   - Dùng để: unit test, CI/CD testing
   - SCENARIO env var → tạo pollution levels

2. **Wokwi** (ESP32 mô phỏng):
   - 5 cảm biến đầy đủ (CO2, CO, PM25, Temp, Humidity)
   - Giống hardware thật nhất
   - Dùng để: integration testing, demo

3. **Arduino thật** (Lam.ino):
   - Kiểm chứng trên hardware cụ thể
   - MQ135 sensor thật
   - Dùng để: production, validation

---

## 🔐 Security & Authentication

### Q4: Hệ thống có 3 cơ chế auth khác nhau. Tại sao?

**A:** Vì 3 con đường khác nhau cần auth riêng:

```
┌──────────────────────────────────────┐
│  1. User Authentication (JWT)        │
│  - Cấp phép người dùng               │
│  - httpOnly cookies (CSRF safe)      │
│  - Refresh token rotation            │
│  - Backend route: requireAuth        │
│  ✅ Bảo vệ: user xác thực & phân quyền
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  2. Device MQTT Auth (username/pass) │
│  - Cấp phép thiết bị (MQTT publish)  │
│  - ACL rules: chỉ publish own topic  │
│  - HiveMQ Cloud credentials          │
│  ✅ Bảo vệ: device không bị giả mạo
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  3. Device HTTP Auth (API Key)       │
│  - Fallback khi MQTT blocked         │
│  - Header: x-api-key                 │
│  - Backend route: requireApiKey      │
│  ✅ Bảo vệ: HTTP fallback path      
└──────────────────────────────────────┘
```

**Thiết kế: không duplicate, mỗi cái một mục đích!**

---

### Q5: HMAC-SHA256 signature dùng để làm gì?

**A:** **Integrity checking** - ngăn chặn dữ liệu bị sửa đổi:

```cpp
// ESP32 / Arduino compute signature:
const char *canonical = "ARDUINO-LAM-01|1784535896278|0.34|0|0|0|0";
HMAC-SHA256(canonical, DEVICE_HMAC_SECRET)
→ sig = "52ef8726d61671dcf9b62df81c3e2063eae61be635fa83d1257e555a60d46614"

// Backend verify:
backend_sig = HMAC-SHA256(canonical, stored_secret)
if (device_sig === backend_sig) {
  ✅ Data không bị sửa
} else {
  ❌ Reject (possible tampering)
}
```

**Bảo vệ:** Attacker không thể sửa giá trị sensor mà device không biết

---

### Q6: User có thể thấy dữ liệu của device khác không?

**A:** **KHÔNG** - 2 layers bảo vệ:

**Layer 1: Query filtering (controller):**
```javascript
// backend/src/controllers/readingController.js
const getReadingsByDevice = async (req, res) => {
  const readings = await Reading.find({
    device: deviceId,
    owner: req.user.id  // ← FILTER: chỉ device của user này
  });
};
```

**Layer 2: Socket.IO room (realtime):**
```javascript
// backend/src/socket.js
socket.on('connection', (socket) => {
  socket.join(`user:${userId}`);  // ← Tách room theo user
});

// Khi có reading mới:
io.to(`user:${ownerId}`).emit('reading:new', data);
// ↑ Chỉ user có owner_id mới nhận (broadcast tới room)
```

**Cấu trúc dữ liệu:**
```
User 1
├─ Device A → Readings
├─ Device B → Readings
└─ (không thấy Device của User 2)

User 2
├─ Device C → Readings
└─ (không thấy Device của User 1)
```

---

## 📊 Xử lý Dữ liệu & MQTT

### Q7: Làm sao đảm bảo dữ liệu "fresh" (không cũ/replay)?

**A:** **Replay detection** với timestamp + ordering:

```javascript
// backend/src/services/mqttIngestService.js
async function ingestTelemetry(device, payload, io) {
  const freshWindow = 5 * 60 * 1000;  // ±5 phút
  const now = Date.now();

  // Check 1: Timestamp phải trong ±5 phút hiện tại
  if (Math.abs(payload.ts - now) > freshWindow) {
    console.log("❌ Rejected: timestamp too old/future");
    return;
  }

  // Check 2: Timestamp phải > lastReading (tăng monotonic)
  if (payload.ts <= device.lastReadingTs) {
    console.log("❌ Rejected: replay (older than last reading)");
    return;
  }

  // ✅ Accept
  device.lastReadingTs = payload.ts;
  await device.save();
}
```

**Tại sao cần:**
- Ngăn attacker tái-gửi reading cũ để spam
- Ngăn IoT device boot lại gửi dữ liệu 1970 (millis()!=real time)

---

### Q8: Timestamp sử dụng milliseconds hay seconds? Tại sao?

**A:** **Milliseconds** - để tránh collision:

```javascript
// ❌ Sai (seconds):
Reading 1: ts = 1784535896 (second)
Reading 2: ts = 1784535896 (same second!)
// → Backend reject Reading 2 as replay!

// ✅ Đúng (milliseconds):
Reading 1: ts = 1784535896278
Reading 2: ts = 1784535896281  (3ms later)
// → Backend accept (timestamp tăng)
```

**Lợi ích:**
- Cho phép multiple readings per second
- Realtime smooth chart (không xảy ra "gaps")
- Match HMAC signature (HMAC base trên milliseconds)

---

### Q9: AQI (Air Quality Index) được tính như thế nào?

**A:** **Simplified EPA-style breakpoint interpolation:**

```javascript
// backend/src/utils/airQualityIndex.js
const BREAKPOINTS = {
  pm25_ugm3: [
    { lo: 0, hi: 12, aqiLo: 0, aqiHi: 50 },        // Good
    { lo: 12, hi: 35.4, aqiLo: 51, aqiHi: 100 },   // Moderate
    { lo: 35.4, hi: 150.4, aqiLo: 101, aqiHi: 200 }, // Unhealthy
    // ... etc
  ]
};

function subIndex(metric, value) {
  const clamped = Math.max(min, Math.min(value, max));
  const bp = findBreakpoint(clamped);
  
  // Linear interpolation
  const ratio = (clamped - bp.lo) / (bp.hi - bp.lo);
  return bp.aqiLo + ratio * (bp.aqiHi - bp.aqiLo);
}

function calculateAQI({ co2_ppm, co_ppm, pm25_ugm3 }) {
  // Take maximum sub-index
  return Math.max(
    subIndex('co2_ppm', co2_ppm),
    subIndex('co_ppm', co_ppm),
    subIndex('pm25_ugm3', pm25_ugm3)
  );
}
```

**Lưu ý:**
- ⚠️ **NOT official EPA** (simplified for coursework)
- Instant readings (NOT 24h average like real EPA)
- Purpose: demo architecture + alert triggering

---

### Q10: Alert được tạo khi nào?

**A:** **Per-metric threshold checking:**

```javascript
// backend/src/services/mqttIngestService.js
async function createAlerts(device, reading) {
  const thresholds = device.alertThresholds;  // User-configured
  
  if (reading.co2_ppm > thresholds.co2_ppm) {
    await Alert.create({
      device: device._id,
      metric: 'co2_ppm',
      value: reading.co2_ppm,
      threshold: thresholds.co2_ppm,
      message: `CO2 exceeds ${thresholds.co2_ppm} ppm`
    });
    // → Socket.IO broadcast to user
  }
  
  // Same for co, pm25, temperature, humidity
}
```

**Flow:**
```
New Reading arrives
    ↓
Check each metric against user's thresholds
    ↓
If metric > threshold:
  ├─ Create Alert document
  ├─ Socket.IO emit to user
  └─ (user sees notification in real-time)
```

---

## 💻 Code Critical

### 🔴 CRITICAL #1: MQTT Ingest Service

**File:** `backend/src/services/mqttIngestService.js`

**Tại sao critical:**
- Duy nhất entry point xử lý dữ liệu từ device
- Nơi xác thực signature, timestamp, schema
- Nơi tạo Reading + Alert documents

**Key sections:**

```javascript
export async function ingestTelemetry(device, payload, io) {
  // 1. SCHEMA VALIDATION
  if (!payload.ts || typeof payload.co2_ppm !== 'number') {
    throw new Error('invalid telemetry schema');
  }

  // 2. SIGNATURE VERIFICATION (nếu device có secret)
  if (device.hmacSecret) {
    const canonical = buildCanonicalString(payload);
    const expectedSig = createHmac('sha256', device.hmacSecret)
      .update(canonical)
      .digest('hex');
    
    if (payload.sig !== expectedSig) {
      throw new Error('signature check failed');
    }
  }

  // 3. TIMESTAMP FRESHNESS CHECK
  const freshWindow = 5 * 60 * 1000;
  if (Math.abs(payload.ts - Date.now()) > freshWindow) {
    throw new Error('timestamp too old');
  }

  // 4. REPLAY DETECTION
  if (payload.ts <= device.lastReadingTs) {
    throw new Error('possible replay');
  }

  // 5. COMPUTE AQI
  const { aqi, aqiLevel } = calculateAQI(payload);

  // 6. PERSIST TO DB
  const reading = await Reading.create({
    device: device._id,
    ...payload,
    aqi,
    aqiLevel
  });

  // 7. CREATE ALERTS
  await createAlerts(device, reading);

  // 8. REALTIME PUSH (Socket.IO)
  io.to(`user:${device.owner}`).emit('reading:new', {
    ...reading.toObject(),
    deviceId: device.deviceId  // Include for frontend
  });

  return reading;
}
```

**Lưu ý trả lời:**
- "Dây chuyền kiểm chứng từng bước: schema → signature → timestamp → replay → AQI → persist"
- "Nếu bất kỳ bước nào fail, reject ngay (fail-safe)"

---

### 🔴 CRITICAL #2: Socket.IO Connection Handler

**File:** `backend/src/socket.js`

**Tại sao critical:**
- Real-time communication
- User isolation (room-based)
- Token verification từ cookie

**Key code:**

```javascript
export function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: FRONTEND_URL, credentials: true },
    transports: ['websocket', 'polling']
  });

  io.use(async (socket, next) => {
    try {
      // 🔑 VERIFY JWT FROM COOKIE
      const token = socket.request.headers.cookie
        .split('; ')
        .find(c => c.startsWith('accessToken='))
        .split('=')[1];

      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      socket.user = await User.findById(decoded.id);
      
      if (!socket.user) return next(new Error('user not found'));
      next();
    } catch (err) {
      next(new Error('auth failed'));
    }
  });

  io.on('connection', (socket) => {
    // 👥 JOIN USER ROOM (isolation per user)
    socket.join(`user:${socket.userId}`);
    console.log(`✅ User ${socket.userId} connected`);

    socket.on('disconnect', () => {
      console.log(`❌ User ${socket.userId} disconnected`);
    });
  });

  return io;
}
```

**Broadcast to specific user (from MQTT handler):**
```javascript
// Trong mqttIngestService.js
io.to(`user:${device.owner}`).emit('reading:new', data);
// ← Chỉ user có owner_id mới nhận!
```

**Lưu ý trả lời:**
- "Socket.IO room pattern → mỗi user một room → dữ liệu isolation tự động"
- "JWT từ cookie (httpOnly) → CSRF safe + không expose trong URL"

---

### 🔴 CRITICAL #3: Device Auth (Two-layer approach)

**File:** `backend/src/controllers/deviceController.js` + MQTT credentials

**Tại sao critical:**
- Device provision process
- API key + HMAC secret generation
- User không thể truy cập device của user khác

**Key code:**

```javascript
export const createDevice = async (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;  // ← User context

  // Generate credentials
  const apiKey = crypto.randomBytes(32).toString('hex');
  const hmacSecret = crypto.randomBytes(32).toString('hex');

  const device = await Device.create({
    name,
    deviceId: `DEVICE-${Date.now()}`,
    owner: userId,  // ← Ownership binding!
    apiKey,
    hmacSecret,
    status: 'offline'
  });

  return res.json({
    device,
    provisioning: {
      apiKey,       // → Device dùng để sign payload
      hmacSecret,   // → Device dùng để compute signature
      mqttTopic: `devices/${device.deviceId}/telemetry`,
      instructions: "Đăng ký MQTT user/pass với admin"
    }
  });
};

// 🔐 Query filtering (ownership check)
export const getDevices = async (req, res) => {
  const devices = await Device.find({
    owner: req.user.id  // ← CRITICAL: filter by owner
  });
  return res.json({ devices });
};
```

**MQTT ACL (HiveMQ Cloud):**
```
User: ARDUINO-LAM-01
Topic permission: devices/ARDUINO-LAM-01/#
Action: PUBLISH ONLY
↓
Device chỉ có thể publish riêng topic của nó!
```

**Lưu ý trả lời:**
- "3 levels: user_id ownership + API key auth + MQTT ACL"
- "Device không thể truy cập dữ liệu device khác (DB level)"
- "Device không thể publish lên topic device khác (MQTT ACL level)"

---

### 🔴 CRITICAL #4: Frontend Chart with Smart Y-axis

**File:** `web/src/components/SingleDeviceChart.jsx`

**Tại sao critical:**
- UX improvement (no jitter)
- Data visualization
- Dynamic scaling

**Key code:**

```javascript
function calculateAxisDomain(values, defaultRange) {
  const validValues = values.filter((v) => v != null && !isNaN(v));
  if (validValues.length === 0) return [0, defaultRange[1]];

  const max = Math.max(...validValues);
  if (max === 0) return [0, 10];

  // 🎯 SMART STEPPING
  let step;
  if (max <= 5) step = 1;
  else if (max <= 10) step = 2;
  else if (max <= 50) step = 5;
  else if (max <= 100) step = 10;
  else if (max <= 500) step = 25;
  else if (max <= 1000) step = 50;
  else step = 100;

  // Round up to nearest multiple of step
  const roundedMax = Math.ceil(max / step) * step;
  
  return [0, roundedMax];
}

export default function SingleDeviceChart({ data, metric }) {
  const values = data.map((r) => r[metric]);
  const [minDomain, maxDomain] = calculateAxisDomain(values, 
    METRIC_INFO[metric].range
  );

  return (
    <LineChart domain={[minDomain, maxDomain]}>  {/* ← Smart scaling */}
      {/* ... chart code ... */}
    </LineChart>
  );
}
```

**Lưu ý trả lời:**
- "Thay vì hardcode Y-axis → tính động dựa vào data range"
- "Step size thay đổi theo magnitude (5, 10, 25, 50, 100) → clean axis labels"
- "Điều này tránh chart bị "nhảy khoảng" khi giá trị thay đổi nhỏ"

---

### 🔴 CRITICAL #5: Serial Reader (Hardware Bridge)

**File:** `serial-reader/server.js`

**Tại sao critical:**
- Duy nhất bridge giữa Arduino vật lý và cloud
- Phải parse serial output đúng
- Phải sign payload với HMAC
- Must handle device disconnect gracefully

**Key code:**

```javascript
function publishToMqtt() {
  if (!mqttClient?.connected) return;

  const now = Date.now();
  if (now - lastMqttPublish < MQTT_PUBLISH_INTERVAL) return;

  // 1. BUILD PAYLOAD (must match backend schema EXACTLY)
  const tsMs = Date.now();  // ← milliseconds!
  const payload = {
    ts: tsMs,
    co2_ppm: parseFloat(lastSensorData.co2_ppm),  // ← numbers, not strings!
    co_ppm: parseFloat(lastSensorData.co_ppm),
    pm25_ugm3: parseFloat(lastSensorData.pm25_ugm3),
    temperature_c: parseFloat(lastSensorData.temperature_c),
    humidity_pct: parseFloat(lastSensorData.humidity_pct)
  };

  // 2. COMPUTE HMAC SIGNATURE
  if (DEVICE_HMAC_SECRET && DEVICE_HMAC_SECRET.length > 0) {
    const canonical = `${DEVICE_ID}|${tsMs}|${co2.toFixed(1)}|${co.toFixed(1)}|${pm25.toFixed(1)}|${temp.toFixed(1)}|${humidity.toFixed(1)}`;
    payload.sig = crypto
      .createHmac('sha256', DEVICE_HMAC_SECRET)
      .update(canonical)
      .digest('hex');
  }

  // 3. PUBLISH WITH QOS 1 (at-least-once delivery)
  mqttClient.publish(
    `devices/${DEVICE_ID}/telemetry`,
    JSON.stringify(payload),
    { qos: 1 },
    (err) => {
      if (err) {
        console.error('❌ MQTT publish error:', err.message);
      } else {
        console.log(`✅ Published: ${JSON.stringify(payload)}`);
      }
    }
  );
}

// Serial parsing
parser.on('data', (line) => {
  const cleanLine = line.trim();
  if (!cleanLine) return;

  // 🔍 PARSE SERIAL OUTPUT
  if (line.includes('[MQ135] Air Quality:')) {
    const match = line.match(/\[MQ135\] Air Quality:\s*([\d.]+)\s*PPM/);
    if (match) {
      lastSensorData.co2_ppm = parseFloat(match[1]);
    }
  }

  publishToMqtt();  // ← Try publish every N seconds
});
```

**Lưu ý trả lời:**
- "Chắc chắn payload là NUMBERS không phải STRINGS (co2_ppm: 0.34 không phải "0.34")"
- "HMAC canonical string phải match EXACTLY backend's buildCanonicalString()"
- "Milliseconds precision → tránh replay detection errors"
- "QoS 1 → at-least-once (nếu MQTT fail lần đầu, sẽ retry)"

---

### 🟡 IMPORTANT #6: User Registration (Password Hashing)

**File:** `backend/src/controllers/authController.js`

```javascript
export const register = async (req, res) => {
  const { email, password } = req.body;

  // 🔐 HASH PASSWORD with bcrypt (NOT plain text!)
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    email,
    password: hashedPassword,  // ← Never store plain password!
    createdAt: new Date()
  });

  return res.json({ user: { id: user._id, email: user.email } });
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'invalid credentials' });

  // 🔑 VERIFY password against hash
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'invalid credentials' });

  // 🎫 ISSUE JWT
  const accessToken = jwt.sign(
    { id: user._id },
    JWT_SECRET,
    { expiresIn: '15m' }  // ← Short-lived
  );

  // 🔄 ISSUE REFRESH TOKEN (stored in DB as hash)
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

  await RefreshToken.create({
    user: user._id,
    token: hashedRefreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)  // 7 days
  });

  // 🍪 SET httpOnly COOKIES (CSRF safe, no JS access)
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    maxAge: 15 * 60 * 1000  // 15 min
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
  });

  return res.json({ user: { id: user._id, email: user.email } });
};
```

**Lưu ý:**
- "Passwords hashed with bcrypt (10 rounds), never plain text"
- "Refresh tokens also hashed in DB (indivisual revocation)"
- "httpOnly cookies → frontend không thể đọc (XSS safe)"
- "Short-lived access token (15m) → reduced impact if leaked"

---

## 🧪 Demo & Testing

### Q11: Làm sao test system end-to-end?

**A:** **Step-by-step test scenario:**

```
1️⃣  Start backend:
    cd backend && npm start
    → Check: http://localhost:4000/health

2️⃣  Start frontend:
    cd web && npm run dev
    → Check: http://localhost:5173

3️⃣  Register user + login:
    - Email: test@example.com
    - Password: testpass123
    → Check: JWT cookies set

4️⃣  Create device:
    POST /api/devices
    { "name": "Test Device" }
    → Get: apiKey, hmacSecret

5️⃣  Start Wokwi (or Arduino):
    - Cài MQTT credentials từ step 4
    - Run sketch
    → Check: Serial output "✅ Published"

6️⃣  View dashboard:
    - List devices → show "Test Device"
    - Select device → see realtime chart
    → Check: data updates live

7️⃣  Test HMAC signature:
    - Kill Wokwi, modify sketch to remove signature
    → Check: backend rejects "signature check failed"

8️⃣  Test replay detection:
    - Send old timestamp
    → Check: backend rejects "timestamp too old"

9️⃣  Test multi-user isolation:
    - Login as different user
    - Try to access Device 1 (owned by User 1)
    → Check: 401 Unauthorized (not visible)

🔟 Test alert:
    - Set alertThreshold CO2 > 500 ppm
    - On dashboard: notification appears
```

---

### Q12: Có test suite không? Tại sao không?

**A:** **Scope decision (intentional):**

```
Coursework requirements:
✅ Architecture & design (primary focus)
✅ Security mechanisms (primary focus)
✅ End-to-end flow (primary focus)
❌ Test automation (out of scope)

Reason:
- Coursework là về ARCHITECTURE không phải QA
- Manual testing + demo là sufficient để verify
- Automated tests sẽ add 500+ lines overhead code
- Better spend time explaining design decisions
```

---

## 🎯 Tóm tắt Key Talking Points

### Kiến trúc:
1. "4-layer architecture: Device → Broker → Backend → Frontend"
2. "Pub/sub model (MQTT) giảm coupling"
3. "Cloud services (Render/Vercel/MongoDB/HiveMQ): tự động scale, secure"

### Security:
1. "3 auth mechanisms: user JWT, device MQTT, device HTTP API"
2. "HMAC-SHA256 signature: integrity + non-repudiation"
3. "User isolation: 2 layers (DB filter + Socket.IO room)"
4. "bcrypt password hashing + httpOnly cookies"

### Data handling:
1. "Replay detection: timestamp freshness + monotonic ordering"
2. "Milliseconds precision: avoid collision"
3. "AQI calculation: simplified breakpoint interpolation"
4. "Alert per-metric: user-configurable thresholds"

### Code:
1. "Single ingest path: mqttIngestService (all data validate here)"
2. "Smart Y-axis: dynamic scaling (no jitter)"
3. "Serial reader: parse + sign + publish MQTT"
4. "Socket.IO room isolation: per-user data push"

---

## 🎬 Demo Script (5 phút):

```
1. Mở browser 2 tabs:
   - Tab 1: https://iot-app.vercel.app (dashboard)
   - Tab 2: Wokwi simulator

2. Đăng nhập dashboard → show devices

3. Chọn device → show realtime chart
   "Nhìn chart: mỗi device khác nhau có Y-axis khác
    (smart scaling based on data range)"

4. Wokwi serial console → thấy:
   ✅ Published: {...co2_ppm: 0.34...}

5. Dashboard update ngay (realtime):
   "Không cần refresh, data push via Socket.IO"

6. Thay đổi pollution level trên Wokwi code:
   "setPollutionLevel(): CO2 = 3000"
   → Chart Y-axis tự động adjust!

7. Set alert threshold = 1500 ppm:
   → Notification: "⚠️ CO2 exceeds 1500 ppm"
```

---

## ❌ Các câu hỏi khó có thể hỏi:

### Q: Nếu device gửi dữ liệu rất nhanh (50 readings/sec), hệ thống có lẹt không?

**A:** 
- Serial baud rate 115200 → ~1000 bytes/sec → ~10-20 readings/sec max
- MQTT publish interval 5s → throttle (intentional)
- MongoDB indexing on (device, ts) → fast query
- Socket.IO room broadcast → realtime

---

### Q: Nếu MQTT broker down, dữ liệu mất không?

**A:**
- Device có fallback: POST /api/ingest (HTTP)
- Backend buffer (in-memory queue có thể add)
- MongoDB persistence → data không mất

---

### Q: GDPR compliance? Có xóa user data không?

**A:**
- Scope: coursework → không yêu cầu GDPR
- Could add: DELETE /api/users/:id → cascade delete

---

### Q: Các cảm biến ghép nối sai, dữ liệu sai, xử lý như thế nào?

**A:**
- Schema validation → reject nếu type sai
- Range checking → clamp values (0-4095 for ADC)
- AQI calculation → smooth (linear interpolation)
- User có thể calibrate thresholds

---

**Chúc bạn bảo vệ tốt! 🎓🚀**
