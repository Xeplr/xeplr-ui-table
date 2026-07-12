/**
 * config: { map: { [value]: { bg?, color?, label? } }, default?: { bg?, color? } }
 */
export default function statusBadge(config) {
  var map = (config && config.map) || {};
  var fallback = (config && config.default) || { bg: '#232540', color: '#b8bbe0' };
  return function cell(ctx) {
    var v = ctx.getValue();
    if (v === null || v === undefined || v === '') return null;
    var entry = map[v] || fallback;
    var label = entry.label || String(v);
    var style = { background: entry.bg, color: entry.color, borderColor: entry.border || entry.bg };
    return <span className="xeplr-r-badge" style={style}>{label}</span>;
  };
}
