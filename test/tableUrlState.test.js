import { tableUrlKeys, rowKey, findRowByKey, encodeModal, decodeModal, resolvePlace } from '../src/tableUrlState.js';
import { patchSearch, readSearch } from '@xeplr/ui-utils/src/url/urlState.js';
import assert from 'node:assert';

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name);
    console.log('    ' + e.message);
  }
}

var rows = [
  { id: 3, name: 'Sales', employees: [
    { id: 'e6', name: 'Asha', salaries: [{ id: 's1', amount: 10 }] },
    { _tempId: '__new_1', name: 'Ravi' }
  ] },
  { id: 'a/b:c', name: 'Odd id' },
  { _tempId: '__new_2', name: 'Unsaved' }
];

console.log('tableUrlKeys');

test('derived from the host prefix', function() {
  assert.deepStrictEqual(tableUrlKeys('orders'), { row: 'ordersRow', edit: 'ordersEdit' });
});

test('no prefix: no keys, so the table stays in memory', function() {
  assert.strictEqual(tableUrlKeys(undefined), null);
  assert.strictEqual(tableUrlKeys(''), null);
});

console.log('rowKey / findRowByKey');

test('a temp id wins over id; an empty id is no key', function() {
  assert.strictEqual(rowKey({ id: 1, _tempId: '__new_1' }), '__new_1');
  assert.strictEqual(rowKey({ id: 0 }), 0);
  assert.strictEqual(rowKey({ id: '' }), null);
  assert.strictEqual(rowKey({}), null);
  assert.strictEqual(rowKey(null), null);
});

test('a key read back from the URL (a string) finds a numeric id', function() {
  assert.strictEqual(findRowByKey(rows, '3'), rows[0]);
  assert.strictEqual(findRowByKey(rows, '__new_2'), rows[2]);
});

test('nothing to find: absent key, no rows yet, or the row is gone', function() {
  assert.strictEqual(findRowByKey(rows, null), null);
  assert.strictEqual(findRowByKey(rows, ''), null);
  assert.strictEqual(findRowByKey(undefined, '3'), null);
  assert.strictEqual(findRowByKey([], '3'), null);
  assert.strictEqual(findRowByKey(rows, '99'), null);
});

console.log('encodeModal / decodeModal');

test('parent places read as words', function() {
  assert.strictEqual(encodeModal({ mode: 'edit', id: 5 }), 'edit:5');
  assert.strictEqual(encodeModal({ mode: 'view', id: 5 }), 'view:5');
  assert.strictEqual(encodeModal({ mode: 'copy', id: 5 }), 'copy:5');
  assert.strictEqual(encodeModal({ mode: 'add' }), 'add');
});

test('nested places carry the root and the path', function() {
  assert.strictEqual(encodeModal({ mode: 'edit', rootId: 3, path: ['employees'], id: 'e6' }), 'edit:3/employees/e6');
  assert.strictEqual(encodeModal({ mode: 'add', rootId: 3, path: ['employees', 'e6', 'salaries'] }), 'add:3/employees/e6/salaries');
});

test('every place round-trips, ids with / and : included', function() {
  [
    { mode: 'edit', id: 'a/b:c', rootId: null, path: null },
    { mode: 'add', id: null, rootId: null, path: null },
    { mode: 'view', id: 's1', rootId: '3', path: ['employees', 'e6', 'salaries'] },
    { mode: 'add', id: null, rootId: 'a/b:c', path: ['employees'] }
  ].forEach(function(place) {
    var value = encodeModal(place);
    assert.deepStrictEqual(decodeModal(value), place, value);
  });
});

test('survives a trip through the query string', function() {
  var value = encodeModal({ mode: 'copy', rootId: 'a/b:c', path: ['employees'], id: 'x y' });
  var q = patchSearch('?tab=1', { ordersEdit: value });
  assert.deepStrictEqual(decodeModal(readSearch(new URLSearchParams(q.toString()), 'ordersEdit')),
    { mode: 'copy', id: 'x y', rootId: 'a/b:c', path: ['employees'] });
});

test('not a place: unknown mode, missing id, bad path, bad encoding', function() {
  assert.strictEqual(encodeModal(null), null);
  assert.strictEqual(encodeModal({ mode: 'delete', id: 1 }), null);
  assert.strictEqual(encodeModal({ mode: 'edit' }), null);
  assert.strictEqual(decodeModal(null), null);
  assert.strictEqual(decodeModal(''), null);
  assert.strictEqual(decodeModal('delete:1'), null);
  assert.strictEqual(decodeModal('edit'), null);
  assert.strictEqual(decodeModal('edit:'), null);
  assert.strictEqual(decodeModal('edit:3/employees/e6/salaries/s1/x'), null);
  assert.strictEqual(decodeModal('add:3'), null);
  assert.strictEqual(decodeModal('edit:%E0%A4%A'), null);
});

console.log('resolvePlace');

test('a parent place resolves to the table rows', function() {
  assert.deepStrictEqual(resolvePlace(rows, decodeModal('edit:3')), { rows: rows, context: { level: 'parent' } });
  assert.deepStrictEqual(resolvePlace(undefined, decodeModal('add')), { rows: [], context: { level: 'parent' } });
});

test('a nested place resolves with the rows\' real ids, not the URL strings', function() {
  var r = resolvePlace(rows, decodeModal('edit:3/employees/e6/salaries/s1'));
  assert.deepStrictEqual(r.context, { level: 'nested', rootId: 3, path: ['employees', 'e6', 'salaries'] });
  assert.strictEqual(r.rows, rows[0].employees[0].salaries);
});

test('a child array not there yet is empty, so Add still opens', function() {
  var r = resolvePlace(rows, decodeModal('add:3/employees/__new_1/salaries'));
  assert.deepStrictEqual(r.rows, []);
  assert.deepStrictEqual(r.context.path, ['employees', '__new_1', 'salaries']);
});

test('rows not loaded, or the root / a step gone: nothing yet', function() {
  assert.strictEqual(resolvePlace(rows, null), null);
  assert.strictEqual(resolvePlace([], decodeModal('edit:3/employees/e6')), null);
  assert.strictEqual(resolvePlace(rows, decodeModal('edit:3/employees/e9/salaries/s1')), null);
  assert.strictEqual(resolvePlace(rows, decodeModal('add:a%2Fb%3Ac/employees/e1/salaries')), null);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
