/**
 * Shared operator resolver for comparing values.
 * Used by filters, conditional formatting, and any future comparison logic.
 *
 * String operators:  eq, neq, isnull, starts, ends, contains, notcontains
 * Number operators:  eq, neq, isnull, gt, gte, lt, lte, between
 * Date operators:    eq, neq, isnull, gt, gte, lt, lte, between
 */

// ── Null check (works for all types) ──

function isNullish(value) {
  return value === null || value === undefined || value === '';
}

// ── String ──

function resolveString(value, operator, target) {
  if (operator === 'isnull') return isNullish(value);
  if (isNullish(value)) return false;

  var v = String(value).toLowerCase();
  var t = (target != null ? String(target) : '').toLowerCase();

  switch (operator) {
    case 'eq':          return v === t;
    case 'neq':         return v !== t;
    case 'starts':      return v.startsWith(t);
    case 'ends':        return v.endsWith(t);
    case 'contains':    return v.includes(t);
    case 'notcontains': return !v.includes(t);
    default:            return false;
  }
}

// ── Number ──

function resolveNumber(value, operator, target, targetTo) {
  if (operator === 'isnull') return isNullish(value);
  if (isNullish(value)) return false;

  var v = Number(value);
  var t = Number(target);

  switch (operator) {
    case 'eq':      return v === t;
    case 'neq':     return v !== t;
    case 'gt':      return v > t;
    case 'gte':     return v >= t;
    case 'lt':      return v < t;
    case 'lte':     return v <= t;
    case 'between': {
      var to = Number(targetTo);
      if (isNaN(to)) return v >= t;
      return v >= t && v <= to;
    }
    default: return false;
  }
}

// ── Date ──

function toDay(v) {
  var d = new Date(v);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

function resolveDate(value, operator, target, targetTo) {
  if (operator === 'isnull') return isNullish(value);
  if (isNullish(value)) return false;

  var v = toDay(value);
  var t = toDay(target);
  if (isNaN(v) || isNaN(t)) return false;

  switch (operator) {
    case 'eq':      return v === t;
    case 'neq':     return v !== t;
    case 'gt':      return v > t;
    case 'gte':     return v >= t;
    case 'lt':      return v < t;
    case 'lte':     return v <= t;
    case 'between': {
      if (!targetTo) return v >= t;
      var to = toDay(targetTo);
      return v >= t && v <= to;
    }
    default: return false;
  }
}

// ── Unified entry point ──

/**
 * Resolve an operator comparison.
 *
 * @param {string} dataType   - 'string' | 'number' | 'date'
 * @param {*}      value      - The value to test
 * @param {string} operator   - The operator key
 * @param {*}      target     - The comparison target
 * @param {*}      [targetTo] - Second target for 'between'
 * @returns {boolean}
 */
function resolve(dataType, value, operator, target, targetTo) {
  switch (dataType) {
    case 'string':  return resolveString(value, operator, target);
    case 'number':  return resolveNumber(value, operator, target, targetTo);
    case 'date':    return resolveDate(value, operator, target, targetTo);
    default:        return resolveString(value, operator, target);
  }
}

export { resolve, resolveString, resolveNumber, resolveDate, isNullish };
