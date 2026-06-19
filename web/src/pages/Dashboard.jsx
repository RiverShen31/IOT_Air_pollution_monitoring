import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { api, getAccessToken } from '../api/client.js';
import SensorCard from '../components/SensorCard.jsx';
import RealtimeChart from '../components/RealtimeChart.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [readings, setReadings] = useState({});
  const [history, setHistory] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

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

  // Kết nối WebSocket realtime, xác thực bằng access token hiện có (xem socket.js phía backend)
  useEffect(() => {
    const socket = io(API_URL, { auth: { token: getAccessToken() } });

    socket.on('reading:new', (reading) => {
      setReadings((prev) => ({ ...prev, [reading.deviceId]: reading }));
      setHistory((prev) => {
        const list = prev[reading.deviceId] || [];
        return { ...prev, [reading.deviceId]: [...list.slice(-29), reading] };
      });
    });

    socket.on('alert:new', (alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 10));
    });

    socket.on('device:status', ({ deviceId, status }) => {
      setDevices((prev) => prev.map((d) => (d.deviceId === deviceId ? { ...d, status } : d)));
    });

    return () => socket.disconnect();
  }, []);

  const selectedDevice = devices.find((d) => d._id === selectedDeviceId);
  const selectedHistory = selectedDevice ? history[selectedDevice.deviceId] || [] : [];

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
              onClick={() => setSelectedDeviceId(device._id)}
            >
              <div className="device-tile-header">
                <strong>{device.name}</strong>
                <span className={`status-dot ${device.status}`} title={device.status} />
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

      {selectedDevice && selectedHistory.length > 0 && (
        <div className="chart-section">
          <h2>Biểu đồ realtime — {selectedDevice.name}</h2>
          <RealtimeChart data={selectedHistory} />
        </div>
      )}
    </div>
  );
}
