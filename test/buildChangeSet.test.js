import { buildChangeSet } from '../src/buildChangeSet.js';
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

var schema = {
  0: { key: 'department', columns: [] },
  1: { key: 'employees', columns: [] }
};

var schema3Level = {
  0: { key: 'department', columns: [] },
  1: { key: 'employees', columns: [] },
  2: { key: 'salaries', columns: [] }
};

// ── User's exact example ──

console.log('\n--- User example: departments + employees ---');

var original = [
  { id: 1, name: 'd1', employees: [
    { id: 'e1', name: 'e1 name' },
    { id: 'e2', name: 'e2 name' }
  ]},
  { id: 2, name: 'd2', employees: [
    { id: 'e3', name: 'e3 name' },
    { id: 'e4', name: 'e4 name' }
  ]},
  { id: 3, name: 'd3', employees: [
    { id: 'e5', name: 'e5 name' },
    { id: 'e6', name: 'e6 name' }
  ]},
  { id: 4, name: 'd4', employees: [
    { id: 'e7', name: 'e7 name' },
    { id: 'e8', name: 'e8 name' }
  ]}
];

var staged = [
  { id: 1, name: 'd1', employees: [
    { id: 'e1', name: 'e1 name' }
  ]},
  { id: 2, name: 'd2new', employees: [
    { id: 'e3', name: 'e3 name' },
    { id: 'e4', name: 'e4 name' }
  ]},
  { id: 3, name: 'd3', employees: [
    { id: 'e5', name: 'e5 name' },
    { id: 'e6', name: 'e6 new name' }
  ]},
  { id: 4, name: 'd4', employees: [
    { id: 'e7', name: 'e7 name' },
    { id: 'e8', name: 'e8 name' }
  ]}
];

test('exact user example', function() {
  var result = buildChangeSet(original, staged, schema, 0);
  assert.strictEqual(result.length, 3);

  var d1 = result.find(function(r) { return r.id === 1; });
  assert.ok(d1);
  assert.strictEqual(d1.name, undefined);
  assert.strictEqual(d1.employees.length, 1);
  assert.strictEqual(d1.employees[0].id, 'e2');
  assert.strictEqual(d1.employees[0].deleted, true);

  var d2 = result.find(function(r) { return r.id === 2; });
  assert.ok(d2);
  assert.strictEqual(d2.name, 'd2new');
  assert.strictEqual(d2.employees, undefined);

  var d3 = result.find(function(r) { return r.id === 3; });
  assert.ok(d3);
  assert.strictEqual(d3.name, undefined);
  assert.strictEqual(d3.employees.length, 1);
  assert.strictEqual(d3.employees[0].id, 'e6');
  assert.strictEqual(d3.employees[0].name, 'e6 new name');
});

// ── Basics ──

console.log('\n--- Basics ---');

test('no changes = empty', function() {
  assert.strictEqual(buildChangeSet(original, original, schema, 0).length, 0);
});

test('deleted parent', function() {
  var result = buildChangeSet(original, original.slice(1), schema, 0);
  var del = result.find(function(r) { return r.id === 1; });
  assert.ok(del);
  assert.strictEqual(del.deleted, true);
});

test('new parent with children', function() {
  var newDept = {
    _tempId: '__new_1', id: '', name: 'New',
    employees: [{ _tempId: '__new_c1', id: '', name: 'Emp1' }]
  };
  var result = buildChangeSet(original, original.concat(newDept), schema, 0);
  var added = result.find(function(r) { return r.name === 'New'; });
  assert.ok(added);
  assert.strictEqual(added._tempId, undefined);
  assert.strictEqual(added.employees.length, 1);
  assert.strictEqual(added.employees[0]._tempId, undefined);
});

test('parent field only change', function() {
  var s = original.map(function(r) {
    return r.id === 4 ? Object.assign({}, r, { name: 'd4x' }) : r;
  });
  var result = buildChangeSet(original, s, schema, 0);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].id, 4);
  assert.strictEqual(result[0].name, 'd4x');
  assert.strictEqual(result[0].employees, undefined);
});

// ── Child operations ──

console.log('\n--- Child operations ---');

test('new child', function() {
  var s = original.map(function(r) {
    if (r.id === 1) return Object.assign({}, r, {
      employees: r.employees.concat({ _tempId: '__new_1', id: '', name: 'Hire' })
    });
    return r;
  });
  var result = buildChangeSet(original, s, schema, 0);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].employees.length, 1);
  assert.strictEqual(result[0].employees[0].name, 'Hire');
});

