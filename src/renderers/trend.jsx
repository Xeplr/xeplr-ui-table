import { trendLook } from '../trend.js';

/**
 * A number with its direction: ▲ green above zero, ▼ red below (trend.js).
 *
 * config: {
 *   format?: (value, row) => string   how the number reads (a percent, a
 *                                      currency …); default: up to 2 decimals
 *   absolute?: boolean                the arrow says the sign, so the number
 *                                      is shown without it (default true)
 *   color?: (value, row) => string    a rule's colour, which wins
 *   colors?: { up, down }             the defaults' replacement
 * }
 */
export default function trend(config) {
  var c = config || {};
  var absolute = c.absolute !== false;
  return function cell(ctx) {
    var v = ctx.getValue();
    if (v === null || v === undefined || v === '') return null;
    var row = ctx.row && ctx.row.original;
    var n = Number(v);
    var shown = absolute && Number.isFinite(n) ? Math.abs(n) : v;
    var text = c.format ? c.format(shown, row) : (Number.isFinite(Number(shown)) ? Number(shown).toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(shown));
    var look = trendLook(v, c.color ? c.color(v, row) : null, c.colors);
    return (
      <span className="xeplr-r-trend" style={look.color ? { color: look.color } : undefined}>
        {look.arrow && <span className="xeplr-r-trend-arrow" aria-hidden="true">{look.arrow}</span>}
        {text}
      </span>
    );
  };
}
