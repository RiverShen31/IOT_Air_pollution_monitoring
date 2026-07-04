import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#8b5cf6'];

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// Mỗi thiết bị publish độc lập nên ts không khớp chính xác nhau — làm tròn về phút để gộp
// nhiều thiết bị vào chung 1 trục thời gian cho biểu đồ.
function bucketKey(ts) {
  const d = new Date(ts);
  d.setSeconds(0, 0);
  return d.getTime();
}

export default function MultiDeviceChart({ seriesByDevice, deviceNames, metric }) {
  const deviceIds = Object.keys(seriesByDevice);
  const buckets = new Map();

  for (const deviceId of deviceIds) {
    for (const reading of seriesByDevice[deviceId]) {
      const key = bucketKey(reading.ts);
      if (!buckets.has(key)) buckets.set(key, { time: formatTime(reading.ts) });
      buckets.get(key)[deviceId] = reading[metric];
    }
  }

  const chartData = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip />
        <Legend />
        {deviceIds.map((deviceId, i) => (
          <Line
            key={deviceId}
            type="monotone"
            dataKey={deviceId}
            name={deviceNames[deviceId] || deviceId}
            stroke={COLORS[i % COLORS.length]}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
