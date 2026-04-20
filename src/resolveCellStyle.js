/**
 * Resolve conditional formatting for a cell using NLP condition strings.
 *
 * Each rule is { when: "<condition>", ...styleProps }
 * The condition uses xeplr-nlp-parser syntax:
 *   "$.field is active"            "$.field is not active"
 *   "$.field is null"              "$.field is not null"
 *   "$.field > 100"                "$.field >= 90"
 *   "$.field between 50 and 100"   "$.field starts with 'Jo'"
 *   "$.field ends with '.js'"      "$.field contains 'urgent'"
 *   "$.field does not contain 'x'" "$.field in [a, b, c]"
 *
 * The condition is parsed once and cached for performance.
 */

// ── Inline condition parser (ESM-compatible, same syntax as xeplr-nlp-parser) ──

var KEYWORDS = new Set(['if', 'typeof', 'is', 'not', 'in', 'then', 'return', 'and', 'or', 'null', 'starts', 'ends', 'with', 'contains', 'contain', 'does', 'between']);

function tokenize(input) {
  var tokens = [];
  var i = 0;
  while (i < input.length) {
    if (/\s/.test(input[i])) { i++; continue; }
    if (input[i] === '$') {
      var path = '';
      while (i < input.length && /[a-zA-Z0-9_.$]/.test(input[i])) { path += input[i++]; }
      tokens.push({ type: 'PATH', value: path });
      continue;
    }
    if (input[i] === '>' && input[i + 1] === '=') { tokens.push({ type: 'OP', value: '>=' }); i += 2; continue; }
    if (input[i] === '>') { tokens.push({ type: 'OP', value: '>' }); i++; continue; }
    if (input[i] === '<' && input[i + 1] === '=') { tokens.push({ type: 'OP', value: '<=' }); i += 2; continue; }
    if (input[i] === '<') { tokens.push({ type: 'OP', value: '<' }); i++; continue; }
    if (input[i] === '[') {
      i++;
      var content = '';
      while (i < input.length && input[i] !== ']') { content += input[i++]; }
      if (i < input.length) i++;
      tokens.push({ type: 'ARRAY', value: content.split(',').map(function(s) { return s.trim(); }).filter(Boolean) });
      continue;
    }
    if (input[i] === "'" || input[i] === '"') {
      var quote = input[i++];
      var str = '';
      while (i < input.length && input[i] !== quote) { str += input[i++]; }
      if (i < input.length) i++;
      tokens.push({ type: 'STRING', value: str });
      continue;
    }
    if (/[0-9]/.test(input[i]) || (input[i] === '-' && i + 1 < input.length && /[0-9]/.test(input[i + 1]))) {
      var num = '';
      if (input[i] === '-') { num += input[i++]; }
      while (i < input.length && /[0-9.]/.test(input[i])) { num += input[i++]; }
      tokens.push({ type: 'NUMBER', value: Number(num) });
      continue;
    }
    if (/[a-zA-Z_]/.test(input[i])) {
      var word = '';
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) { word += input[i++]; }
      var lower = word.toLowerCase();
      tokens.push({ type: KEYWORDS.has(lower) ? 'KEYWORD' : 'IDENTIFIER', value: KEYWORDS.has(lower) ? lower : word });
      continue;
    }
    i++;
  }
  return tokens;
}

function parseCondition(conditionStr) {
  var tokens = tokenize(conditionStr);
  var pos = 0;
  function peek() { return tokens[pos] || null; }
  function advance() { return tokens[pos++]; }

  var path = peek();
  if (!path || path.type !== 'PATH') throw new Error('Condition must start with a $-path, e.g. "$.field is active"');
  advance();

  var op;
  var opToken = peek();

  if (opToken && opToken.type === 'OP') {
    op = advance().value;
  } else if (opToken && opToken.type === 'KEYWORD' && opToken.value === 'is') {
    advance();
    var negated = false;
    if (peek() && peek().type === 'KEYWORD' && peek().value === 'not') { advance(); negated = true; }
    if (peek() && peek().type === 'KEYWORD' && peek().value === 'null') {
      advance();
      op = negated ? 'is_not_null' : 'is_null';
    } else {
      op = 'is';
      if (negated) op = 'is_not';
    }
  } else if (opToken && opToken.type === 'KEYWORD' && opToken.value === 'not') {
    advance();
    if (peek() && peek().type === 'KEYWORD' && peek().value === 'in') { advance(); op = 'not_in'; }
    else if (peek() && peek().type === 'KEYWORD' && (peek().value === 'contains' || peek().value === 'contain')) { advance(); op = 'not_contains'; }
    else { throw new Error('Expected "in" or "contains" after "not"'); }
  } else if (opToken && opToken.type === 'KEYWORD' && opToken.value === 'in') {
    advance(); op = 'in';
  } else if (opToken && opToken.type === 'KEYWORD' && opToken.value === 'starts') {
    advance(); if (peek() && peek().value === 'with') advance(); op = 'starts_with';
  } else if (opToken && opToken.type === 'KEYWORD' && opToken.value === 'ends') {
    advance(); if (peek() && peek().value === 'with') advance(); op = 'ends_with';
  } else if (opToken && opToken.type === 'KEYWORD' && opToken.value === 'contains') {
    advance(); op = 'contains';
  } else if (opToken && opToken.type === 'KEYWORD' && opToken.value === 'does') {
    advance();
    if (peek() && peek().value === 'not') advance();
    if (peek() && (peek().value === 'contains' || peek().value === 'contain')) advance();
    op = 'not_contains';
  } else if (opToken && opToken.type === 'KEYWORD' && opToken.value === 'between') {
    advance(); op = 'between';
  } else {
    throw new Error('Expected operator after path, got: ' + (opToken ? opToken.value : 'end of input'));
  }

  var rhs = null;
  var rhsTo = null;
  if (op !== 'is_null' && op !== 'is_not_null') {
    var rhsToken = peek();
    if (rhsToken && (rhsToken.type === 'STRING' || rhsToken.type === 'NUMBER' || rhsToken.type === 'IDENTIFIER' || rhsToken.type === 'ARRAY')) {
      rhs = advance().value;
    }
    if (op === 'between' && peek() && peek().type === 'KEYWORD' && peek().value === 'and') {
      advance();
      var toToken = peek();
      if (toToken && (toToken.type === 'NUMBER' || toToken.type === 'STRING' || toToken.type === 'IDENTIFIER')) {
        rhsTo = advance().value;
      }
    }
  }

  return { lhs: path.value, op: op, rhs: rhs, rhsTo: rhsTo };
}

