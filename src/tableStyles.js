/**
 * The table's style vocabulary, and the rule for resolving it.
 *
 * This is the "clear interface" the whole styling feature hangs off: one
 * registry naming every style property a table cell can take, and one pure
 * function that decides which layer's value wins. No React, no DOM, no
 * persistence — a host supplies layers (theme defaults, workspace theme,
 * widget theme, per-column/row/cell overrides) and gets back a CSS object.
 *
 * THREE THINGS WORTH KNOWING BEFORE CHANGING ANY OF THIS:
 *
 * 1. Properties are addressed by PATH, not name — 'border.top.width', not
 *    'borderWidth'. Merging happens per leaf path, which is what stops a
 *    column setting border.bottom.color from wiping a cell's border.top.width.
 *
 * 2. `border.all` is expanded into the four sides at FLATTEN time, inside its
 *    own layer. That ordering is load-bearing. If it were expanded after
 *    merging, a theme that set border.top.width would survive a column that
 *    set border.all.width — the user would set the column's border to thin
 *    and watch one edge stay thick.
 *
 * 3. `margin` is deliberately absent. A <td> is not a block box and discards
 *    margin entirely; offering the control would be offering a lie. Margin
 *    belongs to the table as a whole, which a host lays out itself.
 */

var LENGTH_UNITS = ['px', 'em', 'rem'];

