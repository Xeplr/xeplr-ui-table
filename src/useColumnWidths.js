import { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { measureColumnDemand, allocateColumnWidths, resolvePercentWidths } from './columnWidths.js';

/**
 * Content-based column widths — the DOM half. See columnWidths.js for the
 * allocation rule itself; this file only supplies it with real numbers.
 *
 * "Use the font scale" is handled by measuring rather than configuring: the
 * font is read off an actual rendered <td>/<th>, so if a host shrinks the type
 * (a compact theme, say) every column narrows to match with no width setting
 * anywhere. The same goes for cell padding — it's read from the DOM, not
 * duplicated as a constant that would drift the first time the CSS changes.
 */

// Sentinel handed to the pure measurer in place of a font string, meaning
// "whichever of the body's fonts renders this widest" — see measureWidest.
var BODY_FONTS = '@@body-fonts@@';
var MAX_BODY_FONTS = 3;

var DEFAULTS = {
  sampleRows: 200,
  minWidth: 40,
  maxWidth: 420,
  maxFloor: 220
};

// Canvas measureText is exact for proportional fonts and costs microseconds.
// One canvas is shared across every table on the page; it's never attached to
// the document, so it holds a single backing store regardless of table count.
var sharedCanvas = null;
function textMeasurer() {
  if (typeof document === 'undefined') return null;
  if (!sharedCanvas) sharedCanvas = document.createElement('canvas');
  var ctx = sharedCanvas.getContext('2d');
  if (!ctx) return null;
  var cache = new Map();
  return function measure(text, font) {
    if (!text) return 0;
    var cacheKey = font + '' + text;
    var hit = cache.get(cacheKey);
    if (hit !== undefined) return hit;
    ctx.font = font;
    var width = ctx.measureText(text).width;
    cache.set(cacheKey, width);
    return width;
  };
}

function fontOf(style) {
  return (style.fontStyle && style.fontStyle !== 'normal' ? style.fontStyle + ' ' : '') +
    (style.fontWeight || 400) + ' ' +
    (style.fontSize || '14px') + ' ' +
    (style.fontFamily || 'sans-serif');
}

/**
 * Hosts routinely rebuild their column array inline on every render, so the
 * effect below cannot use array identity to decide whether to re-measure —
 * it would re-measure forever. This is the real question: has anything that
 * could change a width changed?
 *
 * Cell FORMATTING is deliberately not part of this (the host's columnText is
 * usually a fresh closure each render too). Hosts signal that with sizingKey.
 */
function signatureOf(columns, containerWidth, sizingKey, overrides) {
  var parts = [containerWidth, columns.length];
  for (var i = 0; i < columns.length; i++) {
    parts.push(columns[i].accessor, columns[i].header || '');
  }
  parts.push(typeof sizingKey === 'object' ? JSON.stringify(sizingKey) : String(sizingKey));
  // Overrides MUST be in here. They change widths, and this signature is the
  // only thing deciding whether the effect below does anything at all — leave
  // them out and setting a width is a no-op with no error and no clue.
  // Stringified rather than identity-compared because a host will rebuild the
  // object inline, exactly as it does the column array.
  parts.push(overrides ? JSON.stringify(overrides) : '');
  return parts.join('');
}

/** Widths that came out identical must not be published — that's a render loop. */
function sameSizing(a, b) {
  if (!a || !b || a.tableWidth !== b.tableWidth || a.widths.length !== b.widths.length) return false;
  for (var i = 0; i < a.widths.length; i++) {
    if (a.widths[i] !== b.widths[i]) return false;
  }
  return true;
}

function horizontalPadding(el) {
  if (!el) return 0;
  var style = window.getComputedStyle(el);
  return parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0) +
    parseFloat(style.borderLeftWidth || 0) + parseFloat(style.borderRightWidth || 0);
}

