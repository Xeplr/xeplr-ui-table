import { resolveCellStyle } from '../src/resolveCellStyle.js';
import assert from 'node:assert';

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name);
    console.log('    ' + e.message);
  }
}

// ── String: is / is not ──

console.log('\n--- String equality ---');

test('is match (exact)', function() {
  var style = resolveCellStyle('active', [
    { when: "$.status is active", backgroundColor: '#1b5e20' }
  ], 'status', { status: 'active' });
  assert.deepStrictEqual(style, { backgroundColor: '#1b5e20' });
});

test('is is case-sensitive (no match on different case)', function() {
  var style = resolveCellStyle('Active', [
    { when: "$.status is active", backgroundColor: '#1b5e20' }
  ], 'status', { status: 'Active' });
  assert.strictEqual(style, null);
});

test('is exact case match', function() {
  var style = resolveCellStyle('Active', [
    { when: "$.status is Active", backgroundColor: '#1b5e20' }
  ], 'status', { status: 'Active' });
  assert.deepStrictEqual(style, { backgroundColor: '#1b5e20' });
});

test('is no match', function() {
  var style = resolveCellStyle('inactive', [
    { when: "$.status is active", backgroundColor: '#1b5e20' }
  ], 'status', { status: 'inactive' });
  assert.strictEqual(style, null);
});

test('is not match', function() {
  var style = resolveCellStyle('inactive', [
    { when: "$.status is not active", color: 'red' }
  ], 'status', { status: 'inactive' });
  assert.deepStrictEqual(style, { color: 'red' });
});

// ── Null checks ──

console.log('\n--- Null checks ---');

test('is null match (null value)', function() {
  var style = resolveCellStyle(null, [
    { when: "$.status is null", backgroundColor: '#333' }
  ], 'status', { status: null });
  assert.deepStrictEqual(style, { backgroundColor: '#333' });
});

test('is null match (undefined value)', function() {
  var style = resolveCellStyle(undefined, [
    { when: "$.status is null", backgroundColor: '#333' }
  ], 'status', {});
  assert.deepStrictEqual(style, { backgroundColor: '#333' });
});

test('is null match (empty string)', function() {
  var style = resolveCellStyle('', [
    { when: "$.status is null", backgroundColor: '#333' }
  ], 'status', { status: '' });
  assert.deepStrictEqual(style, { backgroundColor: '#333' });
});

test('is null no match', function() {
  var style = resolveCellStyle('active', [
    { when: "$.status is null", backgroundColor: '#333' }
  ], 'status', { status: 'active' });
  assert.strictEqual(style, null);
});

test('is not null match', function() {
  var style = resolveCellStyle('active', [
    { when: "$.status is not null", color: 'green' }
  ], 'status', { status: 'active' });
  assert.deepStrictEqual(style, { color: 'green' });
});

test('is not null no match (null)', function() {
  var style = resolveCellStyle(null, [
    { when: "$.status is not null", color: 'green' }
  ], 'status', { status: null });
  assert.strictEqual(style, null);
});

// ── Number comparisons ──

console.log('\n--- Number comparisons ---');

test('> match', function() {
  var style = resolveCellStyle(150, [
    { when: "$.price > 100", backgroundColor: 'red' }
  ], 'price', { price: 150 });
  assert.deepStrictEqual(style, { backgroundColor: 'red' });
});

test('> no match', function() {
  var style = resolveCellStyle(50, [
    { when: "$.price > 100", backgroundColor: 'red' }
  ], 'price', { price: 50 });
  assert.strictEqual(style, null);
});

test('>= match (equal)', function() {
  var style = resolveCellStyle(90, [
    { when: "$.score >= 90", color: 'gold' }
  ], 'score', { score: 90 });
  assert.deepStrictEqual(style, { color: 'gold' });
});

test('< match', function() {
  var style = resolveCellStyle(10, [
    { when: "$.score < 50", color: 'red' }
  ], 'score', { score: 10 });
  assert.deepStrictEqual(style, { color: 'red' });
});

test('<= match', function() {
  var style = resolveCellStyle(5, [
    { when: "$.stock <= 5", backgroundColor: 'orange' }
  ], 'stock', { stock: 5 });
  assert.deepStrictEqual(style, { backgroundColor: 'orange' });
});

