import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import RealtimeChart from '../components/RealtimeChart.jsx';

export default function History() {
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [readings, setReadings] = useState([]);
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    api.get('/devices').then(({ data }) => {
      setDevices(data.devices);
      if (data.devices.length) setDeviceId(data.devices[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    api.get(`/readings/${deviceId}/history?limit=${limit}`).then(({ data }) => {
      setReadings(data.readings);
    });
  }, [deviceId, limit]);

  return (
    <div>
      <h1>Lịch sử dữ liệu</h1>

      <div className="history-controls">
        <label>
          Thiết bị:
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            {devices.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} ({d.deviceId})
              </option>
            ))}
          </select>
        </label>
        <label>
          Số mẫu gần nhất:
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={500}>500</option>
          </select>
        </label>
      </div>

      {readings.length > 0 ? (
        <>
          <RealtimeChart data={readings} />
          <table className="readings-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>CO2 (ppm)</th>
                <th>CO (ppm)</th>
                <th>PM2.5 (µg/m³)</th>
                <th>Nhiệt độ (°C)</th>
                <th>Độ ẩm (%)</th>
                <th>AQI</th>
              </tr>
            </thead>
            <tbody>
              {[...readings].reverse().map((r) => (
                <tr key={r._id}>
                  <td>{new Date(r.ts).toLocaleString('vi-VN')}</td>
                  <td>{r.co2_ppm}</td>
                  <td>{r.co_ppm}</td>
                  <td>{r.pm25_ugm3}</td>
                  <td>{r.temperature_c}</td>
                  <td>{r.humidity_pct}</td>
                  <td>
                    {r.aqi} ({r.aqiLevel})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p>Chưa có dữ liệu lịch sử cho thiết bị này.</p>
      )}
    </div>
  );
}
