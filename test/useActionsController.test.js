/**
 * Tests for useActionsController queue and staged data logic.
 * Tests the pure logic contracts without React hooks.
 */
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

// ── Helper: simulate stagedData computation (mirrors controller logic) ──

function computeStaged(data, queue) {
  var map = new Map();
  var order = [];
  for (var i = 0; i < data.length; i++) {
    map.set(data[i].id, Object.assign({}, data[i]));
    order.push(data[i].id);
  }
  for (var q = 0; q < queue.length; q++) {
    var entry = queue[q];
    if (entry.type === 'save') {
      var rec = entry.record;
      var id = rec._tempId || rec.id;
      if (map.has(id)) {
        map.set(id, Object.assign({}, rec));
      } else {
        map.set(id, Object.assign({}, rec));
        order.push(id);
      }
    } else if (entry.type === 'delete') {
      for (var d = 0; d < entry.ids.length; d++) {
        map.delete(entry.ids[d]);
        var idx = order.indexOf(entry.ids[d]);
        if (idx !== -1) order.splice(idx, 1);
      }
    }
  }
  var result = [];
  for (var o = 0; o < order.length; o++) {
    var item = map.get(order[o]);
    if (item) result.push(item);
  }
  return result;
}

// ── Helper: simulate commit consolidation ──

function consolidateQueue(queue) {
  var saveMap = new Map();
  var deleteSet = new Set();
  for (var i = 0; i < queue.length; i++) {
    var entry = queue[i];
    if (entry.type === 'save') {
      var id = entry.record._tempId || entry.record.id;
      saveMap.set(id, entry.record);
      deleteSet.delete(id);
    } else if (entry.type === 'delete') {
      for (var d = 0; d < entry.ids.length; d++) {
        deleteSet.add(entry.ids[d]);
        saveMap.delete(entry.ids[d]);
      }
    }
  }
  var saves = [];
  saveMap.forEach(function(record) {
    var clean = Object.assign({}, record);
    if (clean._tempId) { clean.id = ''; delete clean._tempId; }
    saves.push(clean);
  });
  var deletes = [];
  deleteSet.forEach(function(id) {
    if (!String(id).startsWith('__new_')) deletes.push(id);
  });
  return { saves: saves, deletes: deletes };
}

var sampleData = [
  { id: '1', name: 'Alice', score: 90 },
  { id: '2', name: 'Bob', score: 70 },
  { id: '3', name: 'Charlie', score: 50 }
];

// ── Staged data: empty queue ──

console.log('\n--- Staged data: no changes ---');

test('empty queue returns original data', function() {
  var staged = computeStaged(sampleData, []);
  assert.strictEqual(staged.length, 3);
  assert.strictEqual(staged[0].name, 'Alice');
});

// ── Staged data: edits ──

console.log('\n--- Staged data: edits ---');

test('edit updates existing row', function() {
  var queue = [
    { type: 'save', record: { id: '2', name: 'Bobby', score: 75 } }
  ];
  var staged = computeStaged(sampleData, queue);
  assert.strictEqual(staged.length, 3);
  assert.strictEqual(staged[1].name, 'Bobby');
  assert.strictEqual(staged[1].score, 75);
});

test('multiple edits to same row — last wins', function() {
  var queue = [
    { type: 'save', record: { id: '1', name: 'Alice v2', score: 91 } },
    { type: 'save', record: { id: '1', name: 'Alice v3', score: 92 } }
  ];
  var staged = computeStaged(sampleData, queue);
  assert.strictEqual(staged[0].name, 'Alice v3');
  assert.strictEqual(staged[0].score, 92);
});

test('edit preserves row order', function() {
  var queue = [
    { type: 'save', record: { id: '3', name: 'Chuck', score: 55 } }
  ];
  var staged = computeStaged(sampleData, queue);
  assert.strictEqual(staged[0].id, '1');
  assert.strictEqual(staged[1].id, '2');
  assert.strictEqual(staged[2].name, 'Chuck');
});

