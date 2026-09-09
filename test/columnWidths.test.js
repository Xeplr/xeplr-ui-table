import { measureColumnDemand, allocateColumnWidths, longestToken,
         WIDTH_NATURAL, WIDTH_SHRUNK, WIDTH_FLOOR, WIDTH_PINNED,
         resolvePercentWidths } from '../src/columnWidths.js';
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

// A monospace measurer, so every expected width below can be worked out by
// hand: 10px per character at the body font, 12px at the (bolder) header font.
function measure(text, font) {
  return String(text || '').length * (font === 'head' ? 12 : 10);
}

var NO_PAD = { measure: measure, bodyFont: 'body', headerFont: 'head',
               cellPadding: 0, headerPadding: 0, minWidth: 0, maxWidth: Infinity, maxFloor: Infinity,
               headerOf: function(c) { return c.header; }, keyOf: function(c) { return c.accessor; },
               textOf: function(row, c) { return row[c.accessor]; } };

function demand(columns, rows, overrides) {
  return measureColumnDemand(Object.assign({}, NO_PAD, { columns: columns, rows: rows }, overrides || {}));
}

console.log('\nlongestToken');

test('returns the widest space-delimited run', function() {
  assert.strictEqual(longestToken('New York City'), 'York');
});

test('a single unbroken string is entirely its own token', function() {
  assert.strictEqual(longestToken('https://example.com/a/b'), 'https://example.com/a/b');
});

test('handles empty and nullish', function() {
  assert.strictEqual(longestToken(''), '');
  assert.strictEqual(longestToken(null), '');
});

console.log('\nmeasureColumnDemand');

test('natural width is the widest cell, floor is its widest word', function() {
  var d = demand([{ accessor: 'city', header: 'a' }], [{ city: 'New York City' }]);
  assert.strictEqual(d[0].natural, 130); // 'New York City'
  assert.strictEqual(d[0].floor, 40);    // 'York'
});

test('the header counts as content — a wide header widens the column', function() {
  var d = demand([{ accessor: 'n', header: 'Quantity' }], [{ n: '7' }]);
  assert.strictEqual(d[0].natural, 96); // 8 chars at the 12px header font
});

test('measures the DISPLAYED text, not the raw value', function() {
  // This is the currency case: sizing on 36260.8 would leave the column too
  // narrow for the ₹36,260.80 actually on screen.
  var raw = demand([{ accessor: 'amt', header: 'a' }], [{ amt: 36260.8 }]);
  var formatted = demand([{ accessor: 'amt', header: 'a' }], [{ amt: 36260.8 }],
    { textOf: function(row) { return '₹36,260.80'; } });
  assert.ok(formatted[0].natural > raw[0].natural);
});

test('empty and null cells are skipped, not measured as "null"', function() {
  var d = demand([{ accessor: 'x', header: 'a' }], [{ x: null }, { x: '' }, { x: 'ab' }]);
  assert.strictEqual(d[0].natural, 20);
});

test('padding is added once per column, not per row', function() {
  var d = demand([{ accessor: 'x', header: 'a' }], [{ x: 'abc' }, { x: 'abcd' }], { cellPadding: 24 });
  assert.strictEqual(d[0].natural, 64); // 4 chars + 24
});

test('maxWidth caps an essay column so it cannot crowd out the rest', function() {
  var d = demand([{ accessor: 'x', header: 'a' }], [{ x: 'x'.repeat(500) }], { maxWidth: 400 });
  assert.strictEqual(d[0].natural, 400);
});

test('the floor never exceeds natural', function() {
  var d = demand([{ accessor: 'x', header: 'a' }], [{ x: 'x'.repeat(100) }], { maxWidth: 200, maxFloor: Infinity });
  assert.ok(d[0].floor <= d[0].natural, 'floor ' + d[0].floor + ' > natural ' + d[0].natural);
});

test('maxFloor stops one unbreakable token forcing horizontal scroll alone', function() {
  var d = demand([{ accessor: 'url', header: 'a' }], [{ url: 'https://example.com/a/very/long/path' }],
    { maxFloor: 150 });
  assert.strictEqual(d[0].floor, 150);
});

test('minWidth applies to an empty column', function() {
  var d = demand([{ accessor: 'x', header: '' }], [{ x: '' }], { minWidth: 40 });
  assert.strictEqual(d[0].natural, 40);
  assert.strictEqual(d[0].floor, 40);
});

console.log('\nallocateColumnWidths — case 1: everything fits');

test('each column gets exactly its natural width', function() {
  var out = allocateColumnWidths([{ key: 'a', natural: 100, floor: 40 }, { key: 'b', natural: 60, floor: 30 }], 500);
  assert.deepStrictEqual(out.widths, [100, 60]);
});

