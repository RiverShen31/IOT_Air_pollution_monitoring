import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import '../styles/modal.css';

export default function DeviceDetailModal({ device, onClose }) {
  const [latestReading, setLatestReading] = useState(null);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const to = new Date();

      const latest = await api.get(`/readings/${device._id}/latest`);
      setLatestReading(latest.data.reading);

      const hist = await api.get(
        `/readings/${device._id}/history?from=${oneHourAgo.toISOString()}&to=${to.toISOString()}&limit=200`
      );
      setReadings(hist.data.readings || []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch readings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [device._id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{device.name} ({device.deviceId})</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading && !latestReading ? (
          <div className="modal-loading">Đang tải...</div>
        ) : (
          <>
            {latestReading && (
              <div className="latest-reading-box">
                <h3>Dữ liệu mới nhất</h3>
                <div className="reading-grid">
                  <div className="reading-item">
                    <span className="label">CO2</span>
                    <span className="value">{latestReading.co2_ppm.toFixed(1)}</span>
                    <span className="unit">ppm</span>
                  </div>
                  <div className="reading-item">
                    <span className="label">CO</span>
                    <span className="value">{latestReading.co_ppm.toFixed(2)}</span>
                    <span className="unit">ppm</span>
                  </div>
                  <div className="reading-item">
                    <span className="label">PM2.5</span>
                    <span className="value">{latestReading.pm25_ugm3.toFixed(1)}</span>
                    <span className="unit">µg/m³</span>
                  </div>
                  <div className="reading-item">
                    <span className="label">Nhiệt độ</span>
                    <span className="value">{latestReading.temperature_c.toFixed(1)}</span>
                    <span className="unit">°C</span>
                  </div>
                  <div className="reading-item">
                    <span className="label">Độ ẩm</span>
                    <span className="value">{latestReading.humidity_pct.toFixed(1)}</span>
                    <span className="unit">%</span>
                  </div>
                  <div className="reading-item aqi-item">
                    <span className="label">AQI</span>
                    <span className={`aqi-badge aqi-${latestReading.aqiLevel.replace(/\s+/g, '-').toLowerCase()}`}>
                      {latestReading.aqi} · {latestReading.aqiLevel}
                    </span>
                  </div>
                </div>
                <div className="reading-time">
                  Đo lúc: {new Date(latestReading.ts).toLocaleString('vi-VN')}
                </div>
              </div>
            )}

            <div className="history-section">
              <div className="history-header">
                <h3>Lịch sử 1 giờ gần nhất ({readings.length} readings)</h3>
                {lastUpdate && (
                  <span className="last-update">Cập nhật: {lastUpdate.toLocaleTimeString('vi-VN')}</span>
                )}
              </div>

              {readings.length === 0 ? (
                <p className="no-data">Không có dữ liệu</p>
              ) : (
                <div className="readings-table-wrapper">
                  <table className="readings-table">
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>CO2</th>
                        <th>CO</th>
                        <th>PM2.5</th>
                        <th>Nhiệt độ</th>
                        <th>Độ ẩm</th>
                        <th>AQI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readings.map((reading, idx) => (
                        <tr key={reading._id || idx}>
                          <td className="timestamp">
                            {new Date(reading.ts).toLocaleTimeString('vi-VN')}
                          </td>
                          <td>{reading.co2_ppm.toFixed(1)}</td>
                          <td>{reading.co_ppm.toFixed(2)}</td>
                          <td>{reading.pm25_ugm3.toFixed(1)}</td>
                          <td>{reading.temperature_c.toFixed(1)}</td>
                          <td>{reading.humidity_pct.toFixed(1)}</td>
                          <td>
                            <span className={`aqi-badge-small aqi-${reading.aqiLevel.replace(/\s+/g, '-').toLowerCase()}`}>
                              {reading.aqi}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
