import {
  STYLE_GROUPS, STYLE_FIELDS, styleField, cssLength,
  flattenStyle, resolveStyle, toCssProperties, resolveCellCss
} from '../src/tableStyles.js';
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

console.log('\nregistry');

test('every field has a unique path', function() {
  var seen = {};
  STYLE_FIELDS.forEach(function(f) {
    assert.ok(!seen[f.key], 'duplicate path ' + f.key);
    seen[f.key] = true;
  });
});

test('every field except the border shorthand maps to a CSS property', function() {
  STYLE_FIELDS.forEach(function(f) {
    if (f.key.indexOf('border.all.') === 0) {
      assert.strictEqual(f.css, null, f.key + ' must never reach CSS');
    } else {
      assert.ok(f.css, f.key + ' has no CSS mapping');
    }
  });
});

test('every select field ships options, or a panel cannot render it', function() {
  STYLE_FIELDS.forEach(function(f) {
    if (f.type === 'select') assert.ok(f.options && f.options.length, f.key + ' has no options');
  });
});

test('margin is deliberately absent — a <td> discards it', function() {
  assert.ok(!STYLE_FIELDS.some(function(f) { return f.key.indexOf('margin') !== -1; }));
});

test('groups partition the fields exactly', function() {
  var total = STYLE_GROUPS.reduce(function(n, g) { return n + g.fields.length; }, 0);
  assert.strictEqual(total, STYLE_FIELDS.length);
});

test('styleField looks a path up', function() {
  assert.strictEqual(styleField('text.color').css, 'color');
  assert.strictEqual(styleField('nope.nope'), null);
});

console.log('\ncssLength');

test('a {value, unit} pair keeps its unit', function() {
  assert.strictEqual(cssLength({ value: 1.5, unit: 'em' }), '1.5em');
});

test('a bare number means px', function() {
  assert.strictEqual(cssLength(12), '12px');
});

test('a string passes through, so a host can store auto or var()', function() {
  assert.strictEqual(cssLength('var(--rb-pad)'), 'var(--rb-pad)');
});

test('empty is null, not "0px"', function() {
  assert.strictEqual(cssLength(null), null);
  assert.strictEqual(cssLength(''), null);
});

console.log('\nflattenStyle');

test('nested objects become paths', function() {
  var flat = flattenStyle({ text: { color: '#111' }, box: { padding: { left: 12 } } });
  assert.strictEqual(flat['text.color'], '#111');
  assert.strictEqual(flat['box.padding.left'], 12);
});

test('a {value, unit} pair is a leaf, not a branch', function() {
  var flat = flattenStyle({ text: { fontSize: { value: 12, unit: 'px' } } });
  assert.deepStrictEqual(flat['text.fontSize'], { value: 12, unit: 'px' });
  assert.strictEqual(flat['text.fontSize.value'], undefined);
});

test('border.all expands to all four sides', function() {
  var flat = flattenStyle({ border: { all: { width: 1, style: 'solid', color: '#ccc' } } });
  ['top', 'right', 'bottom', 'left'].forEach(function(side) {
    assert.strictEqual(flat['border.' + side + '.width'], 1);
    assert.strictEqual(flat['border.' + side + '.color'], '#ccc');
  });
});

test('an explicit side beats "all" within the same layer', function() {
  var flat = flattenStyle({ border: { all: { width: 1 }, top: { width: 3 } } });
  assert.strictEqual(flat['border.top.width'], 3);
  assert.strictEqual(flat['border.bottom.width'], 1);
});

test('"all" itself never survives flattening', function() {
  var flat = flattenStyle({ border: { all: { width: 1 } } });
  assert.strictEqual(flat['border.all.width'], undefined);
});

test('an empty style flattens to nothing', function() {
  assert.deepStrictEqual(flattenStyle(null), {});
  assert.deepStrictEqual(flattenStyle({}), {});
});

console.log('\nresolveStyle — layer precedence');

var THEME = { id: 'theme', style: { text: { color: '#111', fontWeight: '400' }, fill: { background: '#fff' } } };