test('add then delete child = no-op for that child', function() {
  // Staged has e2 removed AND a new employee — both changes should show
  var s = original.map(function(r) {
    if (r.id === 1) return Object.assign({}, r, {
      employees: [
        { id: 'e1', name: 'e1 name' },
        { _tempId: '__new_1', id: '', name: 'New' }
      ]
    });
    return r;
  });
  var result = buildChangeSet(original, s, schema, 0);
  var d1 = result.find(function(r) { return r.id === 1; });
  assert.ok(d1);
  assert.strictEqual(d1.employees.length, 2); // 1 deleted + 1 new
});

// ── 3-level deep ──

console.log('\n--- 3-level: dept > employees > salaries ---');

var original3 = [
  { id: 1, name: 'd1', employees: [
    { id: 'e1', name: 'Alice', salaries: [
      { id: 's1', month: 'Jan', amount: 10000 },
      { id: 's2', month: 'Feb', amount: 10000 }
    ]},
    { id: 'e2', name: 'Bob', salaries: [
      { id: 's3', month: 'Jan', amount: 8000 }
    ]}
  ]}
];

test('grandchild modified', function() {
  var s = [
    { id: 1, name: 'd1', employees: [
      { id: 'e1', name: 'Alice', salaries: [
        { id: 's1', month: 'Jan', amount: 12000 },  // changed
        { id: 's2', month: 'Feb', amount: 10000 }
      ]},
      { id: 'e2', name: 'Bob', salaries: [
        { id: 's3', month: 'Jan', amount: 8000 }
      ]}
    ]}
  ];
  var result = buildChangeSet(original3, s, schema3Level, 0);
  assert.strictEqual(result.length, 1);
  var d1 = result[0];
  assert.strictEqual(d1.id, 1);
  assert.strictEqual(d1.name, undefined); // parent unchanged
  assert.strictEqual(d1.employees.length, 1); // only e1 changed
  assert.strictEqual(d1.employees[0].id, 'e1');
  assert.strictEqual(d1.employees[0].name, undefined); // employee name unchanged
  assert.strictEqual(d1.employees[0].salaries.length, 1);
  assert.strictEqual(d1.employees[0].salaries[0].id, 's1');
  assert.strictEqual(d1.employees[0].salaries[0].amount, 12000);
});

test('grandchild deleted', function() {
  var s = [
    { id: 1, name: 'd1', employees: [
      { id: 'e1', name: 'Alice', salaries: [
        { id: 's2', month: 'Feb', amount: 10000 }  // s1 removed
      ]},
      { id: 'e2', name: 'Bob', salaries: [
        { id: 's3', month: 'Jan', amount: 8000 }
      ]}
    ]}
  ];
  var result = buildChangeSet(original3, s, schema3Level, 0);
  var d1 = result[0];
  var e1 = d1.employees[0];
  assert.strictEqual(e1.salaries.length, 1);
  assert.strictEqual(e1.salaries[0].id, 's1');
  assert.strictEqual(e1.salaries[0].deleted, true);
});

test('mixed: parent + child + grandchild changes', function() {
  var s = [
    { id: 1, name: 'd1 renamed', employees: [
      { id: 'e1', name: 'Alice Updated', salaries: [
        { id: 's1', month: 'Jan', amount: 10000 },
        { id: 's2', month: 'Feb', amount: 10000 }
      ]},
      // e2 deleted
    ]}
  ];
  var result = buildChangeSet(original3, s, schema3Level, 0);
  var d1 = result[0];
  assert.strictEqual(d1.name, 'd1 renamed');
  assert.strictEqual(d1.employees.length, 2); // e1 modified + e2 deleted

  var e1 = d1.employees.find(function(e) { return e.id === 'e1'; });
  assert.strictEqual(e1.name, 'Alice Updated');
  assert.strictEqual(e1.salaries, undefined); // salaries unchanged

  var e2 = d1.employees.find(function(e) { return e.id === 'e2'; });
  assert.strictEqual(e2.deleted, true);
});

// ── Flat table (schema level 0 only) ──

console.log('\n--- Flat table ---');

test('flat table works with schema', function() {
  var flatSchema = { 0: { key: 'users', columns: [] } };
  var flat = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
  var flatStaged = [{ id: 1, name: 'a updated' }, { id: 2, name: 'b' }];
  var result = buildChangeSet(flat, flatStaged, flatSchema, 0);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].id, 1);
  assert.strictEqual(result[0].name, 'a updated');
});

// ── Summary ──
console.log('\n' + (passed + failed) + ' tests: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
