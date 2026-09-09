/**
 * Content-based column widths — the pure half.
 *
 * No React, no DOM: this module takes measured text widths in and gives
 * assigned pixel widths out, so the decision it makes is testable without a
 * browser. The DOM side (reading fonts, running canvas measureText, watching
 * the container resize) lives in useColumnWidths.js.
 *
 * THE RULE, in one line: a column never gets less than it needs while some
 * other part of the table is sitting on empty space.
 *
 * Concretely, given a container and a set of columns:
 *
 *   1. Everything fits  -> every column gets its natural width, and whatever
 *      is left over stays empty. That leftover is the "blank column".
 *   2. It doesn't fit   -> there is NO blank column. Every column drops to its
 *      floor (the widest single word it must show without breaking mid-word),
 *      then the remaining space is handed back in proportion to how much each
 *      column actually wanted. A column that never wanted more than its floor
 *      -- a number under 100, say -- takes none of it, so all the slack goes
 *      to the column that needs it. Columns that end up short of natural wrap.
 *   3. Not even the floors fit -> everyone gets their floor and the table
 *      scrolls horizontally.
 *
 * That ordering is what makes case 2 defensible: you can never see a narrow,
 * wrapped column sitting next to blank space, because blank space only exists
 * once every column is already satisfied.
 *
 * Every column comes back with a `reason`, so "why is this column this wide?"
 * has an actual answer rather than a shrug.
 */

/** Column got exactly what its content asked for. */
export var WIDTH_NATURAL = 'natural';
/** Column was squeezed below its natural width; its text wraps. */
export var WIDTH_SHRUNK = 'shrunk';
/** Column is at its floor and the table overflows; horizontal scroll. */
export var WIDTH_FLOOR = 'floor';
/** Column was given an explicit width by the caller; nothing was measured. */
export var WIDTH_PINNED = 'pinned';

/**
 * A caller-supplied width for one column, BY POSITION, in PX.
 *
 * Px here even though the public API takes a percentage: this file returns
 * pixel widths, so converting once at the boundary (useColumnWidths, which is
 * the only place that knows the container) keeps every number below in one
 * unit. A percentage this deep would mean two units in the same arithmetic.
 *
 * Positional on purpose, and it is worth saying why, because a key looks like
 * the safer choice and is not.
 *
 * A pivot's columns ARE data: they are the distinct values of the pivot
 * column, so today's `Q3 · Sum` is next quarter's `Q4 · Sum`. Key a width to
 * that and it is lost on an ordinary refresh — nobody edited anything, the
 * layout simply forgot. Position survives that, and only breaks when somebody
 * deliberately restructures the report, where losing a width is a reasonable
 * consequence of a deliberate act.
 *
 * Which is the real point: a width here belongs to the SLOT, not to whatever
 * value lands in it. "The third column has to be wide" is a positional
 * statement.
 *
 * Non-positive and non-finite entries are ignored rather than clamped — they
 * mean the caller has a bug, and inventing a width would hide it.
 */
/**
 * { index: percent } -> { index: px }, against the width the columns divide.
 *
 * Lives here rather than in the hook so the conversion is testable without a
 * browser, like every other decision in this file. The hook's only job is
 * knowing what `available` is.
 *
 * `available` is the container MINUS the structural columns (expand arrow,
 * checkbox, row actions), which is what makes 100 mean "all the room the
 * columns actually have": two columns at 50 fill the table exactly whether or
 * not there is a checkbox column in front of them. Against the raw container
 * they would overflow by its width — not something anyone typing a percentage
 * is thinking about.
 *
 * Junk is dropped rather than coerced, so a caller's bug stays visible as an
 * unpinned (measured) column rather than as a silently invented width.
 */
export function resolvePercentWidths(overrides, available) {
  if (!overrides || !(available > 0)) return null;
  var out = {};
  Object.keys(overrides).forEach(function(index) {
    var percent = overrides[index];
    if (typeof percent !== 'number' || !isFinite(percent) || percent <= 0) return;
    out[index] = Math.round((percent / 100) * available);
  });
  return out;
}

function pinnedWidth(overrides, index) {
  if (!overrides) return null;
  var width = overrides[index];
  if (typeof width !== 'number' || !isFinite(width) || width <= 0) return null;
  return Math.ceil(width);
}

/**
 * The longest run of characters with no break opportunity in it.
 *
 * This is a column's floor: text can wrap at spaces for free, so a column
 * only *has* to be as wide as its widest single word. "New York City" can live
 * in the width of "York"; a 60-character URL cannot be narrowed at all, which
 * is why the caller caps this (see maxFloor).
 */
export function longestToken(text) {
  if (!text) return '';
  var parts = String(text).split(/\s+/);
  var longest = '';
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].length > longest.length) longest = parts[i];
  }
  return longest;
}