test('a later layer wins', function() {
  var out = resolveStyle([THEME, { id: 'widget', style: { text: { color: '#f00' } } }]);
  assert.strictEqual(out['text.color'].value, '#f00');
  assert.strictEqual(out['text.color'].source, 'widget');
});

test('properties the later layer does not set survive from below', function() {
  var out = resolveStyle([THEME, { id: 'widget', style: { text: { color: '#f00' } } }]);
  assert.strictEqual(out['text.fontWeight'].value, '400');
  assert.strictEqual(out['fill.background'].value, '#fff');
});

test('null and empty do not overwrite a real value below', function() {
  var out = resolveStyle([THEME, { id: 'widget', style: { text: { color: null } } }]);
  assert.strictEqual(out['text.color'].value, '#111');
});

test('the winning layer is reported, so a panel can show its source', function() {
  var out = resolveStyle([THEME, { id: 'column', style: { fill: { background: '#eee' } } }]);
  assert.strictEqual(out['fill.background'].source, 'column');
  assert.strictEqual(out['text.color'].source, 'theme');
});

console.log('\nresolveStyle — timestamp as tiebreak');

// A cell, row and column override all land on the same cell. They share a
// rank, so recency decides — but only property by property.
var COLUMN = { id: 'column', rank: 3, at: 200, style: { fill: { background: '#eee' } } };
var CELL_OLD = { id: 'cell', rank: 3, at: 100, style: { fill: { background: '#0f0' } } };
var CELL_NEW = { id: 'cell', rank: 3, at: 300, style: { fill: { background: '#00f' } } };

test('at the same rank, the most recent edit wins', function() {
  var out = resolveStyle([THEME, CELL_OLD, COLUMN]);
  assert.strictEqual(out['fill.background'].value, '#eee');
});

test('...regardless of array order', function() {
  var out = resolveStyle([THEME, COLUMN, CELL_NEW]);
  assert.strictEqual(out['fill.background'].value, '#00f');
  var reversed = resolveStyle([THEME, CELL_NEW, COLUMN]);
  assert.strictEqual(reversed['fill.background'].value, '#00f');
});

test('the tiebreak is PER PROPERTY — a column restyle does not wipe cell work', function() {
  // The case the whole rule exists for: someone styles a cell's font, then
  // later changes the column's background. Both must survive.
  var cellFont = { id: 'cell', rank: 3, at: 100, style: { text: { fontWeight: '700' } } };
  var columnBg = { id: 'column', rank: 3, at: 500, style: { fill: { background: '#eee' } } };
  var out = resolveStyle([THEME, cellFont, columnBg]);
  assert.strictEqual(out['text.fontWeight'].value, '700', 'the cell font was wiped');
  assert.strictEqual(out['fill.background'].value, '#eee');
});

test('rank always beats recency — an override wins over an older-ranked theme', function() {
  var lateTheme = { id: 'theme', rank: 0, at: 9999, style: { fill: { background: '#fff' } } };
  var override = { id: 'column', rank: 3, at: 1, style: { fill: { background: '#eee' } } };
  var out = resolveStyle([lateTheme, override]);
  assert.strictEqual(out['fill.background'].value, '#eee');
});

test('an untimestamped layer loses to a timestamped one at the same rank', function() {
  var out = resolveStyle([
    { id: 'a', rank: 3, style: { fill: { background: '#aaa' } } },
    { id: 'b', rank: 3, at: 5, style: { fill: { background: '#bbb' } } }
  ]);
  assert.strictEqual(out['fill.background'].value, '#bbb');
});

console.log('\nresolveStyle — border across layers');

test('a column border.all overrides a theme per-side border', function() {
  // The reason 'all' is expanded before merging rather than after: otherwise
  // the theme's thick top edge would survive the column being set to thin.
  var theme = { id: 'theme', style: { border: { top: { width: 3 } } } };
  var column = { id: 'column', style: { border: { all: { width: 1 } } } };
  var out = resolveStyle([theme, column]);
  assert.strictEqual(out['border.top.width'].value, 1);
});

