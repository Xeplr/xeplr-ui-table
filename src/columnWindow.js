// COLUMN WINDOWING — which columns of a wide table are worth drawing.
//
// Rows are already bounded: the table pages them. Columns were not: a pivot
// of a date by day over a year is 1,095 columns, and 100 rows of it is over a
// hundred thousand cells, built all at once, which froze the page. Only the
// columns in view (plus a margin) are drawn; one spacer cell on each side
// holds the width of everything left out, so the scrollbar, the scroll
// position and the layout are exactly what the full table would have.
//
// Pure functions — no React, no DOM — so the arithmetic is tested on its own.

/** Above this many leaf columns windowing switches on (with `columnWindowing: 'auto'`). */
export var COLUMN_WINDOW_THRESHOLD = 60;

/** Width of a column the table has not measured (no content sizing). */
export var DEFAULT_WINDOW_COLUMN_WIDTH = 140;

/** Columns drawn beyond each edge of the view, so a scroll never shows a blank. */
export var COLUMN_WINDOW_OVERSCAN = 6;

/**
 * Whether a table with `leafCount` columns draws only its visible ones.
 * @param {number} leafCount
 * @param {'auto'|'on'|'off'} [mode='auto']
 */
export function shouldWindowColumns(leafCount, mode) {
  if (mode === 'off') return false;
  if (mode === 'on') return leafCount > 0;
  return leafCount > COLUMN_WINDOW_THRESHOLD;
}

/**
 * The run of columns to draw.
 *
 * @param {object} o
 * @param {number[]} o.widths        - every leaf column's width, in order (px)
 * @param {number}   o.scrollLeft    - the scroll port's scrollLeft
 * @param {number}   o.viewportWidth - the scroll port's clientWidth
 * @param {number}   [o.leadingWidth=0] - fixed columns before the data ones (expand, checkbox)
 * @param {number}   [o.overscan]    - columns past each edge
 * @returns {{ start: number, end: number, before: number, after: number }}
 *   `end` is exclusive; `before`/`after` are the widths the spacers hold.
 */
export function columnWindow(o) {
  var widths = o.widths || [];
  var n = widths.length;
  if (!n) return { start: 0, end: 0, before: 0, after: 0 };
  var overscan = o.overscan === undefined ? COLUMN_WINDOW_OVERSCAN : o.overscan;
  // Before the first measure there is no viewport yet: draw a screenful at
  // the left rather than nothing.
  var viewport = o.viewportWidth > 0 ? o.viewportWidth : 1600;
  var left = Math.max(0, (o.scrollLeft || 0) - (o.leadingWidth || 0));
  var right = left + viewport;

  var x = 0;
  var first = n - 1;
  var last = n - 1;
  var foundFirst = false;
  for (var i = 0; i < n; i++) {
    var w = widths[i] || 0;
    if (!foundFirst && x + w > left) { first = i; foundFirst = true; }
    if (x >= right) { last = i - 1; break; }
    x += w;
  }
  if (!foundFirst) first = n - 1;
  if (last < first) last = first;

  var start = Math.max(0, first - overscan);
  var end = Math.min(n, last + 1 + overscan);
  var before = 0;
  var after = 0;
  for (var b = 0; b < start; b++) before += widths[b] || 0;
  for (var a = end; a < n; a++) after += widths[a] || 0;
  return { start: start, end: end, before: before, after: after };
}

/**
 * A header row cut to the window: each header that reaches into [start, end)
 * with its colSpan reduced to the part inside. Headers of one row cover the
 * leaf columns contiguously, in order (TanStack pads every row to full width),
 * which is what lets the leaf range of each be found by adding up spans.
 *
 * @param {Array<{ colSpan: number }>} headers
 * @returns {Array<{ header: object, colSpan: number }>}
 */
export function windowHeaders(headers, start, end) {
  var out = [];
  var at = 0;
  for (var i = 0; i < headers.length; i++) {
    var span = headers[i].colSpan || 1;
    var from = Math.max(at, start);
    var to = Math.min(at + span, end);
    if (to > from) out.push({ header: headers[i], colSpan: to - from });
    at += span;
  }
  return out;
}