test('the leftover is reported as blank, not distributed', function() {
  var out = allocateColumnWidths([{ key: 'a', natural: 100, floor: 40 }, { key: 'b', natural: 60, floor: 30 }], 500);
  assert.strictEqual(out.tableWidth, 160);
  assert.strictEqual(out.blankWidth, 340);
  assert.strictEqual(out.overflow, false);
});

test('every column reads as "natural"', function() {
  var out = allocateColumnWidths([{ key: 'a', natural: 100, floor: 40 }], 500);
  assert.strictEqual(out.decisions[0].reason, WIDTH_NATURAL);
});

test('an exact fit leaves no blank and does not overflow', function() {
  var out = allocateColumnWidths([{ key: 'a', natural: 100, floor: 40 }, { key: 'b', natural: 60, floor: 30 }], 160);
  assert.strictEqual(out.blankWidth, 0);
  assert.strictEqual(out.overflow, false);
  assert.deepStrictEqual(out.widths, [100, 60]);
});

test('unknown container width means unlimited — natural, no blank', function() {
  var out = allocateColumnWidths([{ key: 'a', natural: 100, floor: 40 }], 0);
  assert.deepStrictEqual(out.widths, [100]);
  assert.strictEqual(out.blankWidth, 0);
});

console.log('\nallocateColumnWidths — case 2: squeeze (no blank column)');

// The case that motivated the whole rule: a 200px container holding a website
// name and a number under 100. The number must not be padded out while the
// website is squeezed, and nothing may be left blank.
var TIGHT = [
  { key: 'site', natural: 260, floor: 90 },  // 'verylongdomain.example.com'
  { key: 'qty', natural: 46, floor: 46 }     // '<100' — never wants more
];

test('the column that needs nothing extra gets nothing extra', function() {
  var out = allocateColumnWidths(TIGHT, 200);
  assert.strictEqual(out.widths[1], 46);
});

test('all the slack goes to the column that actually wants it', function() {
  var out = allocateColumnWidths(TIGHT, 200);
  assert.strictEqual(out.widths[0], 154); // 200 - 46
});

test('NOTHING is left blank while a column is still short', function() {
  var out = allocateColumnWidths(TIGHT, 200);
  assert.strictEqual(out.blankWidth, 0);
  assert.strictEqual(out.tableWidth, 200);
});

test('the squeezed column says so; the satisfied one does not', function() {
  var out = allocateColumnWidths(TIGHT, 200);
  assert.strictEqual(out.decisions[0].reason, WIDTH_SHRUNK);
  assert.strictEqual(out.decisions[1].reason, WIDTH_NATURAL);
});

test('the decision record carries what was asked for and what was given', function() {
  var out = allocateColumnWidths(TIGHT, 200).decisions[0];
  assert.strictEqual(out.natural, 260);
  assert.strictEqual(out.floor, 90);
  assert.strictEqual(out.width, 154);
});

test('surplus splits in proportion to unmet demand, not evenly', function() {
  // demands 200 and 100; surplus 150 -> 100 and 50 on top of the floors.
  var out = allocateColumnWidths(
    [{ key: 'a', natural: 300, floor: 100 }, { key: 'b', natural: 200, floor: 100 }], 350);
  assert.deepStrictEqual(out.widths, [200, 150]);
});

test('no column is ever pushed above its natural width by the surplus', function() {
  var out = allocateColumnWidths(
    [{ key: 'a', natural: 500, floor: 50 }, { key: 'b', natural: 55, floor: 50 }], 300);
  assert.ok(out.widths[1] <= 55, 'b got ' + out.widths[1] + ' but only wanted 55');
});

test('rounding remainder is absorbed so the table lands on the container edge', function() {
  var out = allocateColumnWidths(
    [{ key: 'a', natural: 301, floor: 100 }, { key: 'b', natural: 199, floor: 99 },
     { key: 'c', natural: 177, floor: 77 }], 431);
  assert.strictEqual(out.tableWidth, 431);
  assert.strictEqual(out.blankWidth, 0);
});

test('a squeeze never overflows', function() {
  var out = allocateColumnWidths(TIGHT, 200);
  assert.strictEqual(out.overflow, false);
});

console.log('\nallocateColumnWidths — case 3: floors do not fit');

test('everyone drops to their floor and the table scrolls', function() {
  var out = allocateColumnWidths(
    [{ key: 'a', natural: 300, floor: 150 }, { key: 'b', natural: 300, floor: 150 }], 200);
  assert.deepStrictEqual(out.widths, [150, 150]);
  assert.strictEqual(out.overflow, true);
  assert.strictEqual(out.tableWidth, 300);
});

