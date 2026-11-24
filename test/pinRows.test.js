// Rows kept at the bottom of every page (src/pinRows.js): the host's
// pinBottomRows answered per row, as TanStack row ids.
import { bottomRowIds } from '../src/pinRows.js';
import assert from 'node:assert';

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed++; console.log('  ✗ ' + name); console.log('    ' + e.message); }
}

var rows = [{ a: 1 }, { a: 2 }, { a: 3, __rowKind: 'total' }];
test('the grand total, by its place in the data', function() {
  assert.deepStrictEqual(bottomRowIds(rows, function(r) { return r.__rowKind === 'total'; }), ['2']);
});
test('no function, or no rows: nothing pinned', function() {
  assert.deepStrictEqual(bottomRowIds(rows, null), []);
  assert.deepStrictEqual(bottomRowIds(null, function() { return true; }), []);
});
test('several, in their order', function() {
  assert.deepStrictEqual(bottomRowIds(rows, function(r) { return r.a > 1; }), ['1', '2']);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
