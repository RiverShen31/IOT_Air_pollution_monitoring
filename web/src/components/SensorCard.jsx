export default function SensorCard({ label, value, unit }) {
  return (
    <div className="sensor-card">
      <div className="sensor-label">{label}</div>
      <div className="sensor-value">
        {value}
        <span className="sensor-unit">{unit}</span>
      </div>
    </div>
  );
}
