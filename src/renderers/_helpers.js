export function initials(name) {
  if (!name) return '·';
  var parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map(function(p) { return p.charAt(0).toUpperCase(); }).join('');
}

// Stable color per name — used by avatar tints.
var PALETTE = [
  ['#d4af37', '#8a6f1f'],
  ['#5b8def', '#2d4f99'],
  ['#4ade80', '#1d7a3f'],
  ['#ef5b5b', '#a02020'],
  ['#a78bfa', '#5e3fa3'],
  ['#f97316', '#a23f0a'],
  ['#22d3ee', '#0d6e80'],
  ['#fb7185', '#9b1c33']
];

export function avatarTint(seed) {
  var s = String(seed || '');
  var hash = 0;
  for (var i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  var pair = PALETTE[Math.abs(hash) % PALETTE.length];
  return 'linear-gradient(135deg, ' + pair[0] + ' 0%, ' + pair[1] + ' 100%)';
}

var CURRENCY_SYMBOLS = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ'
};

export function currencySymbol(code) {
  return CURRENCY_SYMBOLS[code] || code || '';
}

export function formatNumber(value, decimals) {
  if (value === null || value === undefined || value === '') return '';
  var n = Number(value);
  if (!isFinite(n)) return '';
  if (typeof decimals === 'number') {
    return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  return n.toLocaleString();
}
