const assert = require('node:assert/strict');
const { test } = require('node:test');
require('../isonoura-beach-wave.js');

const { estimate } = globalThis.ksIsonouraBeachWave;
const hour = (height, direction, period, swellHeight, swellDirection, swellPeriod) => ({
  wave_height: [height],
  wave_direction: [direction],
  wave_period: [period],
  swell_wave_height: [swellHeight],
  swell_wave_direction: [swellDirection],
  swell_wave_period: [swellPeriod],
});

test('2026-11-25 07:00 JST uses the south swell instead of the west-northwest total wave', () => {
  const beach = estimate(hour(1.06, 295, 4.45, 0.38, 190, 5.95), 0);
  assert.equal(beach.height.toFixed(2), '0.27');
  assert.equal(beach.direction, 190);
  assert.equal(beach.period, 5.95);
});

test('2026-11-24 07:00 JST retains the south-southwest wind-wave event', () => {
  const beach = estimate(hour(1.38, 195, 4.75, 0.18, 145, 6.15), 0);
  assert.equal(beach.height.toFixed(2), '0.97');
  assert.equal(beach.direction, 195);
  assert.equal(beach.period, 4.75);
});

test('missing swell does not turn an offshore total wave into a beach estimate', () => {
  assert.equal(estimate(hour(1.06, 295, 4.45), 0).height, null);
  assert.equal(estimate(hour(1.06, 195, 4.45), 0).height.toFixed(2), '0.74');
  assert.equal(estimate({}, 0).height, null);
});

test('two known non-arriving components produce a flat estimate', () => {
  assert.deepEqual(estimate(hour(1.06, 295, 4.45, 0.38, 270, 5.95), 0), {
    height: 0, direction: null, period: null,
  });
});
