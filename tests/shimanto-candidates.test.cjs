const assert = require('node:assert/strict');
const config = require('../shimanto/spot-candidates.json');
assert.equal(config.status,'candidate');
assert.equal(config.includeInKansaiRanking,false);
assert.equal(config.showScoreOnHome,false);
assert.equal(config.showRankingOnHome,false);
assert.equal(config.spots.length,5);
assert.equal(new Set(config.spots.map(s=>s.id)).size,5);
const legacy = new Set(['isonoura','kounohama','ikumi','komatsu','irago','shizunami','hamadutu','takahama','hakuto']);
for(const s of config.spots){assert.ok(!legacy.has(s.id));assert.equal(s.marineProbe.approved,false);assert.equal(s.beachReference.verified,false);assert.equal(s.marineProbe.validHours,72);assert.equal(s.cameraPlaybackVerified,false);assert.ok(['L6','TS'].includes(s.tideStationCandidate));}
assert.equal(new Set(config.spots.map(s=>s.marineProbe.returnedGrid.join(','))).size,2);
assert.equal(config.spots.filter(s=>s.officialCameraPage).length,2);
console.log('Shimanto candidate registry checks passed; no runtime integration.');