// Tính chỉ số chất lượng không khí (AQI) đơn giản hoá, lấy cảm hứng từ cách tính AQI của
// US-EPA (nội suy tuyến tính theo breakpoint) nhưng rút gọn còn 5 mức để phù hợp đồ án.
// LƯU Ý: đây KHÔNG phải công thức AQI chính thức (PM2.5 chuẩn EPA dùng đơn vị ug/m3 trung bình
// 24h, CO dùng ppm trung bình 8h...) — ở đây tính tức thời từ 1 mẫu, chỉ phục vụ mục đích minh
// hoạ kiến trúc + cảnh báo ngưỡng trong đồ án học thuật.

const BREAKPOINTS = {
  pm25_ugm3: [
    { lo: 0, hi: 12, aqiLo: 0, aqiHi: 50 },
    { lo: 12, hi: 35.4, aqiLo: 51, aqiHi: 100 },
    { lo: 35.4, hi: 150.4, aqiLo: 101, aqiHi: 200 },
    { lo: 150.4, hi: 250.4, aqiLo: 201, aqiHi: 300 },
    { lo: 250.4, hi: 500, aqiLo: 301, aqiHi: 500 },
  ],
  co_ppm: [
    { lo: 0, hi: 4.4, aqiLo: 0, aqiHi: 50 },
    { lo: 4.4, hi: 9.4, aqiLo: 51, aqiHi: 100 },
    { lo: 9.4, hi: 15.4, aqiLo: 101, aqiHi: 200 },
    { lo: 15.4, hi: 30.4, aqiLo: 201, aqiHi: 300 },
    { lo: 30.4, hi: 50.4, aqiLo: 301, aqiHi: 500 },
  ],
  co2_ppm: [
    { lo: 400, hi: 1000, aqiLo: 0, aqiHi: 50 },
    { lo: 1000, hi: 2000, aqiLo: 51, aqiHi: 100 },
    { lo: 2000, hi: 5000, aqiLo: 101, aqiHi: 200 },
    { lo: 5000, hi: 10000, aqiLo: 201, aqiHi: 300 },
    { lo: 10000, hi: 40000, aqiLo: 301, aqiHi: 500 },
  ],
};

function subIndex(metric, value) {
  const table = BREAKPOINTS[metric];
  const clamped = Math.max(table[0].lo, Math.min(value, table[table.length - 1].hi));
  const bp = table.find((b) => clamped >= b.lo && clamped <= b.hi) || table[table.length - 1];
  const ratio = (clamped - bp.lo) / (bp.hi - bp.lo || 1);
  return Math.round(bp.aqiLo + ratio * (bp.aqiHi - bp.aqiLo));
}

export function levelFromAqi(aqi) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

export function calculateAQI({ co2_ppm, co_ppm, pm25_ugm3 }) {
  const aqi = Math.max(
    subIndex('co2_ppm', co2_ppm),
    subIndex('co_ppm', co_ppm),
    subIndex('pm25_ugm3', pm25_ugm3)
  );
  return { aqi, aqiLevel: levelFromAqi(aqi) };
}