var FONT_FAMILY_OPTIONS = [
  ['inherit', 'Inherit'], ['sans-serif', 'Sans'], ['serif', 'Serif'], ['monospace', 'Mono']
];
var FONT_WEIGHT_OPTIONS = [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']];
var BORDER_STYLE_OPTIONS = [
  ['none', 'None'], ['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ['double', 'Double']
];

var TEXT_FIELDS = [
  { key: 'text.color', label: 'Text color', type: 'color', css: 'color' },
  { key: 'text.fontFamily', label: 'Font', type: 'select', css: 'fontFamily', options: FONT_FAMILY_OPTIONS },
  { key: 'text.fontSize', label: 'Size', type: 'length', css: 'fontSize', units: LENGTH_UNITS },
  { key: 'text.fontWeight', label: 'Weight', type: 'select', css: 'fontWeight', options: FONT_WEIGHT_OPTIONS },
  { key: 'text.fontStyle', label: 'Style', type: 'select', css: 'fontStyle', options: [['normal', 'Normal'], ['italic', 'Italic']] },
  { key: 'text.textAlign', label: 'Align', type: 'select', css: 'textAlign', options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right'], ['justify', 'Justify']] },
  { key: 'text.verticalAlign', label: 'Vertical', type: 'select', css: 'verticalAlign', options: [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']] },
  { key: 'text.textTransform', label: 'Case', type: 'select', css: 'textTransform', options: [['none', 'None'], ['uppercase', 'UPPER'], ['lowercase', 'lower'], ['capitalize', 'Capitalize']] },
  { key: 'text.textDecoration', label: 'Decoration', type: 'select', css: 'textDecoration', options: [['none', 'None'], ['underline', 'Underline'], ['line-through', 'Strikethrough']] },
  { key: 'text.lineHeight', label: 'Line height', type: 'number', css: 'lineHeight', min: 0.8, max: 3, step: 0.1 },
  { key: 'text.letterSpacing', label: 'Letter spacing', type: 'length', css: 'letterSpacing', units: LENGTH_UNITS },
  // Wrapping is a style choice a report designer genuinely makes per column —
  // a code column reads better on one line even if it clips.
  { key: 'text.whiteSpace', label: 'Wrapping', type: 'select', css: 'whiteSpace', options: [['normal', 'Wrap'], ['nowrap', 'No wrap'], ['pre-wrap', 'Preserve']] }
];

var FILL_FIELDS = [
  { key: 'fill.background', label: 'Background', type: 'color', css: 'background' }
];

var BOX_FIELDS = [
  { key: 'box.padding.top', label: 'Padding top', type: 'length', css: 'paddingTop', units: LENGTH_UNITS },
  { key: 'box.padding.right', label: 'Padding right', type: 'length', css: 'paddingRight', units: LENGTH_UNITS },
  { key: 'box.padding.bottom', label: 'Padding bottom', type: 'length', css: 'paddingBottom', units: LENGTH_UNITS },
  { key: 'box.padding.left', label: 'Padding left', type: 'length', css: 'paddingLeft', units: LENGTH_UNITS },
  { key: 'box.height', label: 'Height', type: 'length', css: 'height', units: LENGTH_UNITS }
];

/** 'all' is a shorthand the user edits; it never reaches CSS (see note 2). */
export var BORDER_SIDES = ['top', 'right', 'bottom', 'left'];

function borderFieldsFor(side) {
  var prefix = 'border.' + side + '.';
  var cap = side === 'all' ? null : side.charAt(0).toUpperCase() + side.slice(1);
  return [
    { key: prefix + 'width', label: 'Width', type: 'length', units: LENGTH_UNITS, css: cap && 'border' + cap + 'Width', side: side },
    { key: prefix + 'style', label: 'Style', type: 'select', options: BORDER_STYLE_OPTIONS, css: cap && 'border' + cap + 'Style', side: side },
    { key: prefix + 'color', label: 'Color', type: 'color', css: cap && 'border' + cap + 'Color', side: side }
  ];
}

var BORDER_FIELDS = [{ key: 'border.radius', label: 'Radius', type: 'length', css: 'borderRadius', units: LENGTH_UNITS }]
  .concat(borderFieldsFor('all'))
  .concat(BORDER_SIDES.reduce(function(acc, side) { return acc.concat(borderFieldsFor(side)); }, []));

/**
 * The whole vocabulary, grouped for panel generation. A host builds its panel
 * from this and nothing else — adding a stylable property means adding one
 * entry here, and it appears everywhere with no other change.
 */
export var STYLE_GROUPS = [
  { key: 'text', label: 'Text', fields: TEXT_FIELDS },
  { key: 'fill', label: 'Fill', fields: FILL_FIELDS },
  { key: 'box', label: 'Spacing & size', fields: BOX_FIELDS },
  // Sides are collapsed behind an expander in the UI: 'all' by default, with
  // each side openable to override just that edge.
  { key: 'border', label: 'Border', fields: BORDER_FIELDS, expandable: BORDER_SIDES }
];

export var STYLE_FIELDS = STYLE_GROUPS.reduce(function(acc, g) { return acc.concat(g.fields); }, []);

var FIELD_BY_PATH = {};
STYLE_FIELDS.forEach(function(f) { FIELD_BY_PATH[f.key] = f; });

export function styleField(path) { return FIELD_BY_PATH[path] || null; }

// ── Values ────────────────────────────────────────────────────────────────

/**
 * A length is stored as { value, unit } so the unit survives a round trip and
 * the panel can show it. Bare numbers mean px; strings pass through untouched
 * (so a host can store 'auto' or a var() reference).
 */
export function cssLength(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value + 'px';
  if (typeof value === 'string') return value;
  if (typeof value.value !== 'number' && !value.value) return null;
  return value.value + (value.unit || 'px');
}

// ── Flatten ───────────────────────────────────────────────────────────────

function walk(node, prefix, out) {
  Object.keys(node).forEach(function(key) {
    var value = node[key];
    var path = prefix ? prefix + '.' + key : key;
    // A {value, unit} pair is a leaf, not a branch to descend into.
    var isLeaf = value === null || typeof value !== 'object' ||
      Object.prototype.hasOwnProperty.call(value, 'value');
    if (isLeaf) out[path] = value;
    else walk(value, path, out);
  });
}

/**
 * Nested style object -> flat { path: value }, with border.all expanded into
 * the four sides. An explicit side inside the SAME object beats 'all'; see
 * note 2 at the top for why that expansion has to happen here.
 */
export function flattenStyle(style) {
  var flat = {};
  if (!style) return flat;
  walk(style, '', flat);

  ['width', 'style', 'color'].forEach(function(part) {
    var all = flat['border.all.' + part];
    if (all === undefined) return;
    BORDER_SIDES.forEach(function(side) {
      var path = 'border.' + side + '.' + part;
      if (flat[path] === undefined) flat[path] = all;
    });
  });
  delete flat['border.all.width'];
  delete flat['border.all.style'];
  delete flat['border.all.color'];
  return flat;
}

// ── Resolve ───────────────────────────────────────────────────────────────

/**
 * Decide, per property, which layer wins.
 *
 * @param {Array<{id, style, rank?, at?}>} layers - Low precedence first.
 *   `rank` defaults to array position. Layers that genuinely compete — a cell,
 *   row and column override all landing on the same cell — share one rank and
 *   are separated by `at` (a timestamp), so the most recent edit wins.
 *
 *   The timestamp is a TIEBREAK, not a winner-takes-all: it is consulted per
 *   property. A column setting a background and a cell setting a font weight
 *   both apply, whichever was edited last. Only when both set the SAME
 *   property does recency decide. Whole-record precedence would mean
 *   restyling a column silently discarded deliberate per-cell work.
 *
 * @returns {object} { path: { value, source, at } }
 */
export function resolveStyle(layers) {
  var resolved = {};
  (layers || []).forEach(function(layer, index) {
    if (!layer || !layer.style) return;
    var rank = layer.rank === undefined ? index : layer.rank;
    var at = layer.at === undefined ? null : layer.at;
    var flat = flattenStyle(layer.style);

    Object.keys(flat).forEach(function(path) {
      var value = flat[path];
      if (value === null || value === undefined || value === '') return;
      var held = resolved[path];
      if (held) {
        if (rank < held.rank) return;
        if (rank === held.rank && at !== null && held.at !== null && at < held.at) return;
        if (rank === held.rank && at === null && held.at !== null) return;
      }
      resolved[path] = { value: value, source: layer.id, at: at, rank: rank };
    });
  });
  return resolved;
}

// ── Emit ──────────────────────────────────────────────────────────────────

/**
 * Resolved paths -> a React style object.
 *
 * Accepts either the output of resolveStyle or a plain { path: value } map,
 * so a caller with a single style object can skip resolution entirely.
 */
export function toCssProperties(resolved) {
  var css = {};
  if (!resolved) return css;

  Object.keys(resolved).forEach(function(path) {
    var field = FIELD_BY_PATH[path];
    if (!field || !field.css) return; // unknown path, or border.all — never emitted
    var entry = resolved[path];
    var value = entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, 'source')
      ? entry.value : entry;
    if (value === null || value === undefined || value === '') return;
    css[field.css] = field.type === 'length' ? cssLength(value) : value;
  });

  // A border width with no style renders nothing at all — CSS defaults
  // border-style to none. Someone setting "3px" and seeing no border would
  // reasonably call that broken, so an unstated style means solid.
  BORDER_SIDES.forEach(function(side) {
    var cap = side.charAt(0).toUpperCase() + side.slice(1);
    if (css['border' + cap + 'Width'] && !css['border' + cap + 'Style']) {
      css['border' + cap + 'Style'] = 'solid';
    }
  });

  return css;
}

/** The common case: layers in, CSS out. */
export function resolveCellCss(layers) {
  return toCssProperties(resolveStyle(layers));
}
