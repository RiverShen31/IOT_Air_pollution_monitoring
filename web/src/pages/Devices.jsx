import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState({ deviceId: '', name: '', location: '' });
  const [error, setError] = useState('');
  const [provisioning, setProvisioning] = useState(null);

  async function loadDevices() {
    const { data } = await api.get('/devices');
    setDevices(data.devices);
  }

  useEffect(() => {
    loadDevices();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setProvisioning(null);
    try {
      const { data } = await api.post('/devices', form);
      setForm({ deviceId: '', name: '', location: '' });
      setProvisioning(data.provisioning);
      await loadDevices();
    } catch (err) {
      setError(err.response?.data?.error || 'Tạo thiết bị thất bại');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Xoá thiết bị này?')) return;
    await api.delete(`/devices/${id}`);
    await loadDevices();
  }

  async function handleRegenerateKey(id) {
    const { data } = await api.post(`/devices/${id}/api-key/regenerate`);
    alert(`API key mới: ${data.device.apiKey}`);
    await loadDevices();
  }

  async function handleUpdateThresholds(device, field, value) {
    const numericValue = Number(value);
    await api.patch(`/devices/${device._id}`, {
      alertThresholds: { [field]: numericValue },
    });
    await loadDevices();
  }

  return (
    <div>
      <h1>Quản lý thiết bị</h1>

      <form className="device-form" onSubmit={handleCreate}>
        <h2>Thêm thiết bị mới</h2>
        <label>Device ID (vd: AQ-DEVICE-02)</label>
        <input
          value={form.deviceId}
          onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
          required
        />
        <label>Tên thiết bị</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <label>Vị trí lắp đặt (tuỳ chọn)</label>
        <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />

        {error && <p className="error-text">{error}</p>}
        <button type="submit">Tạo thiết bị</button>
      </form>

      {provisioning && (
        <div className="provisioning-box">
          <p>{provisioning.note}</p>
          <code>{provisioning.command}</code>
        </div>
      )}

      <h2>Danh sách thiết bị</h2>
      <table className="devices-table">
        <thead>
          <tr>
            <th>Device ID</th>
            <th>Tên</th>
            <th>Trạng thái</th>
            <th>Ngưỡng CO2</th>
            <th>Ngưỡng CO</th>
            <th>Ngưỡng PM2.5</th>
            <th>API Key</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device._id}>
              <td>{device.deviceId}</td>
              <td>{device.name}</td>
              <td>
                <span className={`status-dot ${device.status}`} /> {device.status}
              </td>
              <td>
                <input
                  type="number"
                  defaultValue={device.alertThresholds.co2_ppm}
                  onBlur={(e) => handleUpdateThresholds(device, 'co2_ppm', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  defaultValue={device.alertThresholds.co_ppm}
                  onBlur={(e) => handleUpdateThresholds(device, 'co_ppm', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  defaultValue={device.alertThresholds.pm25_ugm3}
                  onBlur={(e) => handleUpdateThresholds(device, 'pm25_ugm3', e.target.value)}
                />
              </td>
              <td className="api-key-cell" title={device.apiKey}>
                {device.apiKey.slice(0, 10)}...
                <button onClick={() => handleRegenerateKey(device._id)}>Tạo lại</button>
              </td>
              <td>
                <button className="danger" onClick={() => handleDelete(device._id)}>
                  Xoá
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