test('overflow reports no blank space', function() {
  var out = allocateColumnWidths(
    [{ key: 'a', natural: 300, floor: 150 }, { key: 'b', natural: 300, floor: 150 }], 200);
  assert.strictEqual(out.blankWidth, 0);
});

test('a column at its floor says "floor", not "shrunk"', function() {
  var out = allocateColumnWidths(
    [{ key: 'a', natural: 300, floor: 150 }, { key: 'b', natural: 300, floor: 150 }], 200);
  assert.strictEqual(out.decisions[0].reason, WIDTH_FLOOR);
});

console.log('\nallocateColumnWidths — invariants');

test('blank space exists ONLY when every column is at its natural width', function() {
  // The property the whole design rests on, checked across the boundary.
  var cases = [
    [[{ key: 'a', natural: 100, floor: 50 }, { key: 'b', natural: 100, floor: 50 }], 500],
    [[{ key: 'a', natural: 100, floor: 50 }, { key: 'b', natural: 100, floor: 50 }], 200],
    [[{ key: 'a', natural: 100, floor: 50 }, { key: 'b', natural: 100, floor: 50 }], 199],
    [[{ key: 'a', natural: 100, floor: 50 }, { key: 'b', natural: 100, floor: 50 }], 150],
    [[{ key: 'a', natural: 100, floor: 50 }, { key: 'b', natural: 100, floor: 50 }], 99]
  ];
  cases.forEach(function(c) {
    var out = allocateColumnWidths(c[0], c[1]);
    if (out.blankWidth > 0) {
      out.decisions.forEach(function(d) {
        assert.strictEqual(d.width, d.natural,
          'container ' + c[1] + ': blank space with ' + d.key + ' at ' + d.width + ' of ' + d.natural);
      });
    }
  });
});

test('assigned width never drops below the floor', function() {
  [500, 300, 200, 150, 100, 50, 10].forEach(function(width) {
    allocateColumnWidths(TIGHT, width).decisions.forEach(function(d) {
      assert.ok(d.width >= d.floor, 'at ' + width + ': ' + d.key + ' got ' + d.width + ' below floor ' + d.floor);
    });
  });
});

test('the table never exceeds the container unless overflow is flagged', function() {
  [500, 300, 200, 150, 100].forEach(function(width) {
    var out = allocateColumnWidths(TIGHT, width);
    assert.ok(out.tableWidth <= width || out.overflow,
      'at ' + width + ': table ' + out.tableWidth + ' overflows without the flag');
  });
});

test('no columns is not a crash', function() {
  var out = allocateColumnWidths([], 500);
  assert.deepStrictEqual(out.widths, []);
  assert.strictEqual(out.blankWidth, 500);
});

console.log('\npinned widths (columnWidths overrides)');

// Three columns of plainly different appetite, so a pin is visibly not a
// measurement: 'a' wants 40, 'b' wants 400, 'c' wants 40.
var PIN_COLS = [{ accessor: 'a', header: 'a' }, { accessor: 'b', header: 'b' }, { accessor: 'c', header: 'c' }];
var PIN_ROWS = [{ a: 'xxxx', b: 'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww', c: 'yyyy' }];

test('a pinned column is not measured at all', function() {
  var seen = [];
  var out = demand(PIN_COLS, PIN_ROWS, {
    overrides: { 1: 200 },
    textOf: function(row, c) { seen.push(c.accessor); return row[c.accessor]; }
  });
  assert.strictEqual(out[1].natural, 200);
  assert.strictEqual(out[1].floor, 200);
  assert.ok(out[1].pinned);
  assert.ok(seen.indexOf('b') === -1, 'pinned column b was measured anyway');
  assert.ok(seen.indexOf('a') !== -1, 'unpinned column a should still be measured');
});

test('a pin is honoured below the min width — an instruction beats a guess', function() {
  var out = demand(PIN_COLS, PIN_ROWS, { overrides: { 0: 5 }, minWidth: 40 });
  assert.strictEqual(out[0].natural, 5);
});

test('junk overrides are ignored, not clamped', function() {
  [{ 0: 0 }, { 0: -10 }, { 0: NaN }, { 0: '120' }, { 0: null }].forEach(function(bad) {
    var out = demand(PIN_COLS, PIN_ROWS, { overrides: bad });
    assert.ok(!out[0].pinned, 'override ' + JSON.stringify(bad) + ' should have been ignored');
  });
});

test('a pinned column keeps its width exactly while the rest negotiate', function() {
  var d = demand(PIN_COLS, PIN_ROWS, { overrides: { 1: 200 } });
  var out = allocateColumnWidths(d, 300);
  assert.strictEqual(out.widths[1], 200);
  // The free columns get their NATURAL widths and the leftover stays blank —
  // the pin reduced the container to 100 and they only wanted 40 each, so
  // this is case 1 for them. Blank space next to a pin is correct: the rule
  // is "no blank space while a column is short", and neither of these is.
  assert.strictEqual(out.widths[0], d[0].natural);
  assert.strictEqual(out.widths[2], d[2].natural);
  assert.strictEqual(out.blankWidth, 300 - out.tableWidth);
});

