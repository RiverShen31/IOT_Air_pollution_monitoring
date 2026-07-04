import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import MultiDeviceChart from '../components/MultiDeviceChart.jsx';

const METRICS = [
  { key: 'co2_ppm', label: 'CO2 (ppm)' },
  { key: 'co_ppm', label: 'CO (ppm)' },
  { key: 'pm25_ugm3', label: 'PM2.5 (µg/m³)' },
];

export default function Compare() {
  const [devices, setDevices] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [metric, setMetric] = useState('co2_ppm');
  const [seriesByDevice, setSeriesByDevice] = useState({});

  useEffect(() => {
    api.get('/devices').then(({ data }) => setDevices(data.devices));
  }, []);

  useEffect(() => {
    if (selectedIds.size === 0) {
      setSeriesByDevice({});
      return;
    }
    Promise.all(
      [...selectedIds].map((id) =>
        api.get(`/readings/${id}/history?limit=100`).then(({ data }) => [id, data.readings])
      )
    ).then((entries) => setSeriesByDevice(Object.fromEntries(entries)));
  }, [selectedIds]);

  function toggleDevice(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const deviceNames = Object.fromEntries(devices.map((d) => [d._id, `${d.name} (${d.deviceId})`]));

  return (
    <div>
      <h1>So sánh nhiều thiết bị</h1>

      <div className="history-controls">
        <label>
          Chỉ số:
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="device-grid">
        {devices.map((d) => (
          <div
            key={d._id}
            className={`device-tile${selectedIds.has(d._id) ? ' selected' : ''}`}
            onClick={() => toggleDevice(d._id)}
          >
            <div className="device-tile-header">
              <strong>{d.name}</strong>
              <input type="checkbox" checked={selectedIds.has(d._id)} readOnly />
            </div>
            <div>{d.deviceId}</div>
          </div>
        ))}
      </div>

      {selectedIds.size > 0 ? (
        <MultiDeviceChart seriesByDevice={seriesByDevice} deviceNames={deviceNames} metric={metric} />
      ) : (
        <p>Chọn ít nhất 1 thiết bị để so sánh.</p>
      )}
    </div>
  );
}
