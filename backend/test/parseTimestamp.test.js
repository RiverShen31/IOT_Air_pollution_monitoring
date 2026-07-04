import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTimestamp } from '../src/services/mqttIngestService.js';

test('parseTimestamp accepts an ISO string as-is', () => {
  const d = parseTimestamp('2026-01-15T10:00:00.000Z');
  assert.equal(d.toISOString(), '2026-01-15T10:00:00.000Z');
});

test('parseTimestamp treats a small number as epoch seconds (Wokwi millis()-based clock)', () => {
  const d = parseTimestamp(1_700_000_000); // well under the 1e12 seconds/ms cutoff
  assert.equal(d.getTime(), 1_700_000_000 * 1000);
});

test('parseTimestamp treats a large number as epoch milliseconds', () => {
  const ms = Date.now();
  const d = parseTimestamp(ms);
  assert.equal(d.getTime(), ms);
});

test('parseTimestamp falls back to now() for missing or unparseable input', () => {
  const before = Date.now();
  const dMissing = parseTimestamp(undefined);
  const dGarbage = parseTimestamp('not-a-date');
  const after = Date.now();
  assert.ok(dMissing.getTime() >= before && dMissing.getTime() <= after);
  assert.ok(dGarbage.getTime() >= before && dGarbage.getTime() <= after);
});
