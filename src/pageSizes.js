// The rows-per-page choices ALWAYS include the size in use. The list was a
// fixed 100/200/500/1000, so a table given pageSize 10 showed 10 rows while
// its dropdown claimed "100 rows" — the one control on the bar that was lying.
var PAGE_SIZES = [100, 200, 500, 1000];

export function pageSizeOptions(current) {
  if (!current || PAGE_SIZES.indexOf(current) !== -1) return PAGE_SIZES;
  return [current].concat(PAGE_SIZES).sort(function(a, b) { return a - b; });
}
