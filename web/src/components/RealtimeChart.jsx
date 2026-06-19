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

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function RealtimeChart({ data }) {
  const chartData = data.map((r) => ({
    time: formatTime(r.ts),
    CO2: r.co2_ppm,
    CO: r.co_ppm,
    'PM2.5': r.pm25_ugm3,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="CO2" stroke="#2563eb" dot={false} />
        <Line type="monotone" dataKey="CO" stroke="#dc2626" dot={false} />
        <Line type="monotone" dataKey="PM2.5" stroke="#16a34a" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
