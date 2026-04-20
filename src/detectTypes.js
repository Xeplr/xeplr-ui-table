const TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  DATE: 'date',
  BOOLEAN: 'boolean'
};

const BOOLEAN_VALUES = new Set([true, false, 0, 1, '0', '1', 'true', 'false', 'True', 'False', 'TRUE', 'FALSE']);

const MAX_SAMPLE_ROWS = 100;

/**
 * Detect column data types from row data.
 *
 * @param {Array<object>} data       - Row array
 * @param {Array<object>} columns    - Column defs: [{ accessor, dataType? }]
 * @param {number}        [minRows]  - Minimum non-null samples needed for a confident detection
 * @returns {{ types: Map<string, string>, confident: boolean }}
 *   - types: Map of accessor → 'string' | 'number' | 'date' | 'boolean'
 *   - confident: true if every column had enough samples (≥ minRows)
 */
export function detectTypes(data, columns, minRows = 10) {
  var types = new Map();
  var confident = true;
  var sampleRows = data.slice(0, MAX_SAMPLE_ROWS);

  for (var i = 0; i < columns.length; i++) {
    var col = columns[i];
    var accessor = col.accessor;

    // Explicit dataType — always trust it
    if (col.dataType) {
      types.set(accessor, col.dataType);
      continue;
    }

    // Collect non-null, non-undefined, non-empty-string values
    var values = [];
    for (var r = 0; r < sampleRows.length; r++) {
      var val = sampleRows[r][accessor];
      if (val !== null && val !== undefined && val !== '') {
        values.push(val);
      }
    }

    // Not enough data — mark as inconclusive, fallback to string
    if (values.length < minRows) {
      confident = false;
      types.set(accessor, values.length === 0 ? TYPES.STRING : detectSingle(values));
      continue;
    }

    types.set(accessor, detectSingle(values));
  }

  return { types, confident };
}

/**
 * Detect the type of a single column from its sampled values.
 * Order matters: boolean → number → date → string
 */
function detectSingle(values) {
  // Boolean check — all values must be boolean-ish
  var allBoolean = true;
  for (var i = 0; i < values.length; i++) {
    if (!BOOLEAN_VALUES.has(values[i])) {
      allBoolean = false;
      break;
    }
  }
  if (allBoolean) return TYPES.BOOLEAN;

  // Number check — all values must be numeric
  var allNumber = true;
  for (var i = 0; i < values.length; i++) {
    if (typeof values[i] === 'boolean') { allNumber = false; break; }
    var num = Number(values[i]);
    if (isNaN(num)) { allNumber = false; break; }
  }
  if (allNumber) return TYPES.NUMBER;

  // Date check — all values must parse as dates AND not be plain numbers
  var allDate = true;
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    // Skip plain numbers — they parse as dates but aren't
    if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)))) {
      allDate = false;
      break;
    }
    if (isNaN(Date.parse(v))) {
      allDate = false;
      break;
    }
  }
  if (allDate) return TYPES.DATE;

  return TYPES.STRING;
}

export { TYPES };
