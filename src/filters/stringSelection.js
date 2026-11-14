// WHAT A STRING FILTER'S TICKS MEAN — pure, so it can be tested.
//
// The filter value is { selected: string[], isNull: true|false|null }:
//   selected []                  nothing chosen: every row shows (all ticked)
//   selected ['__xeplr_none__']  "Clear All": no row shows (none ticked)
//   selected [a, b]              only rows whose value is a or b
export var NONE = '__xeplr_none__';

/**
 * The selection after one value's tick is toggled — as the boxes read. With
 * everything ticked, unticking one leaves all the others; after Clear All,
 * ticking one shows that one; ticking the last one back is "all" again.
 * @param {string[]} selected  the current selection
 * @param {string} value       the value toggled
 * @param {string[]} all       every value the column has
 * @returns {string[]}
 */
export function toggleSelection(selected, value, all) {
  var current = (selected || []).filter(function(v) { return v !== NONE; });
  var everything = !selected || selected.length === 0;
  var ticked = new Set(everything ? all : current);
  if (ticked.has(value)) ticked.delete(value); else ticked.add(value);
  if (ticked.size === 0) return [NONE];
  var allTicked = all.length > 0 && all.every(function(v) { return ticked.has(v); });
  return allTicked ? [] : Array.from(ticked);
}

/** Whether a row's value passes a string filter. */
export function passesString(val, filterValue) {
  if (!filterValue) return true;
  var isNullish = val === null || val === undefined || val === '';
  if (filterValue.isNull === true) return isNullish;
  if (filterValue.isNull === false && isNullish) return false;
  var selected = filterValue.selected || [];
  if (selected.length === 0) return true;
  var chosen = selected.filter(function(v) { return v !== NONE; });
  if (!chosen.length) return false;
  return chosen.includes(String(val));
}