test('the pin comes out of the container the free columns divide', function() {
  // Squeezed hard enough that the free columns cannot all have natural: the
  // pin must still be excluded from the surplus maths rather than shrunk
  // alongside them.
  // Wrappable text, so the free columns have room between floor and natural
  // to be squeezed INTO. A single unbreakable token would be case 3 (floors
  // and scroll), which is a different rule and not what this is testing.
  var wide = [{ accessor: 'a', header: 'a' }, { accessor: 'b', header: 'b' }, { accessor: 'c', header: 'c' }];
  var rows = [{ a: 'aa aa aa aa', b: 'bb', c: 'cc cc cc cc' }];
  var d = demand(wide, rows, { overrides: { 1: 200 } });
  var out = allocateColumnWidths(d, 300);
  assert.strictEqual(out.widths[1], 200, 'pin shrank');
  assert.strictEqual(out.widths[0] + out.widths[2], 100, 'free columns did not fill the remainder');
  assert.strictEqual(out.blankWidth, 0);
});

test('a pin is never shrunk, even when the table is squeezed hard', function() {
  var d = demand(PIN_COLS, PIN_ROWS, { overrides: { 1: 200 } });
  [400, 300, 260, 250].forEach(function(container) {
    assert.strictEqual(allocateColumnWidths(d, container).widths[1], 200,
      'pin moved at container ' + container);
  });
});

test('pins wider than the container overflow — they do NOT read as "unlimited"', function() {
  // The trap: remaining = 300 - 400 = -100, and <=0 already meant "container
  // unknown, treat as unlimited". Falling through would hand the free columns
  // their NATURAL widths at exactly the moment there is no room at all.
  var d = demand(PIN_COLS, PIN_ROWS, { overrides: { 0: 200, 1: 200 } });
  var out = allocateColumnWidths(d, 300);
  assert.strictEqual(out.widths[0], 200);
  assert.strictEqual(out.widths[1], 200);
  assert.strictEqual(out.widths[2], d[2].floor, 'free column should be at its floor');
  assert.ok(out.overflow, 'overflow must be flagged');
  assert.strictEqual(out.blankWidth, 0);
});

test('pinning every column is not a crash', function() {
  var d = demand(PIN_COLS, PIN_ROWS, { overrides: { 0: 50, 1: 60, 2: 70 } });
  var out = allocateColumnWidths(d, 1000);
  assert.deepStrictEqual(out.widths, [50, 60, 70]);
  assert.strictEqual(out.tableWidth, 180);
  assert.strictEqual(out.blankWidth, 820);
});

test('a pinned column reports "pinned", not "natural"', function() {
  var d = demand(PIN_COLS, PIN_ROWS, { overrides: { 1: 200 } });
  var out = allocateColumnWidths(d, 300);
  assert.strictEqual(out.decisions[1].reason, WIDTH_PINNED);
  assert.notStrictEqual(out.decisions[0].reason, WIDTH_PINNED);
});

test('no overrides behaves exactly as before', function() {
  var d = demand(PIN_COLS, PIN_ROWS);
  assert.deepStrictEqual(allocateColumnWidths(d, 300).widths,
                         allocateColumnWidths(demand(PIN_COLS, PIN_ROWS, { overrides: {} }), 300).widths);
});

console.log('\nresolvePercentWidths');

test('a percentage is a share of the available width', function() {
  assert.deepStrictEqual(resolvePercentWidths({ 0: 25, 2: 50 }, 800), { 0: 200, 2: 400 });
});

test('two columns at 50 fill the table exactly', function() {
  var px = resolvePercentWidths({ 0: 50, 1: 50 }, 640);
  assert.strictEqual(px[0] + px[1], 640);
});

test('the same percentage tracks the container as it shrinks', function() {
  [1600, 1200, 800, 375].forEach(function(available) {
    assert.strictEqual(resolvePercentWidths({ 0: 25 }, available)[0], Math.round(available / 4));
  });
});

test('junk percentages are dropped, leaving the column to be measured', function() {
  assert.deepStrictEqual(resolvePercentWidths({ 0: 0, 1: -5, 2: NaN, 3: '20', 4: 20 }, 500), { 4: 100 });
});

test('no container means nothing to take a percentage of', function() {
  assert.strictEqual(resolvePercentWidths({ 0: 50 }, 0), null);
  assert.strictEqual(resolvePercentWidths({ 0: 50 }, -10), null);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
