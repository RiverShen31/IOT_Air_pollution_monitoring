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

const METRIC_INFO = {
  co2_ppm: { label: 'CO2 (ppm)', color: '#2563eb', range: [0, 1000] },
  co_ppm: { label: 'CO (ppm)', color: '#dc2626', range: [0, 100] },
  pm25_ugm3: { label: 'PM2.5 (µg/m³)', color: '#16a34a', range: [0, 200] },
  temperature_c: { label: 'Nhiệt độ (°C)', color: '#f59e0b', range: [0, 50] },
  humidity_pct: { label: 'Độ ẩm (%)', color: '#8b5cf6', range: [0, 100] },
};

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// Smart Y-axis scaling: pad min/max by 10%
function calculateAxisDomain(values, defaultRange) {
  const validValues = values.filter((v) => v != null && !isNaN(v));
  if (validValues.length === 0) return defaultRange;

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);

  if (min === max) {
    // If all values are the same, add 20% padding
    const padding = Math.max(1, Math.abs(min) * 0.2);
    return [Math.max(0, min - padding), max + padding];
  }

  const range = max - min;
  const padding = range * 0.1;
  return [Math.max(0, min - padding), max + padding];
}

export default function SingleDeviceChart({ data, metric }) {
  if (!data || data.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Không có dữ liệu</div>;
  }

  const chartData = data.map((r) => ({
    time: formatTime(r.ts),
    value: r[metric],
  }));

  const metricInfo = METRIC_INFO[metric] || { label: metric, color: '#666', range: [0, 100] };
  const values = data.map((r) => r[metric]);
  const [minDomain, maxDomain] = calculateAxisDomain(values, metricInfo.range);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis domain={[minDomain, maxDomain]} />
        <Tooltip
          formatter={(value) => value?.toFixed(2)}
          labelFormatter={(label) => label}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="value"
          name={metricInfo.label}
          stroke={metricInfo.color}
          dot={false}
          connectNulls
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