// ── Staged data: adds ──

console.log('\n--- Staged data: adds ---');

test('new record appended with _tempId', function() {
  var queue = [
    { type: 'save', record: { id: '', _tempId: '__new_1', name: 'Dave', score: 60 } }
  ];
  var staged = computeStaged(sampleData, queue);
  assert.strictEqual(staged.length, 4);
  assert.strictEqual(staged[3].name, 'Dave');
  assert.strictEqual(staged[3]._tempId, '__new_1');
});

test('multiple adds appended in order', function() {
  var queue = [
    { type: 'save', record: { id: '', _tempId: '__new_1', name: 'Dave', score: 60 } },
    { type: 'save', record: { id: '', _tempId: '__new_2', name: 'Eve', score: 80 } }
  ];
  var staged = computeStaged(sampleData, queue);
  assert.strictEqual(staged.length, 5);
  assert.strictEqual(staged[3].name, 'Dave');
  assert.strictEqual(staged[4].name, 'Eve');
});

test('editing a new record before commit updates it in place', function() {
  var queue = [
    { type: 'save', record: { id: '', _tempId: '__new_1', name: 'Dave', score: 60 } },
    { type: 'save', record: { id: '', _tempId: '__new_1', name: 'David', score: 65 } }
  ];
  var staged = computeStaged(sampleData, queue);
  assert.strictEqual(staged.length, 4);
  assert.strictEqual(staged[3].name, 'David');
  assert.strictEqual(staged[3].score, 65);
});

// ── Staged data: deletes ──

console.log('\n--- Staged data: deletes ---');

test('delete removes row', function() {
  var queue = [
    { type: 'delete', ids: ['2'] }
  ];
  var staged = computeStaged(sampleData, queue);
  assert.strictEqual(staged.length, 2);
  assert.strictEqual(staged[0].id, '1');
  assert.strictEqual(staged[1].id, '3');
});

test('multi-delete removes multiple rows', function() {
  var queue = [
    { type: 'delete', ids: ['1', '3'] }
  ];
  var staged = computeStaged(sampleData, queue);
  assert.strictEqual(staged.length, 1);
  assert.strictEqual(staged[0].id, '2');
});

test('delete all rows', function() {
  var queue = [
    { type: 'delete', ids: ['1', '2', '3'] }
  ];
  var staged = computeStaged(sampleData, queue);
  assert.strictEqual(staged.length, 0);
});

// ── Staged data: mixed operations ──

console.log('\n--- Staged data: mixed operations ---');

test('add then delete new record = no trace', function() {
  var queue = [
    { type: 'save', record: { id: '', _tempId: '__new_1', name: 'Dave', score: 60 } },
    { type: 'delete', ids: ['__new_1'] }
  ];
  var staged = computeStaged(sampleData, queue);
  assert.strictEqual(staged.length, 3); // back to original count
});

test('edit then delete = row gone', function() {
  var queue = [
    { type: 'save', record: { id: '2', name: 'Bobby', score: 75 } },
    { type: 'delete', ids: ['2'] }
  ];
  var staged = computeStaged(sampleData, queue);
  assert.strictEqual(staged.length, 2);
  assert.strictEqual(staged.every(function(r) { return r.id !== '2'; }), true);
});

test('delete then add (different) = replaced', function() {
  var queue = [
    { type: 'delete', ids: ['1'] },
    { type: 'save', record: { id: '', _tempId: '__new_1', name: 'NewAlice', score: 95 } }
  ];
  var staged = computeStaged(sampleData, queue);
  assert.strictEqual(staged.length, 3); // 3 original - 1 deleted + 1 added
  assert.strictEqual(staged[2].name, 'NewAlice');
});

// ── Commit consolidation ──

console.log('\n--- Commit consolidation ---');