function clamp(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

/**
 * Turn text into per-column width demands.
 *
 * Deliberately takes `measure` as an argument rather than reaching for a
 * canvas itself — that keeps this file pure, and lets tests substitute a
 * monospace measurer whose numbers can be reasoned about by hand.
 *
 * @param {object} opts
 * @param {Array<object>} opts.columns    - Column descriptors (opaque here)
 * @param {Array<object>} opts.rows       - Sample rows to measure
 * @param {Function} opts.textOf          - (row, column) => displayed string.
 *   MUST return what the user actually sees: '₹36,260.80' is far wider than
 *   36260.8, so measuring the raw value would size currency columns wrong.
 * @param {Function} opts.headerOf        - (column) => header string
 * @param {Function} opts.keyOf           - (column) => stable key
 * @param {Function} opts.measure         - (text, font) => px
 * @param {string} opts.bodyFont          - CSS font shorthand for cells
 * @param {string} opts.headerFont        - CSS font shorthand for headers
 * @param {number} opts.cellPadding       - Horizontal chrome around cell text
 * @param {number} opts.headerPadding     - Horizontal chrome around header text
 * @param {number} opts.minWidth          - No column is ever narrower than this
 * @param {number} opts.maxWidth          - Caps natural, so one essay column
 *   can't demand 4000px and push everything else off screen
 * @param {number} opts.maxFloor          - Caps the floor, so a single
 *   unbreakable 200-char token can't force horizontal scroll on its own; past
 *   this the browser breaks mid-word (overflow-wrap: anywhere)
 * @param {object} [opts.overrides]       - { columnIndex: px } — explicit
 *   widths. These columns are NOT measured, and NOT clamped to min/max: an
 *   instruction outranks a guess, including the guess about what a sensible
 *   minimum is.
 * @returns {Array<{key, natural, floor, pinned?}>}
 */
export function measureColumnDemand(opts) {
  var columns = opts.columns || [];
  var rows = opts.rows || [];
  var measure = opts.measure;
  var cellPad = opts.cellPadding || 0;
  var headPad = opts.headerPadding || 0;
  var minWidth = opts.minWidth || 0;
  var maxWidth = opts.maxWidth || Infinity;
  var maxFloor = opts.maxFloor || maxWidth;

  return columns.map(function(column, index) {
    // PINNED COLUMNS ARE NEVER MEASURED. Not measured-then-overridden: the
    // measuring is the expensive part (every sampled row, twice, through the
    // caller's formatter), and its answer would be discarded. natural ===
    // floor is what tells the allocator this column does not negotiate.
    var pinned = pinnedWidth(opts.overrides, index);
    if (pinned !== null) {
      return { key: opts.keyOf(column), natural: pinned, floor: pinned, pinned: true };
    }

    var header = opts.headerOf(column) || '';
    var natural = measure(header, opts.headerFont) + headPad;
    var floor = measure(longestToken(header), opts.headerFont) + headPad;

    for (var i = 0; i < rows.length; i++) {
      var text = opts.textOf(rows[i], column);
      if (text === null || text === undefined || text === '') continue;
      text = String(text);
      var full = measure(text, opts.bodyFont) + cellPad;
      if (full > natural) natural = full;
      // Skip the second measure when the text is a single word — then the
      // longest token IS the whole string and we already have its width.
      var token = longestToken(text);
      var tokenWidth = token.length === text.length ? full : measure(token, opts.bodyFont) + cellPad;
      if (tokenWidth > floor) floor = tokenWidth;
    }

    natural = clamp(Math.ceil(natural), minWidth, maxWidth);
    // The floor can never exceed natural — a column asking for less room than
    // its own minimum is nonsense, and would break the surplus maths below.
    floor = clamp(Math.ceil(floor), minWidth, Math.min(maxFloor, natural));

    return { key: opts.keyOf(column), natural: natural, floor: floor };
  });
}

/**
 * Hand out the container's width.
 *
 * @param {Array<{key, natural, floor, pinned}>} demands - `pinned` columns are
 *   held at their width and excluded from the negotiation entirely.
 * @param {number} containerWidth - Available px. 0/undefined means "unknown",
 *   which is treated as unlimited: everyone gets natural and nothing is blank.
 * @returns {{widths: number[], tableWidth: number, blankWidth: number,
 *            overflow: boolean, decisions: Array<{key, natural, floor, width, reason}>}}
 */
export function allocateColumnWidths(demands, containerWidth) {
  demands = demands || [];
  if (!demands.length) {
    return { widths: [], tableWidth: 0, blankWidth: Math.max(0, containerWidth || 0), overflow: false, decisions: [] };
  }

  // ── Pinned columns come out of the negotiation entirely ──
  //
  // A pinned width is an instruction, so it must not be shrunk in case 2 or
  // dropped to a floor in case 3. Taking them out FIRST and running the
  // existing three cases over what remains is what keeps that true without
  // threading a special case through the surplus maths — the allocator below
  // simply never sees them.
  var pinnedTotal = 0;
  var free = [];
  var freeIndex = [];
  for (var p = 0; p < demands.length; p++) {
    if (demands[p].pinned) { pinnedTotal += demands[p].natural; continue; }
    free.push(demands[p]);
    freeIndex.push(p);
  }

  if (pinnedTotal > 0) {
    var known = containerWidth > 0;
    var remaining = known ? containerWidth - pinnedTotal : containerWidth;

    // THE TRAP THIS AVOIDS: `remaining` can now go to zero or negative, and
    // 0 is already this function's word for "container unknown, treat as
    // unlimited". Falling through would hand every free column its natural
    // width — the widest possible table — at exactly the moment there is no
    // room at all. So it is answered here instead of reaching that branch.
    if (known && remaining <= 0) {
      var floored = demands.map(function(d) { return d.pinned ? d.natural : d.floor; });
      return finish(demands, floored, containerWidth, true);
    }

    var inner = allocateColumnWidths(free, remaining);
    var merged = new Array(demands.length);
    for (var m = 0; m < demands.length; m++) if (demands[m].pinned) merged[m] = demands[m].natural;
    for (var f = 0; f < freeIndex.length; f++) merged[freeIndex[f]] = inner.widths[f];
    return finish(demands, merged, containerWidth, inner.overflow);
  }

  var naturalTotal = 0;
  var floorTotal = 0;
  for (var i = 0; i < demands.length; i++) {
    naturalTotal += demands[i].natural;
    floorTotal += demands[i].floor;
  }

  var widths;
  var overflow = false;

  if (!containerWidth || containerWidth <= 0 || naturalTotal <= containerWidth) {
    // Case 1 — everything fits. This is the ONLY branch that leaves blank space.
    widths = demands.map(function(d) { return d.natural; });
  } else if (floorTotal >= containerWidth) {
    // Case 3 — not even the floors fit. Scroll rather than break words.
    widths = demands.map(function(d) { return d.floor; });
    overflow = true;
  } else {
    // Case 2 — squeeze. Start everyone at their floor, then redistribute the
    // surplus in proportion to unmet demand, so a column that only ever wanted
    // 46px keeps 46px and the wide column absorbs all the slack.
    var surplus = containerWidth - floorTotal;
    var demandTotal = naturalTotal - floorTotal; // > surplus > 0 in this branch
    var used = 0;
    widths = demands.map(function(d) {
      var width = Math.floor(d.floor + ((d.natural - d.floor) / demandTotal) * surplus);
      if (width > d.natural) width = d.natural; // float-rounding guard
      used += width;
      return width;
    });
    // Flooring each share loses a few px; give them to the hungriest column
    // so the table lands exactly on the container edge rather than a pixel shy.
    var remainder = containerWidth - used;
    if (remainder > 0) {
      var hungriest = 0;
      for (var j = 1; j < demands.length; j++) {
        if (demands[j].natural - widths[j] > demands[hungriest].natural - widths[hungriest]) hungriest = j;
      }
      widths[hungriest] += remainder;
      if (widths[hungriest] > demands[hungriest].natural) widths[hungriest] = demands[hungriest].natural;
    }
  }

  return finish(demands, widths, containerWidth, overflow);
}

/**
 * The shared tail: totals, blank space, and a `reason` per column.
 *
 * One place, so the pinned path and the negotiated path cannot disagree about
 * what a decision record looks like.
 */
function finish(demands, widths, containerWidth, overflow) {
  var tableWidth = 0;
  for (var k = 0; k < widths.length; k++) tableWidth += widths[k];

  var decisions = demands.map(function(d, idx) {
    var width = widths[idx];
    var reason = WIDTH_NATURAL;
    // Checked FIRST: a pinned column has natural === floor, so every test
    // below would read it as "got what it asked for" and report `natural`.
    // True, but it hides the one thing worth knowing — that this width was
    // given, not measured, and is the caller's to change.
    if (d.pinned) reason = WIDTH_PINNED;
    else if (overflow && width <= d.floor && d.floor < d.natural) reason = WIDTH_FLOOR;
    else if (width < d.natural) reason = WIDTH_SHRUNK;
    return { key: d.key, natural: d.natural, floor: d.floor, width: width, reason: reason };
  });

  return {
    widths: widths,
    tableWidth: tableWidth,
    blankWidth: containerWidth > 0 ? Math.max(0, containerWidth - tableWidth) : 0,
    overflow: overflow,
    decisions: decisions
  };
}