test('a per-side override refines a theme "all" without discarding it', function() {
  var theme = { id: 'theme', style: { border: { all: { width: 1, style: 'solid', color: '#ccc' } } } };
  var column = { id: 'column', style: { border: { top: { width: 3 } } } };
  var out = resolveStyle([theme, column]);
  assert.strictEqual(out['border.top.width'].value, 3);
  assert.strictEqual(out['border.top.color'].value, '#ccc');
  assert.strictEqual(out['border.bottom.width'].value, 1);
});

test('a column setting one edge does not wipe a cell setting another', function() {
  var cell = { id: 'cell', rank: 3, at: 100, style: { border: { top: { width: 4 } } } };
  var column = { id: 'column', rank: 3, at: 500, style: { border: { bottom: { color: '#f00' } } } };
  var out = resolveStyle([cell, column]);
  assert.strictEqual(out['border.top.width'].value, 4);
  assert.strictEqual(out['border.bottom.color'].value, '#f00');
});

console.log('\ntoCssProperties');

test('paths map to their CSS properties', function() {
  var css = toCssProperties({ 'text.color': '#111', 'fill.background': '#fff' });
  assert.strictEqual(css.color, '#111');
  assert.strictEqual(css.background, '#fff');
});

test('lengths are emitted with units', function() {
  var css = toCssProperties({ 'text.fontSize': { value: 11, unit: 'px' }, 'box.padding.left': 4 });
  assert.strictEqual(css.fontSize, '11px');
  assert.strictEqual(css.paddingLeft, '4px');
});

test('a border width with no style defaults to solid, or it renders nothing', function() {
  var css = toCssProperties({ 'border.top.width': 3 });
  assert.strictEqual(css.borderTopWidth, '3px');
  assert.strictEqual(css.borderTopStyle, 'solid');
});

test('an explicit border style is not overwritten', function() {
  var css = toCssProperties({ 'border.top.width': 3, 'border.top.style': 'dashed' });
  assert.strictEqual(css.borderTopStyle, 'dashed');
});

test('no width means no invented style', function() {
  var css = toCssProperties({ 'text.color': '#111' });
  assert.strictEqual(css.borderTopStyle, undefined);
});

test('border.all is never emitted', function() {
  var css = toCssProperties({ 'border.all.width': 2 });
  assert.deepStrictEqual(css, {});
});

test('unknown paths are ignored rather than emitted as junk CSS', function() {
  var css = toCssProperties({ 'text.nonsense': 'x', 'position': 'absolute' });
  assert.deepStrictEqual(css, {});
});

test('it accepts resolveStyle output directly', function() {
  var css = toCssProperties(resolveStyle([{ id: 'a', style: { text: { color: '#111' } } }]));
  assert.strictEqual(css.color, '#111');
});

console.log('\nresolveCellCss — end to end');

test('theme plus a column override produces one CSS object', function() {
  var css = resolveCellCss([
    { id: 'theme', style: { text: { color: '#111', fontSize: { value: 11, unit: 'px' } }, border: { all: { width: 1, color: '#ddd' } } } },
    { id: 'column', rank: 3, at: 10, style: { fill: { background: '#f6f6f6' }, border: { bottom: { width: { value: 2, unit: 'px' }, color: '#333' } } } }
  ]);
  assert.strictEqual(css.color, '#111');
  assert.strictEqual(css.fontSize, '11px');
  assert.strictEqual(css.background, '#f6f6f6');
  assert.strictEqual(css.borderTopWidth, '1px');
  assert.strictEqual(css.borderBottomWidth, '2px');
  assert.strictEqual(css.borderBottomColor, '#333');
  assert.strictEqual(css.borderBottomStyle, 'solid');
});

test('no layers is an empty object, not a crash', function() {
  assert.deepStrictEqual(resolveCellCss([]), {});
  assert.deepStrictEqual(resolveCellCss(null), {});
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