test('consolidate: multiple edits to same record sends only latest', function() {
  var queue = [
    { type: 'save', record: { id: '1', name: 'v1', score: 1 } },
    { type: 'save', record: { id: '1', name: 'v2', score: 2 } },
    { type: 'save', record: { id: '1', name: 'v3', score: 3 } }
  ];
  var result = consolidateQueue(queue);
  assert.strictEqual(result.saves.length, 1);
  assert.strictEqual(result.saves[0].name, 'v3');
  assert.strictEqual(result.deletes.length, 0);
});

test('consolidate: add then delete = no API calls', function() {
  var queue = [
    { type: 'save', record: { id: '', _tempId: '__new_1', name: 'Ghost', score: 0 } },
    { type: 'delete', ids: ['__new_1'] }
  ];
  var result = consolidateQueue(queue);
  assert.strictEqual(result.saves.length, 0);
  assert.strictEqual(result.deletes.length, 0); // temp id filtered out
});

test('consolidate: real delete sends id', function() {
  var queue = [
    { type: 'delete', ids: ['5', '7'] }
  ];
  var result = consolidateQueue(queue);
  assert.strictEqual(result.saves.length, 0);
  assert.strictEqual(result.deletes.length, 2);
  assert.deepStrictEqual(result.deletes.sort(), ['5', '7']);
});

test('consolidate: new record gets blank id for API', function() {
  var queue = [
    { type: 'save', record: { id: '', _tempId: '__new_1', name: 'New', score: 50 } }
  ];
  var result = consolidateQueue(queue);
  assert.strictEqual(result.saves.length, 1);
  assert.strictEqual(result.saves[0].id, '');
  assert.strictEqual(result.saves[0]._tempId, undefined);
  assert.strictEqual(result.saves[0].name, 'New');
});

test('consolidate: edit existing + add new + delete another', function() {
  var queue = [
    { type: 'save', record: { id: '1', name: 'Alice Updated', score: 95 } },
    { type: 'save', record: { id: '', _tempId: '__new_1', name: 'Dave', score: 60 } },
    { type: 'delete', ids: ['3'] }
  ];
  var result = consolidateQueue(queue);
  assert.strictEqual(result.saves.length, 2);
  assert.strictEqual(result.deletes.length, 1);
  assert.strictEqual(result.deletes[0], '3');
  var names = result.saves.map(function(r) { return r.name; }).sort();
  assert.deepStrictEqual(names, ['Alice Updated', 'Dave']);
});

// ── Selection ──

console.log('\n--- Selection ---');

test('toggle adds id to set', function() {
  var set = new Set();
  var next = new Set(set);
  next.add('r1');
  assert.strictEqual(next.has('r1'), true);
});

test('toggle removes id from set', function() {
  var set = new Set(['r1', 'r2']);
  var next = new Set(set);
  next.delete('r1');
  assert.strictEqual(next.has('r1'), false);
  assert.strictEqual(next.size, 1);
});

test('select all / deselect all', function() {
  var visible = ['r1', 'r2', 'r3'];
  var selected = new Set(visible);
  assert.strictEqual(selected.size, 3);
  selected = new Set();
  assert.strictEqual(selected.size, 0);
});

// ── Modal record construction ──

console.log('\n--- Modal record construction ---');

test('copy strips id and _tempId', function() {
  var row = { id: '5', _tempId: undefined, name: 'Alice' };
  var copy = Object.assign({}, row);
  copy.id = '';
  delete copy._tempId;
  assert.strictEqual(copy.id, '');
  assert.strictEqual(copy._tempId, undefined);
  assert.strictEqual(copy.name, 'Alice');
});

test('add creates empty record', function() {
  var columns = [{ accessor: 'id' }, { accessor: 'name' }, { accessor: 'score' }];
  var empty = {};
  for (var i = 0; i < columns.length; i++) empty[columns[i].accessor] = '';
  empty.id = '';
  assert.strictEqual(Object.keys(empty).length, 3);
  assert.strictEqual(empty.name, '');
});

// ── Summary ──

console.log('\n' + (passed + failed) + ' tests: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
