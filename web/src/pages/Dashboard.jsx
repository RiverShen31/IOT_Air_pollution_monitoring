import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api/client.js';
import SensorCard from '../components/SensorCard.jsx';
import SingleDeviceChart from '../components/SingleDeviceChart.jsx';
import MultiDeviceChart from '../components/MultiDeviceChart.jsx';
import DeviceDetailModal from '../components/DeviceDetailModal.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function formatLastSeen(lastSeenAt) {
  if (!lastSeenAt) return 'Chưa kết nối';

  const now = Date.now();
  const lastSeen = new Date(lastSeenAt).getTime();
  const diff = now - lastSeen;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s trước`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m trước`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h trước`;

  const days = Math.floor(hours / 24);
  return `${days}d trước`;
}

const CHART_METRICS = [
  { key: 'co2_ppm', label: 'CO2 (ppm)' },
  { key: 'co_ppm', label: 'CO (ppm)' },
  { key: 'pm25_ugm3', label: 'PM2.5 (µg/m³)' },
  { key: 'temperature_c', label: 'Nhiệt độ (°C)' },
  { key: 'humidity_pct', label: 'Độ ẩm (%)' },
];

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [readings, setReadings] = useState({});
  const [history, setHistory] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [chartMetric, setChartMetric] = useState('co2_ppm');
  const [modalDevice, setModalDevice] = useState(null);

  const loadDevices = useCallback(async () => {
    const { data } = await api.get('/devices');
    setDevices(data.devices);
    setSelectedDeviceId((prev) => prev || data.devices[0]?._id || null);

    for (const device of data.devices) {
      try {
        const latest = await api.get(`/readings/${device._id}/latest`);
        if (latest.data.reading) {
          setReadings((prev) => ({ ...prev, [device.deviceId]: latest.data.reading }));
        }
        const hist = await api.get(`/readings/${device._id}/history?limit=30`);
        setHistory((prev) => ({ ...prev, [device.deviceId]: hist.data.readings }));
      } catch {
        // bỏ qua lỗi từng thiết bị riêng lẻ, không chặn render các thiết bị khác
      }
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Kết nối WebSocket realtime — xác thực bằng cookie httpOnly "accessToken" gửi kèm tự động
  // (xem socket.js phía backend), JS phía client không cần tự đọc/gắn token nữa.
  useEffect(() => {
    const socket = io(API_URL, { withCredentials: true });

    socket.on('reading:new', (reading) => {
      setReadings((prev) => ({ ...prev, [reading.deviceId]: reading }));
      setHistory((prev) => {
        const list = prev[reading.deviceId] || [];
        return { ...prev, [reading.deviceId]: [...list.slice(-29), reading] };
      });
      setDevices((prev) =>
        prev.map((d) => (d.deviceId === reading.deviceId ? { ...d, lastSeenAt: new Date() } : d))
      );
    });

    socket.on('alert:new', (alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 10));
    });

    socket.on('device:status', ({ deviceId, status, lastSeenAt }) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.deviceId === deviceId ? { ...d, status, lastSeenAt: lastSeenAt || d.lastSeenAt } : d
        )
      );
    });

    return () => socket.disconnect();
  }, []);

  const deviceNames = Object.fromEntries(devices.map((d) => [d.deviceId, d.name]));
  const hasAnyHistory = devices.some((d) => (history[d.deviceId] || []).length > 0);

  return (
    <div>
      <h1>Dashboard</h1>

      {alerts.length > 0 && (
        <div className="alert-banner">
          {alerts.map((a, idx) => (
            <div key={a._id || idx} className="alert-item">
              ⚠️ {a.message}
            </div>
          ))}
        </div>
      )}

      {devices.length === 0 && (
        <p>
          Chưa có thiết bị nào. Vào mục <strong>Thiết bị</strong> để thêm thiết bị mới, rồi chạy
          device-simulator hoặc wokwi/sketch.ino với deviceId tương ứng.
        </p>
      )}

      <div className="device-grid">
        {devices.map((device) => {
          const reading = readings[device.deviceId];
          return (
            <div
              key={device._id}
              className={`device-tile ${device._id === selectedDeviceId ? 'selected' : ''}`}
              onClick={() => {
                setSelectedDeviceId(device._id);
                setModalDevice(device);
              }}
            >
              <div className="device-tile-header">
                <strong>{device.name}</strong>
                <span className={`status-dot ${device.status}`} title={device.status} />
              </div>
              <div className="last-seen">
                Kết nối gần nhất: {formatLastSeen(device.lastSeenAt)}
              </div>
              {reading ? (
                <>
                  <div
                    className={`aqi-badge aqi-${reading.aqiLevel.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    AQI {reading.aqi} · {reading.aqiLevel}
                  </div>
                  <div className="sensor-row">
                    <SensorCard label="CO2" value={reading.co2_ppm} unit="ppm" />
                    <SensorCard label="CO" value={reading.co_ppm} unit="ppm" />
                    <SensorCard label="PM2.5" value={reading.pm25_ugm3} unit="µg/m³" />
                    <SensorCard label="Nhiệt độ" value={reading.temperature_c} unit="°C" />
                    <SensorCard label="Độ ẩm" value={reading.humidity_pct} unit="%" />
                  </div>
                </>
              ) : (
                <p>Chưa có dữ liệu</p>
              )}
            </div>
          );
        })}
      </div>

      {hasAnyHistory && (
        <div className="chart-section">
          <div className="history-controls">
            <h2>Biểu đồ realtime</h2>
            <div className="controls-row">
              <label>
                Thiết bị:
                <select value={selectedDeviceId || 'all'} onChange={(e) => setSelectedDeviceId(e.target.value === 'all' ? null : e.target.value)}>
                  <option value="all">📊 Tất cả thiết bị</option>
                  {devices.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Chỉ số:
                <select value={chartMetric} onChange={(e) => setChartMetric(e.target.value)}>
                  {CHART_METRICS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {selectedDeviceId ? (
            <SingleDeviceChart data={history[devices.find((d) => d._id === selectedDeviceId)?.deviceId] || []} metric={chartMetric} />
          ) : (
            <MultiDeviceChart seriesByDevice={history} deviceNames={deviceNames} metric={chartMetric} />
          )}
        </div>
      )}

      {modalDevice && <DeviceDetailModal device={modalDevice} onClose={() => setModalDevice(null)} />}
    </div>
  );
}
