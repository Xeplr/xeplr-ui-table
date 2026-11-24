// A NUMBER SHOWN AS A TREND — its own sign says which way it went: ▲ above
// zero, ▼ below. Zero, a blank or something that is not a number has no
// direction, so it gets no arrow and no colour.
//
// The colour: green up, red down — unless the caller's rule coloured the value
// (`ruledColor`), which wins. That is how "green when negative" is said: for a
// refund rate, down is good.
//
// Used by the `trend` cell renderer, and by any host that shows one value as a
// trend (a KPI, a tile) so every trend looks the same.

export var TREND_COLORS = { up: '#1a7f37', down: '#c2372e' };
var ARROWS = { up: '▲', down: '▼' };

function asNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** 'up', 'down', or null when the value has no direction. */
export function trendOf(value) {
  var n = asNumber(value);
  if (n === null || n === 0) return null;
  return n > 0 ? 'up' : 'down';
}

/**
 * What a value shown as a trend looks like: { arrow, color } — the rule's
 * colour when one coloured it, the default for its direction otherwise;
 * { arrow: null, color: ruledColor } when it has no direction.
 */
export function trendLook(value, ruledColor, colors) {
  var dir = trendOf(value);
  var palette = colors || TREND_COLORS;
  if (!dir) return { arrow: null, color: ruledColor || null };
  return { arrow: ARROWS[dir], color: ruledColor || palette[dir] };
}
