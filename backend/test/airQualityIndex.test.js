import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAQI, levelFromAqi } from '../src/utils/airQualityIndex.js';

test('calculateAQI returns Good for clean-air readings', () => {
  const { aqi, aqiLevel } = calculateAQI({ co2_ppm: 500, co_ppm: 1, pm25_ugm3: 5 });
  assert.ok(aqi <= 50);
  assert.equal(aqiLevel, 'Good');
});

test('calculateAQI takes the worst pollutant, not an average', () => {
  const { aqi } = calculateAQI({ co2_ppm: 500, co_ppm: 1, pm25_ugm3: 400 });
  assert.ok(aqi > 300, `expected hazardous-range AQI from PM2.5=400, got ${aqi}`);
});

test('calculateAQI clamps values above the top breakpoint instead of throwing', () => {
  const { aqi, aqiLevel } = calculateAQI({ co2_ppm: 999999, co_ppm: 999, pm25_ugm3: 999 });
  assert.equal(aqi, 500);
  assert.equal(aqiLevel, 'Hazardous');
});

test('levelFromAqi boundaries match the documented 5 levels', () => {
  assert.equal(levelFromAqi(0), 'Good');
  assert.equal(levelFromAqi(50), 'Good');
  assert.equal(levelFromAqi(51), 'Moderate');
  assert.equal(levelFromAqi(200), 'Unhealthy');
  assert.equal(levelFromAqi(201), 'Very Unhealthy');
  assert.equal(levelFromAqi(301), 'Hazardous');
});