// ── Between ──

console.log('\n--- Between ---');

test('between match (inside range)', function() {
  var style = resolveCellStyle(75, [
    { when: "$.score between 50 and 100", backgroundColor: 'yellow' }
  ], 'score', { score: 75 });
  assert.deepStrictEqual(style, { backgroundColor: 'yellow' });
});

test('between match (at lower bound)', function() {
  var style = resolveCellStyle(50, [
    { when: "$.score between 50 and 100", backgroundColor: 'yellow' }
  ], 'score', { score: 50 });
  assert.deepStrictEqual(style, { backgroundColor: 'yellow' });
});

test('between match (at upper bound)', function() {
  var style = resolveCellStyle(100, [
    { when: "$.score between 50 and 100", backgroundColor: 'yellow' }
  ], 'score', { score: 100 });
  assert.deepStrictEqual(style, { backgroundColor: 'yellow' });
});

test('between no match (below)', function() {
  var style = resolveCellStyle(30, [
    { when: "$.score between 50 and 100", backgroundColor: 'yellow' }
  ], 'score', { score: 30 });
  assert.strictEqual(style, null);
});

test('between no match (above)', function() {
  var style = resolveCellStyle(120, [
    { when: "$.score between 50 and 100", backgroundColor: 'yellow' }
  ], 'score', { score: 120 });
  assert.strictEqual(style, null);
});

// ── String operators ──

console.log('\n--- String operators ---');

test('starts with match', function() {
  var style = resolveCellStyle('John Doe', [
    { when: "$.name starts with 'Jo'", fontWeight: 'bold' }
  ], 'name', { name: 'John Doe' });
  assert.deepStrictEqual(style, { fontWeight: 'bold' });
});

test('starts with no match', function() {
  var style = resolveCellStyle('Alice', [
    { when: "$.name starts with 'Jo'", fontWeight: 'bold' }
  ], 'name', { name: 'Alice' });
  assert.strictEqual(style, null);
});

test('ends with match', function() {
  var style = resolveCellStyle('report.pdf', [
    { when: "$.file ends with 'pdf'", color: 'red' }
  ], 'file', { file: 'report.pdf' });
  assert.deepStrictEqual(style, { color: 'red' });
});

test('contains match', function() {
  var style = resolveCellStyle('This is urgent!', [
    { when: "$.desc contains 'urgent'", backgroundColor: 'red' }
  ], 'desc', { desc: 'This is urgent!' });
  assert.deepStrictEqual(style, { backgroundColor: 'red' });
});

test('contains no match', function() {
  var style = resolveCellStyle('All good here', [
    { when: "$.desc contains 'urgent'", backgroundColor: 'red' }
  ], 'desc', { desc: 'All good here' });
  assert.strictEqual(style, null);
});

test('does not contain match', function() {
  var style = resolveCellStyle('still pending', [
    { when: "$.desc does not contain 'resolved'", color: 'orange' }
  ], 'desc', { desc: 'still pending' });
  assert.deepStrictEqual(style, { color: 'orange' });
});

test('does not contain no match', function() {
  var style = resolveCellStyle('issue resolved', [
    { when: "$.desc does not contain 'resolved'", color: 'orange' }
  ], 'desc', { desc: 'issue resolved' });
  assert.strictEqual(style, null);
});

// ── In / not in ──

console.log('\n--- In / not in ---');

test('in match', function() {
  var style = resolveCellStyle('active', [
    { when: "$.status in [active, pending]", color: 'green' }
  ], 'status', { status: 'active' });
  assert.deepStrictEqual(style, { color: 'green' });
});

test('in no match', function() {
  var style = resolveCellStyle('archived', [
    { when: "$.status in [active, pending]", color: 'green' }
  ], 'status', { status: 'archived' });
  assert.strictEqual(style, null);
});

test('not in match', function() {
  var style = resolveCellStyle('viewer', [
    { when: "$.role not in [admin, superadmin]", opacity: '0.5' }
  ], 'role', { role: 'viewer' });
  assert.deepStrictEqual(style, { opacity: '0.5' });
});

// ── First match wins ──

console.log('\n--- First match wins ---');