/**
 * @param {object} opts
 * @param {boolean} opts.enabled      - Off by default; hosts opt in
 * @param {Array} opts.data           - Rows to sample. The FULL set, not the
 *   current page: widths measured per page would jump every time you paged.
 * @param {Array} opts.columns        - [{ accessor, header, ... }]
 * @param {Function} [opts.columnText] - (row, column) => displayed string.
 *   Defaults to the raw value; hosts that format their cells should pass their
 *   formatter, or currency/date columns get measured as bare numbers.
 * @param {*} [opts.sizingKey]        - Changing this re-measures. For font or
 *   theme changes, which nothing else can observe.
 * @param {object} [opts.columnWidths] - { columnIndex: percent }. Those
 *   columns are held at that share of the available width and never measured;
 *   everything else divides what's left. PERCENT, not px, so a pin keeps its
 *   proportion when the container resizes. BY INDEX, not by key — see
 *   pinnedWidth() in columnWidths.js.
 * @param {Function} [opts.onSizing]  - Called with the full decision record.
 * @returns {{ scrollRef, tableRef, sizing }}
 */
export default function useColumnWidths(opts) {
  var enabled = !!opts.enabled;
  var data = opts.data;
  var columns = opts.columns;
  var sizingKey = opts.sizingKey;
  var onSizing = opts.onSizing;
  var sampleRows = opts.sampleRows || DEFAULTS.sampleRows;
  var overrides = opts.columnWidths;

  var scrollRef = useRef(null);
  var tableRef = useRef(null);
  var lastWidthRef = useRef(0);
  var signatureRef = useRef(null);
  var dataRef = useRef(null);
  var sizingRef = useRef(null);
  var [containerWidth, setContainerWidth] = useState(0);
  var [sizing, setSizing] = useState(null);

  var columnText = opts.columnText;
  var textOf = useCallback(function(row, column) {
    if (columnText) return columnText(row, column);
    var value = row ? row[column.accessor] : null;
    return value === null || value === undefined ? '' : String(value);
  }, [columnText]);

  // ── Track the available width ──
  // clientWidth of the scroll port, deliberately: overflow-x means a horizontal
  // scrollbar eats height, not width, so this number can't oscillate with the
  // scrollbar it produces.
  useLayoutEffect(function() {
    if (!enabled) return undefined;
    var el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;

    function read() {
      var width = el.clientWidth;
      // Sub-pixel churn from zoom/fractional layout would otherwise re-run the
      // whole measure pass on every frame during a window drag.
      if (Math.abs(width - lastWidthRef.current) < 2) return;
      lastWidthRef.current = width;
      setContainerWidth(width);
    }

    read();
    var observer = new ResizeObserver(read);
    observer.observe(el);
    return function() { observer.disconnect(); };
  }, [enabled]);

  // ── Measure and allocate ──
  useLayoutEffect(function() {
    if (!enabled || !containerWidth || !columns || !columns.length) {
      if (sizingRef.current) { sizingRef.current = null; setSizing(null); }
      return;
    }
    var measure = textMeasurer();
    var table = tableRef.current;
    if (!measure || !table) return;

    // Cheap bail-out before the expensive part: measuring 200 rows across
    // every column on a render that changed nothing is pure waste.
    var signature = signatureOf(columns, containerWidth, sizingKey, overrides);
    if (signature === signatureRef.current && data === dataRef.current && sizingRef.current) return;
    signatureRef.current = signature;
    dataRef.current = data;

    // Fonts and padding come from real cells so this stays in step with the
    // stylesheet automatically. Before the first row renders there's no <td>,
    // so the header cell stands in — one pass slightly off, corrected as soon
    // as rows arrive and the effect re-runs.
    var bodyCell = table.querySelector('tbody .xeplr-table-td');
    var headCell = table.querySelector('thead .xeplr-table-header-cell');
    var headerFont = fontOf(window.getComputedStyle(headCell || bodyCell || table));

    // Rows are not guaranteed to share a font. A host that styles a total row
    // bold, or bands alternate rows differently, makes some rows wider than
    // others at the same character count — sizing off row one alone would
    // leave exactly those rows wrapping. So collect the distinct fonts in play
    // and give every column enough width for the widest of them.
    var bodyFonts = [];
    var sampleCells = table.querySelectorAll('tbody tr .xeplr-table-td:first-child');
    for (var s = 0; s < sampleCells.length && bodyFonts.length < MAX_BODY_FONTS; s++) {
      var font = fontOf(window.getComputedStyle(sampleCells[s]));
      if (bodyFonts.indexOf(font) === -1) bodyFonts.push(font);
    }
    if (!bodyFonts.length) bodyFonts.push(headerFont);

    // measureColumnDemand deals in one font per call, which keeps it pure and
    // trivially testable; the multi-font case is resolved here instead.
    var measureWidest = function(text, font) {
      if (font !== BODY_FONTS) return measure(text, font);
      var widest = 0;
      for (var f = 0; f < bodyFonts.length; f++) {
        var width = measure(text, bodyFonts[f]);
        if (width > widest) widest = width;
      }
      return widest;
    };

    // Header chrome: the label shares its row with the sort caret and the
    // filter trigger, so the text needs less room than the cell does.
    var headerPadding = horizontalPadding(headCell);
    var trigger = table.querySelector('thead .xeplr-table-filter-trigger');
    if (trigger) headerPadding += trigger.offsetWidth + 4;
    else headerPadding += 16; // sort caret

    // The table's own structural columns — expand arrow, select checkbox, row
    // actions — aren't content columns and don't compete for space. Their
    // width is reserved off the top, so the content columns divide what's
    // actually left. Read from the DOM because two of them are sized in CSS
    // and the third shrink-wraps whatever buttons the host supplied.
    var extraWidths = {};
    var reserved = 0;
    ['expand', 'checkbox', 'actions'].forEach(function(kind) {
      var el = table.querySelector('thead .xeplr-table-th-' + kind);
      if (!el) return;
      var width = Math.ceil(el.offsetWidth);
      extraWidths[kind] = width;
      reserved += width;
    });

    var rows = data && data.length > sampleRows ? data.slice(0, sampleRows) : (data || []);

    // Percentages resolve against `available` — the container minus the
    // structural columns — so 100 means "all the room the columns have".
    // The conversion itself is pure and lives in columnWidths.js; this is
    // just the only place that knows what `available` is.
    //
    // A percentage is also why this survives a resize: containerWidth is in
    // the signature, so the effect re-runs and a pinned column re-resolves to
    // the right px rather than staying at yesterday's.
    var available = containerWidth - reserved;
    var pxOverrides = resolvePercentWidths(overrides, available);

    var demands = measureColumnDemand({
      columns: columns,
      rows: rows,
      textOf: textOf,
      headerOf: function(column) { return column.header || column.accessor; },
      keyOf: function(column) { return column.accessor; },
      measure: measureWidest,
      bodyFont: BODY_FONTS,
      headerFont: headerFont,
      cellPadding: horizontalPadding(bodyCell) || 25,
      headerPadding: headerPadding,
      minWidth: opts.minColumnWidth || DEFAULTS.minWidth,
      maxWidth: opts.maxColumnWidth || DEFAULTS.maxWidth,
      maxFloor: opts.maxFloorWidth || DEFAULTS.maxFloor,
      overrides: pxOverrides
    });

    var next = allocateColumnWidths(demands, containerWidth - reserved);
    next.extraWidths = extraWidths;
    next.tableWidth += reserved;

    if (sameSizing(next, sizingRef.current)) return;
    sizingRef.current = next;
    setSizing(next);
    if (onSizing) onSizing(next);
    // State is tracked through refs above, so it is deliberately absent here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, containerWidth, data, columns, textOf, sampleRows, sizingKey, overrides,
      opts.minColumnWidth, opts.maxColumnWidth, opts.maxFloorWidth]);

  return { scrollRef: scrollRef, tableRef: tableRef, sizing: enabled ? sizing : null };
}
