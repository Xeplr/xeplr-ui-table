// WHICH ROWS ARE KEPT AT THE BOTTOM OF EVERY PAGE — `pinBottomRows(row)`
// answered for each row of `data`, as TanStack's row ids (a top-level row's
// id is its position in `data`). A grand total is the usual one: the last row
// of the data, which with pages would otherwise be on the last page only.
export function bottomRowIds(data, pinBottomRows) {
  if (typeof pinBottomRows !== 'function') return [];
  var ids = [];
  (data || []).forEach(function (row, i) { if (pinBottomRows(row)) ids.push(String(i)); });
  return ids;
}
