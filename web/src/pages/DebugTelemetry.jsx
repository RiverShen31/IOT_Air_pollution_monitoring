import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function DebugTelemetry() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/debug/telemetry');
      setData(res.data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) return <div className="center-message">Đang tải...</div>;

  return (
    <div>
      <h1>🔧 Debug Telemetry (Last 1 Hour)</h1>

      <div className="debug-controls">
        <button onClick={fetchData}>🔄 Refresh Ngay</button>
        {lastUpdate && <span>Cập nhật lúc: {lastUpdate.toLocaleTimeString('vi-VN')}</span>}
      </div>

      {error && <div className="error-box">{error}</div>}

      {data && (
        <div>
          <p>
            <strong>Thời gian fetch:</strong> {new Date(data.fetchedAt).toLocaleString('vi-VN')}
            <br />
            <strong>Range:</strong> {new Date(data.timeRange.from).toLocaleString('vi-VN')} → {new Date(data.timeRange.to).toLocaleString('vi-VN')}
          </p>

          {data.devices.map((device) => (
            <div key={device._id} className="debug-device-box">
              <div className="debug-device-header">
                <h3>{device.name} ({device.deviceId})</h3>
                <div className="device-info">
                  <span className={`status-badge ${device.status}`}>{device.status}</span>
                  <span className="reading-count">{device.readingCount} readings</span>
                </div>
              </div>

              {device.readingCount === 0 ? (
                <p className="no-data">Không có dữ liệu trong 1 giờ qua</p>
              ) : (
                <div className="readings-table-wrapper">
                  <table className="readings-table">
                    <thead>
                      <tr>
                        <th>Thời gian (ts)</th>
                        <th>CO2 (ppm)</th>
                        <th>CO (ppm)</th>
                        <th>PM2.5 (µg/m³)</th>
                        <th>Nhiệt độ (°C)</th>
                        <th>Độ ẩm (%)</th>
                        <th>AQI</th>
                        <th>Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {device.readings.map((reading, idx) => (
                        <tr key={reading._id || idx}>
                          <td className="timestamp">{new Date(reading.ts).toLocaleTimeString('vi-VN')}</td>
                          <td>{reading.co2_ppm.toFixed(1)}</td>
                          <td>{reading.co_ppm.toFixed(2)}</td>
                          <td>{reading.pm25_ugm3.toFixed(1)}</td>
                          <td>{reading.temperature_c.toFixed(1)}</td>
                          <td>{reading.humidity_pct.toFixed(1)}</td>
                          <td className="aqi-value">{reading.aqi}</td>
                          <td>
                            <span className={`aqi-level-badge aqi-${reading.aqiLevel.replace(/\s+/g, '-').toLowerCase()}`}>
                              {reading.aqiLevel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