// ── Condition evaluator ──

function toComparable(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string' && !isNaN(val) && val !== '') return Number(val);
  return val;
}

function resolvePath(path, data) {
  var parts = path.replace(/^\$\.?/, '').split('.');
  var current = data;
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    if (current == null) return undefined;
    current = current[parts[i]];
  }
  return current;
}

function evaluateCondition(when, data) {
  var raw = resolvePath(when.lhs, data);
  var value = toComparable(raw);
  var rhs = toComparable(when.rhs);

  switch (when.op) {
    case 'is':           return value === rhs;
    case 'is_not':       return value !== rhs;
    case 'is_null':      return raw == null || raw === '';
    case 'is_not_null':  return raw != null && raw !== '';
    case '>':            return value > rhs;
    case '<':            return value < rhs;
    case '>=':           return value >= rhs;
    case '<=':           return value <= rhs;
    case 'between': {
      var rhsTo = toComparable(when.rhsTo);
      if (rhsTo == null) return value >= rhs;
      return value >= rhs && value <= rhsTo;
    }
    case 'in': {
      var list = Array.isArray(when.rhs) ? when.rhs : [when.rhs];
      return list.some(function(item) { return toComparable(item) === value; });
    }
    case 'not_in': {
      var list2 = Array.isArray(when.rhs) ? when.rhs : [when.rhs];
      return !list2.some(function(item) { return toComparable(item) === value; });
    }
    case 'starts_with':   return raw != null && String(raw).toLowerCase().startsWith(String(when.rhs).toLowerCase());
    case 'ends_with':     return raw != null && String(raw).toLowerCase().endsWith(String(when.rhs).toLowerCase());
    case 'contains':      return raw != null && String(raw).toLowerCase().includes(String(when.rhs).toLowerCase());
    case 'not_contains':  return raw != null && !String(raw).toLowerCase().includes(String(when.rhs).toLowerCase());
    default: return false;
  }
}

// ── Parse cache (avoids re-parsing the same condition string) ──
var parseCache = new Map();

function getCachedCondition(when) {
  var cached = parseCache.get(when);
  if (cached) return cached;
  var parsed = parseCondition(when);
  parseCache.set(when, parsed);
  return parsed;
}

// ── Public API ──

/**
 * Resolve conditional formatting for a cell value.
 *
 * @param {*}              value      - The cell value
 * @param {Array|Function} cellStyle  - Array of { when, ...style } rules, or function(value, row) => style|null
 * @param {string}         accessor   - The column accessor (used to build data context for $)
 * @param {object}         [row]      - The full row object
 * @returns {object|null}  Inline style object or null
 */
export function resolveCellStyle(value, cellStyle, accessor, row) {
  if (!cellStyle) return null;

  // Function form — user handles everything
  if (typeof cellStyle === 'function') {
    return cellStyle(value, row) || null;
  }

  if (!Array.isArray(cellStyle) || cellStyle.length === 0) return null;

  // Build data context: row fields + accessor mapped to current value
  var data = row ? Object.assign({}, row) : {};
  data[accessor] = value;

  for (var i = 0; i < cellStyle.length; i++) {
    var rule = cellStyle[i];
    if (!rule.when) continue;

    var condition = getCachedCondition(rule.when);
    if (evaluateCondition(condition, data)) {
      return extractStyle(rule);
    }
  }

  return null;
}

/** Extract style properties from a rule (everything except 'when'). */
function extractStyle(rule) {
  var style = {};
  var keys = Object.keys(rule);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] !== 'when') {
      style[keys[i]] = rule[keys[i]];
    }
  }
  return Object.keys(style).length > 0 ? style : null;
}
