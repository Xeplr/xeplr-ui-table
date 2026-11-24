// A number shown as a trend (src/trend.js): its direction from its own sign,
// green up / red down, a rule's colour winning — what the `trend` renderer and
// any host's KPI draw.
import { trendOf, trendLook, TREND_COLORS } from '../src/trend.js';
import assert from 'node:assert';

var passed = 0;
var failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed++; console.log('  ✗ ' + name); console.log('    ' + e.message); }
}

test('a positive number goes up, a negative one down', function() {
  assert.strictEqual(trendOf(2.2), 'up');
  assert.strictEqual(trendOf(-0.4), 'down');
  assert.strictEqual(trendOf('-12'), 'down');
});
test('zero, a blank or text has no direction', function() {
  [0, null, undefined, '', '  ', 'n/a', NaN, Infinity].forEach(function(v) { assert.strictEqual(trendOf(v), null, String(v)); });
});
test('up is green with ▲, down red with ▼', function() {
  assert.deepStrictEqual(trendLook(5), { arrow: '▲', color: TREND_COLORS.up });
  assert.deepStrictEqual(trendLook(-5), { arrow: '▼', color: TREND_COLORS.down });
});
test("a rule's colour wins: a refund rate going down is good", function() {
  assert.deepStrictEqual(trendLook(-5, '#1a7f37'), { arrow: '▼', color: '#1a7f37' });
});
test('no direction: no arrow, and only a rule colours it', function() {
  assert.deepStrictEqual(trendLook(0), { arrow: null, color: null });
  assert.deepStrictEqual(trendLook(null, '#999'), { arrow: null, color: '#999' });
});
test('a host may replace the defaults', function() {
  assert.strictEqual(trendLook(1, null, { up: 'blue', down: 'orange' }).color, 'blue');
  assert.strictEqual(trendLook(-1, null, { up: 'blue', down: 'orange' }).color, 'orange');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
