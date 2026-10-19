// WHERE YOU ARE IN A TABLE LIVES IN THE URL — the pure half, no React.
//
// The record detail popup and the view / edit / add / copy modal are places a
// person navigates to, so a refresh or a shared link must land on them again.
// The URL holds only what NAMES the place — the row's id, the mode, the
// nesting path — never the row object or a half-typed form: rows are looked
// up again once they have loaded.
//
// Keys come from the host (`urlKey`), because one page can render several
// tables and a host app has keys of its own. Without one the table keeps
// these in memory, exactly as before.

/**
 * The query keys a table writes, derived from the host's `urlKey`.
 * `null` when there is none: the state then stays in memory.
 *
 *   tableUrlKeys('orders') → { row: 'ordersRow', edit: 'ordersEdit' }
 */
export function tableUrlKeys(urlKey) {
  if (!urlKey) return null;
  return { row: urlKey + 'Row', edit: urlKey + 'Edit' };
}

/** A row's identity, as the table uses it everywhere: `_tempId`, else `id`. */
export function rowKey(row) {
  if (!row) return null;
  var k = row._tempId || row.id;
  return k === undefined || k === null || k === '' ? null : k;
}

/**
 * The row whose id is `key`, or null. Compared as strings, because a key read
 * back from the URL is always a string while a row's id may be a number.
 */
export function findRowByKey(rows, key) {
  if (key === null || key === undefined || key === '' || !rows) return null;
  var want = String(key);
  for (var i = 0; i < rows.length; i++) {
    var k = rowKey(rows[i]);
    if (k !== null && String(k) === want) return rows[i];
  }
  return null;
}

var MODES = { view: true, edit: true, add: true, copy: true };

/**
 * A modal place → one query value.
 *
 *   { mode: 'edit', id: 5 }                                   → 'edit:5'
 *   { mode: 'add' }                                           → 'add'
 *   { mode: 'view', rootId: 3, path: ['employees'], id: 'e6' } → 'view:3/employees/e6'
 *   { mode: 'add',  rootId: 3, path: ['employees'] }          → 'add:3/employees'
 *
 * Every segment is URI-encoded, so an id holding '/' or ':' still splits back
 * apart exactly. A nested path alternates field, id, field (odd length), which
 * is what tells a nested place from a parent one when it is read back.
 */
export function encodeModal(place) {
  if (!place || !MODES[place.mode]) return null;
  var segs = [];
  if (place.path && place.path.length) {
    segs.push(place.rootId);
    for (var i = 0; i < place.path.length; i++) segs.push(place.path[i]);
  }
  if (place.mode !== 'add') {
    if (place.id === undefined || place.id === null || place.id === '') return null;
    segs.push(place.id);
  }
  if (segs.length === 0) return place.mode;
  return place.mode + ':' + segs.map(function(s) { return encodeURIComponent(String(s)); }).join('/');
}

/** The query value back to a modal place, or null when it is not one. */
export function decodeModal(value) {
  if (!value || typeof value !== 'string') return null;
  var colon = value.indexOf(':');
  var mode = colon === -1 ? value : value.slice(0, colon);
  if (!MODES[mode]) return null;
  var segs = colon === -1 ? [] : value.slice(colon + 1).split('/').map(safeDecode);
  if (segs.some(function(s) { return s === null || s === ''; })) return null;

  var id = null;
  if (mode !== 'add') {
    if (segs.length === 0) return null;
    id = segs.pop();
  }
  if (segs.length === 0) return { mode: mode, id: id, rootId: null, path: null };
  // rootId + a path of odd length (field, id, field, …)
  if (segs.length < 2 || (segs.length - 1) % 2 !== 1) return null;
  return { mode: mode, id: id, rootId: segs[0], path: segs.slice(1) };
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch (e) { return null; }
}

/**
 * A place in context terms the modal already uses: the root's REAL id (the
 * URL holds a string; the queue matches on the row's own value) and a path
 * whose id segments are the real ids too. Null while the rows it names have
 * not loaded, or once they are gone.
 *
 * Returns { root, rows, context } where `rows` is the array the record lives
 * in (the table's rows for a parent place).
 */
export function resolvePlace(rows, place) {
  if (!place) return null;
  if (!place.path) return { rows: rows || [], context: { level: 'parent' } };
  var root = findRowByKey(rows, place.rootId);
  if (!root) return null;
  var realPath = [];
  var current = root;
  for (var i = 0; i < place.path.length; i++) {
    if (i % 2 === 0) {
      realPath.push(place.path[i]);
      current = current ? current[place.path[i]] : null;
    } else {
      var hit = Array.isArray(current) ? findRowByKey(current, place.path[i]) : null;
      if (!hit) return null;
      realPath.push(rowKey(hit));
      current = hit;
    }
  }
  if (!Array.isArray(current)) current = [];
  return { rows: current, context: { level: 'nested', rootId: rowKey(root), path: realPath } };
}
