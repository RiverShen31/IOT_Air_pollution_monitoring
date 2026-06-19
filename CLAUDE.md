# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A simulated IoT air pollution monitoring system (CO2/NH3 via MQ135, CO via MQ7, PM2.5 dust,
temperature/humidity via DHT11), built for a "Kiến trúc và bảo mật cho ứng dụng IoT" coursework
assignment. Business idea adapted from
[CircuitDigest's IoT Air Pollution Monitoring using Arduino](https://circuitdigest.com/microcontroller-projects/iot-air-pollution-monitoring-using-arduino),
but the architecture, backend, broker, and security layer are built from scratch instead of using
Blynk.

There is currently no real hardware — devices are simulated two ways (see below). Read
`docs/ARCHITECTURE.md` (architecture diagram, components, communication protocols),
`docs/SECURITY.md` (every security mechanism implemented, with file pointers), and
`docs/DEPLOYMENT.md` (public cloud deploy: Render + Vercel + MongoDB Atlas + HiveMQ Cloud, no
Docker) before making non-trivial changes; all three are written in Vietnamese and are the
source of truth for design intent.

## Repository layout

Four independent Node.js/firmware projects plus shared infra config — there is no root
package.json or workspace tooling tying them together:

- `backend/` — Express API, MQTT subscriber, MongoDB models, Socket.IO realtime push
- `web/` — React + Vite dashboard
- `device-simulator/` — Node.js script that fakes sensor data and publishes over MQTT
- `wokwi/` — ESP32 firmware (C++) for the Wokwi browser simulator, an alternative "hardware-like" simulation path
- `mosquitto/` — Mosquitto broker config (auth + ACL), provisioning scripts (used only by the
  local-Docker path; the cloud deploy path uses HiveMQ Cloud instead, see `docs/DEPLOYMENT.md`)
- `docker-compose.yml` — runs only Mosquitto + MongoDB (backend/web/simulator run locally via npm)
- `render.yaml` — Render Blueprint for one-click backend provisioning (cloud deploy path)

There are two parallel ways to run/host this system — don't assume Docker is in play:
1. **Local-only via Docker** (`docker-compose.yml` + `mosquitto/`): self-hosted Mongo + Mosquitto.
2. **Cloud (recommended, no Docker)**: MongoDB Atlas + HiveMQ Cloud, used identically for local
   dev (`backend/.env` just points at the cloud URIs) and for the public deploy (Render +
   Vercel). See `docs/DEPLOYMENT.md`. Whichever path is active is determined entirely by what's
   in `backend/.env` (`MONGO_URI`, `MQTT_URL`) — the code itself doesn't know or care which.

## Commands

No test suite or linter is configured in any subproject — `npm test`/`npm run lint` do not exist.
Each subproject is installed/run independently (`cd <dir> && npm install`).

**First-time infra setup** (creates `mosquitto/config/password_file`, run once or after wiping it):
```bash
bash mosquitto/config/init-credentials.sh   # requires Docker; PowerShell equivalent in README.md
```

**Start broker + DB:**
```bash
docker compose up -d
docker compose ps        # verify both containers are healthy
docker compose restart mosquitto   # required after editing mosquitto/config/acl.conf or password_file
```

**Backend** (`backend/`, copy `.env.example` to `.env` first):
```bash
npm run dev     # node --watch src/server.js, http://localhost:4000
npm start
```

**Web** (`web/`, copy `.env.example` to `.env` first):
```bash
npm run dev     # vite dev server, http://localhost:5173
npm run build
```

**Device simulator** (`device-simulator/`, copy `.env.example` to `.env` first):
```bash
npm start       # publishes fake telemetry every PUBLISH_INTERVAL_MS over MQTT
```
`SCENARIO` env var (`normal` | `polluted` | `rush_hour`) controls baseline pollution levels —
useful for triggering alert thresholds during manual testing.

**Add a new simulated/real device to the broker:**
```bash
bash mosquitto/config/add-device.sh <deviceId> <mqttPassword>
docker compose restart mosquitto
```
This is a manual provisioning step — creating a device via the backend API (`POST
/api/devices`) does NOT automatically grant it MQTT credentials/ACL; the API response includes
the exact `add-device.sh` command to run next.

**Wokwi hardware simulation:** no local command — see `wokwi/README.md` for the browser-based
workflow (paste `diagram.json`/`sketch.ino`/`libraries.txt` into wokwi.com).

## Architecture

Four-layer pipeline: **Device → MQTT broker → Backend → Web**. Full diagram in
`docs/ARCHITECTURE.md`.

### Data flow and topic/schema contract

Devices publish to `devices/{deviceId}/telemetry` (QoS 1) with payload:
```json
{ "ts": "...", "co2_ppm": 612, "co_ppm": 4.2, "pm25_ugm3": 38, "temperature_c": 29.5, "humidity_pct": 68 }
```
`ts` may be an ISO string or epoch seconds/ms (the Wokwi firmware sends epoch seconds since
`millis()`-based clocks have no real date) — `parseTimestamp()` in
`backend/src/services/mqttIngestService.js` normalizes both. Device online/offline state is a
retained LWT message on `devices/{deviceId}/status`. **This schema is the contract** between
`device-simulator/simulate.js`, `wokwi/sketch.ino`, and `mqttIngestService.js` — changing field
names requires updating all three (plus `backend/src/utils/airQualityIndex.js` if pollutant
fields change).

`backend/src/services/mqttIngestService.js` is the single ingestion path: it's invoked both from
the MQTT message handler and from the HTTP fallback route (`POST /api/ingest`, authenticated via
`x-api-key`) through the shared `ingestTelemetry(device, payload, io)` function — keep both entry
points going through that function rather than duplicating ingest logic.

On each reading: AQI is computed (`calculateAQI` — a simplified, explicitly non-official EPA-style
breakpoint interpolation, see comments in `airQualityIndex.js`), the reading is persisted, the
device's `alertThresholds` are checked per-metric to create `Alert` documents, and everything is
pushed live to the owning user via Socket.IO (`io.to(\`user:${ownerId}\`).emit(...)`) — clients
join a room per `userId` at socket handshake, so cross-user data leakage is structurally
prevented at the socket layer, not just by query filtering.

### Auth model (see docs/SECURITY.md for full detail)

Three independent auth mechanisms, used in different places — don't conflate them:
- **User auth**: JWT access token (15m) + DB-backed refresh token (`RefreshToken` model stores a
  hash, not the raw token, so sessions are individually revocable) with rotation on every
  `/api/auth/refresh` call. `requireAuth` middleware reads `Authorization: Bearer`.
- **Device HTTP auth**: per-device `apiKey` (random 32 bytes) via `x-api-key` header,
  checked by `requireApiKey` middleware — only used by the `/api/ingest` fallback route.
- **Device MQTT auth**: separate username/password — either in `mosquitto/config/password_file` +
  per-device ACL in `mosquitto/config/acl.conf` (local-Docker path), or as a per-device HiveMQ
  Cloud credential with a topic permission rule (cloud path, set up manually in the HiveMQ
  console per `docs/DEPLOYMENT.md`) — both restrict publish to `devices/{deviceId}/#` only. This
  is intentionally decoupled from the Mongo `Device.apiKey` — there is no automatic sync between
  creating a `Device` via the API and provisioning MQTT credentials (see `add-device.sh` above,
  or the HiveMQ console step for the cloud path).

Every device/reading/alert query in controllers filters by `owner: req.user.id` — when adding new
endpoints that touch `Device`/`Reading`/`Alert`, preserve this ownership filter rather than
trusting `deviceId` from the URL/body alone.

### Mongo models and relationships

`User` 1—N `Device` (via `Device.owner`) 1—N `Reading`/`Alert` (via `device` ObjectId ref *and* a
denormalized `deviceId` string field, kept for convenience since MQTT topics are keyed by
`deviceId` not Mongo `_id`). `RefreshToken` references `User` and self-expires via a Mongo TTL
index on `expiresAt`.

### Frontend realtime wiring

`web/src/api/client.js` is the only place that should read/write tokens (`localStorage`) or
handle 401 → refresh-and-retry; it auto-rotates tokens via a shared in-flight `refreshPromise` to
avoid duplicate refresh calls on concurrent 401s. `web/src/pages/Dashboard.jsx` opens a Socket.IO
connection authenticated with the current access token (`auth: { token }`) and listens for
`reading:new` / `alert:new` / `device:status` — if you add a new realtime event on the backend,
emit it to the `user:{ownerId}` room and add a corresponding listener here.

### Known non-production gaps (documented intentionally, not oversights)

Per `docs/SECURITY.md`: no secret rotation, no 2FA, tokens in `localStorage` instead of httpOnly
cookies. Don't "fix" these silently — they're called out as deliberate scope boundaries for the
assignment's simulation stage. (TLS is *not* a gap when using the cloud path — Render/Vercel
terminate HTTPS automatically and HiveMQ Cloud requires `mqtts://` on port 8883; both `mqtt.js`
in the backend/simulator and the `WiFiClientSecure` branch in `wokwi/sketch.ino` already support
it. TLS is only absent on the local-Docker path, which uses plain `mqtt://`/`http://` by design
for simplicity.)
