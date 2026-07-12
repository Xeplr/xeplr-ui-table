/**
 * config: { format?: 'date'|'datetime'|'relative' }
 */
function pad(n) { return n < 10 ? '0' + n : '' + n; }
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(d) {
  return pad(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

function fmtDateTime(d) {
  return fmtDate(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function fmtRelative(d, now) {
  var diff = (now - d) / 1000;
  var abs = Math.abs(diff);
  if (abs < 60) return 'just now';
  if (abs < 3600) return Math.round(abs / 60) + 'm ' + (diff > 0 ? 'ago' : 'from now');
  if (abs < 86400) return Math.round(abs / 3600) + 'h ' + (diff > 0 ? 'ago' : 'from now');
  if (abs < 86400 * 30) return Math.round(abs / 86400) + 'd ' + (diff > 0 ? 'ago' : 'from now');
  return fmtDate(d);
}

export default function dateDisplay(config) {
  var format = (config && config.format) || 'date';
  return function cell(ctx) {
    var v = ctx.getValue();
    if (!v) return null;
    var d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return null;
    var out;
    if (format === 'datetime') out = fmtDateTime(d);
    else if (format === 'relative') out = fmtRelative(d, new Date());
    else out = fmtDate(d);
    return <span className="xeplr-r-date">{out}</span>;
  };
}
