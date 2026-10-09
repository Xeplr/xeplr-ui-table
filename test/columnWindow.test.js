import { columnWindow, windowHeaders, shouldWindowColumns, COLUMN_WINDOW_THRESHOLD } from '../src/columnWindow.js';
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

var w100 = Array.from({ length: 1000 }, function() { return 100; });

console.log('columnWindow');

test('at the left edge: the screenful plus the overscan, nothing before', function() {
  var r = columnWindow({ widths: w100, scrollLeft: 0, viewportWidth: 1000, overscan: 2 });
  assert.deepStrictEqual(r, { start: 0, end: 12, before: 0, after: 988 * 100 });
});

test('scrolled: the columns in view, the spacers holding the rest exactly', function() {
  var r = columnWindow({ widths: w100, scrollLeft: 50000, viewportWidth: 1000, overscan: 2 });
  assert.strictEqual(r.start, 498);
  assert.strictEqual(r.end, 512);
  assert.strictEqual(r.before + (r.end - r.start) * 100 + r.after, 1000 * 100, 'total width unchanged');
});

test('a column half in view at the left is drawn', function() {
  var r = columnWindow({ widths: w100, scrollLeft: 550, viewportWidth: 300, overscan: 0 });
  assert.strictEqual(r.start, 5);
  assert.strictEqual(r.end, 9);
});

test('fixed columns before the data (expand, checkbox) shift the window', function() {
  var r = columnWindow({ widths: w100, scrollLeft: 540, viewportWidth: 300, leadingWidth: 40, overscan: 0 });
  assert.strictEqual(r.start, 5);
});

test('scrolled to the very end', function() {
  var r = columnWindow({ widths: w100, scrollLeft: 99000, viewportWidth: 1000, overscan: 3 });
  assert.strictEqual(r.end, 1000);
  assert.strictEqual(r.after, 0);
  assert.strictEqual(r.start, 987);
});

test('scrolled past the end (a table that just got narrower) still draws the last columns', function() {
  var r = columnWindow({ widths: w100.slice(0, 10), scrollLeft: 5000, viewportWidth: 500, overscan: 0 });
  assert.strictEqual(r.start, 9);
  assert.strictEqual(r.end, 10);
});

test('uneven widths', function() {
  var r = columnWindow({ widths: [50, 300, 20, 20, 400, 10], scrollLeft: 360, viewportWidth: 30, overscan: 0 });
  assert.deepStrictEqual(r, { start: 2, end: 4, before: 350, after: 410 });
});

test('no viewport yet: a screenful from the left, not nothing', function() {
  var r = columnWindow({ widths: w100, scrollLeft: 0, viewportWidth: 0, overscan: 0 });
  assert.strictEqual(r.start, 0);
  assert.ok(r.end >= 10);
});

test('no columns', function() {
  assert.deepStrictEqual(columnWindow({ widths: [], scrollLeft: 0, viewportWidth: 500 }), { start: 0, end: 0, before: 0, after: 0 });
});

console.log('windowHeaders');

// Row 0 of a pivot: Category (a padded placeholder, span 1), then dates over 3 measures each.
var groupRow = [{ id: 'cat', colSpan: 1 }, { id: 'd1', colSpan: 3 }, { id: 'd2', colSpan: 3 }, { id: 'd3', colSpan: 3 }];

test('a group header cut by the window keeps only the part inside', function() {
  var cut = windowHeaders(groupRow, 2, 8);
  assert.deepStrictEqual(cut.map(function(c) { return c.header.id + ':' + c.colSpan; }), ['d1:2', 'd2:3', 'd3:1']);
});

test('the whole row inside: unchanged', function() {
  var cut = windowHeaders(groupRow, 0, 10);
  assert.deepStrictEqual(cut.map(function(c) { return c.colSpan; }), [1, 3, 3, 3]);
});

test('every row of a grouped header covers the same leaf columns', function() {
  var leafRow = Array.from({ length: 10 }, function(_, i) { return { id: 'l' + i, colSpan: 1 }; });
  var sum = function(list) { return list.reduce(function(s, c) { return s + c.colSpan; }, 0); };
  assert.strictEqual(sum(windowHeaders(groupRow, 3, 9)), sum(windowHeaders(leafRow, 3, 9)));
});

console.log('shouldWindowColumns');

test('auto: only wide tables', function() {
  assert.strictEqual(shouldWindowColumns(COLUMN_WINDOW_THRESHOLD), false);
  assert.strictEqual(shouldWindowColumns(COLUMN_WINDOW_THRESHOLD + 1), true);
  assert.strictEqual(shouldWindowColumns(1000, 'off'), false);
  assert.strictEqual(shouldWindowColumns(3, 'on'), true);
  assert.strictEqual(shouldWindowColumns(0, 'on'), false);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
