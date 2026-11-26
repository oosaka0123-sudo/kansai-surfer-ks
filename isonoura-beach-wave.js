/* Shared by the current conditions, hourly graph and 10-day forecast. */
(function (global) {
  'use strict';

  const factor = 0.7;
  const noWave = Object.freeze({ height: 0, direction: null, period: null });
  const missingWave = Object.freeze({ height: null, direction: null, period: null });

  function readWave(hourly, index, prefix) {
    const height = hourly[`${prefix}_height`]?.[index];
    if (!Number.isFinite(height) || height < 0) return null;
    if (height === 0) return noWave;
    const direction = hourly[`${prefix}_direction`]?.[index];
    if (!Number.isFinite(direction) || direction < 0 || direction > 360) return null;
    const period = hourly[`${prefix}_period`]?.[index];
    return { height, direction, period: Number.isFinite(period) && period > 0 ? period : null };
  }

  function reachesBeach(wave) {
    // Use Isonoura's existing preferred swell sector (150°–240°).
    return wave !== null && wave.direction >= 150 && wave.direction <= 240;
  }

  function estimate(hourly, index) {
    const total = readWave(hourly, index, 'wave');
    const swell = readWave(hourly, index, 'swell_wave');
    let beach = reachesBeach(total) ? total : null;
    if (reachesBeach(swell) && (beach === null || swell.height > beach.height)) beach = swell;
    if (beach !== null) return { ...beach, height: beach.height * factor };
    return total === noWave || (total !== null && swell !== null) ? noWave : missingWave;
  }

  global.ksIsonouraBeachWave = { estimate };
})(globalThis);