test('returns first matching rule', function() {
  var style = resolveCellStyle(95, [
    { when: "$.score >= 90", backgroundColor: 'green' },
    { when: "$.score >= 50", backgroundColor: 'yellow' },
    { when: "$.score < 50",  backgroundColor: 'red' }
  ], 'score', { score: 95 });
  assert.deepStrictEqual(style, { backgroundColor: 'green' });
});

test('falls through to second rule', function() {
  var style = resolveCellStyle(70, [
    { when: "$.score >= 90", backgroundColor: 'green' },
    { when: "$.score >= 50", backgroundColor: 'yellow' },
    { when: "$.score < 50",  backgroundColor: 'red' }
  ], 'score', { score: 70 });
  assert.deepStrictEqual(style, { backgroundColor: 'yellow' });
});

test('falls through to last rule', function() {
  var style = resolveCellStyle(20, [
    { when: "$.score >= 90", backgroundColor: 'green' },
    { when: "$.score >= 50", backgroundColor: 'yellow' },
    { when: "$.score < 50",  backgroundColor: 'red' }
  ], 'score', { score: 20 });
  assert.deepStrictEqual(style, { backgroundColor: 'red' });
});

// ── Cross-field conditions ──

console.log('\n--- Cross-field conditions ---');

test('style one column based on another column value', function() {
  var row = { grade: 'A', score: 95 };
  var style = resolveCellStyle('A', [
    { when: "$.score >= 90", backgroundColor: 'green', color: 'white' }
  ], 'grade', row);
  assert.deepStrictEqual(style, { backgroundColor: 'green', color: 'white' });
});

test('cross-field no match', function() {
  var row = { grade: 'C', score: 60 };
  var style = resolveCellStyle('C', [
    { when: "$.score >= 90", backgroundColor: 'green' }
  ], 'grade', row);
  assert.strictEqual(style, null);
});

// ── Multiple style properties ──

console.log('\n--- Multiple style properties ---');

test('returns all style properties from matched rule', function() {
  var style = resolveCellStyle('active', [
    { when: "$.status is active", backgroundColor: '#1b5e20', color: '#a5d6a7', fontWeight: 'bold' }
  ], 'status', { status: 'active' });
  assert.deepStrictEqual(style, { backgroundColor: '#1b5e20', color: '#a5d6a7', fontWeight: 'bold' });
});

// ── Function form ──

console.log('\n--- Function form ---');

test('function form returns style', function() {
  var fn = function(value, row) {
    if (value > row.target) return { backgroundColor: 'green' };
    return null;
  };
  var style = resolveCellStyle(100, fn, 'revenue', { revenue: 100, target: 80 });
  assert.deepStrictEqual(style, { backgroundColor: 'green' });
});

test('function form returns null', function() {
  var fn = function(value, row) {
    if (value > row.target) return { backgroundColor: 'green' };
    return null;
  };
  var style = resolveCellStyle(50, fn, 'revenue', { revenue: 50, target: 80 });
  assert.strictEqual(style, null);
});

// ── Edge cases ──

console.log('\n--- Edge cases ---');

test('null cellStyle returns null', function() {
  assert.strictEqual(resolveCellStyle('x', null, 'col', {}), null);
});

test('undefined cellStyle returns null', function() {
  assert.strictEqual(resolveCellStyle('x', undefined, 'col', {}), null);
});

test('empty array returns null', function() {
  assert.strictEqual(resolveCellStyle('x', [], 'col', {}), null);
});

test('no matching rules returns null', function() {
  var style = resolveCellStyle('inactive', [
    { when: "$.status is active", color: 'green' }
  ], 'status', { status: 'inactive' });
  assert.strictEqual(style, null);
});

test('rule without when is skipped', function() {
  var style = resolveCellStyle('active', [
    { backgroundColor: 'red' },
    { when: "$.status is active", backgroundColor: 'green' }
  ], 'status', { status: 'active' });
  assert.deepStrictEqual(style, { backgroundColor: 'green' });
});

test('numeric string coercion in comparison', function() {
  var style = resolveCellStyle('150', [
    { when: "$.price > 100", color: 'red' }
  ], 'price', { price: '150' });
  assert.deepStrictEqual(style, { color: 'red' });
});

// ── Summary ──

console.log('\n' + (passed + failed) + ' tests: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
