/**
 * useActionsController reading its places back from a real URL: rendered
 * through react-dom/server under a real react-router MemoryRouter, so a link
 * that names a record and a modal lands on them — and, with no `urlKey`, the
 * same query is ignored and the table stays in memory as before.
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import useActionsController from '../src/useActionsController.js';
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

var data = [
  { id: 3, name: 'Sales', employees: [{ id: 'e6', name: 'Asha' }] },
  { id: 4, name: 'Ops', employees: [] }
];
var schema = { 0: { key: 'department', columns: [] }, 1: { key: 'employees', columns: [] } };

/** The controller's result for one render at `url`. */
function controllerAt(url, options) {
  var seen = null;
  function Probe() {
    seen = useActionsController(Object.assign({ schema: schema, data: data, onCommit: function() {} }, options));
    return null;
  }
  renderToString(React.createElement(MemoryRouter, { initialEntries: [url] }, React.createElement(Probe)));
  return seen;
}

console.log('useActionsController in the URL');

test('the detail row is resolved from its id in the URL', function() {
  var a = controllerAt('/?ordersRow=3', { urlKey: 'orders' });
  assert.strictEqual(a.detailRow, data[0]);
});

test('an edit modal opens on a fresh copy of the named row', function() {
  var a = controllerAt('/?ordersEdit=edit:4', { urlKey: 'orders' });
  assert.strictEqual(a.modal.mode, 'edit');
  assert.deepStrictEqual(a.modal.record, data[1]);
  assert.notStrictEqual(a.modal.record, data[1]);
  assert.deepStrictEqual(a.modal.context, { level: 'parent' });
});

test('copy opens as add, without the id', function() {
  var a = controllerAt('/?ordersEdit=copy:3', { urlKey: 'orders' });
  assert.strictEqual(a.modal.mode, 'add');
  assert.strictEqual(a.modal.record.id, '');
  assert.strictEqual(a.modal.record.name, 'Sales');
});

test('add builds an empty record from the rows', function() {
  var a = controllerAt('/?ordersEdit=add', { urlKey: 'orders' });
  assert.deepStrictEqual(a.modal.record, { id: '', name: '', employees: [] });
});

test('a nested modal resolves with the real root id', function() {
  var a = controllerAt('/?ordersEdit=view:3/employees/e6', { urlKey: 'orders' });
  assert.strictEqual(a.modal.mode, 'view');
  assert.deepStrictEqual(a.modal.record, { id: 'e6', name: 'Asha' });
  assert.deepStrictEqual(a.modal.context, { level: 'nested', rootId: 3, path: ['employees'] });
  var add = controllerAt('/?ordersEdit=add:3/employees', { urlKey: 'orders' });
  assert.deepStrictEqual(add.modal.record, { id: '', name: '' });
});

test('a row that is not there (yet) opens nothing', function() {
  var a = controllerAt('/?ordersRow=9&ordersEdit=edit:9', { urlKey: 'orders' });
  assert.strictEqual(a.detailRow, null);
  assert.strictEqual(a.modal.mode, null);
  var b = controllerAt('/?ordersEdit=nonsense', { urlKey: 'orders' });
  assert.strictEqual(b.modal.mode, null);
});

test('only its own keys: another table\'s, or none at all, are ignored', function() {
  var other = controllerAt('/?ordersRow=3&ordersEdit=edit:3', { urlKey: 'people' });
  assert.strictEqual(other.detailRow, null);
  assert.strictEqual(other.modal.mode, null);
  var none = controllerAt('/?row=3&edit=edit:3', {});
  assert.strictEqual(none.detailRow, null);
  assert.strictEqual(none.modal.mode, null);
});

/**
 * Drive the controller in memory (no urlKey) through a script: each step runs
 * on its own render with that render's handlers, as a click would. The steps
 * update the component's own state during render, which React re-renders
 * straight away — so the whole script plays out in one server render.
 */
function play(steps) {
  var log = [];
  var i = 0;
  function Probe() {
    var a = useActionsController({ schema: schema, data: data, onCommit: function() {} });
    if (i > 0) log.push(a);
    if (i < steps.length) steps[i++](a);
    return null;
  }
  renderToString(React.createElement(MemoryRouter, null, React.createElement(Probe)));
  return log;
}

console.log('useActionsController in memory');

test('open and close the detail, by id', function() {
  var log = play([
    function(a) { a.openDetail(data[1]); },
    function(a) { a.closeDetail(); }
  ]);
  assert.strictEqual(log[0].detailRow, data[1]);
  assert.strictEqual(log[1].detailRow, null);
});

test('every opener lands on its modal; typing edits a draft, not the row', function() {
  var log = play([
    function(a) { a.openView(data[0]); },
    function(a) { a.openEdit(data[0]); },
    function(a) { a.updateField('name', 'Sales & Ops'); },
    function(a) { a.updateField('code', 'S'); },
    function(a) { a.openCopy(data[1]); },
    function(a) { a.openAdd(); },
    function(a) { a.openNestedView(3, ['employees'], data[0].employees[0]); },
    function(a) { a.openNestedEdit(3, ['employees'], data[0].employees[0]); },
    function(a) { a.openNestedCopy(3, ['employees'], data[0].employees[0]); },
    function(a) { a.openNestedAdd(3, ['employees'], 1); },
    function(a) { a.closeModal(); }
  ]);
  assert.strictEqual(log[0].modal.mode, 'view');
  assert.strictEqual(log[1].modal.mode, 'edit');
  assert.strictEqual(log[3].modal.record.name, 'Sales & Ops');
  assert.strictEqual(log[3].modal.record.code, 'S');
  assert.strictEqual(data[0].name, 'Sales');
  assert.deepStrictEqual([log[4].modal.mode, log[4].modal.record.id, log[4].modal.record.name], ['add', '', 'Ops']);
  assert.deepStrictEqual(log[5].modal.record, { id: '', name: '', employees: [] });
  assert.deepStrictEqual(log[6].modal.context, { level: 'nested', rootId: 3, path: ['employees'] });
  assert.strictEqual(log[7].modal.mode, 'edit');
  assert.strictEqual(log[8].modal.record.id, '');
  assert.deepStrictEqual(log[9].modal.record, { id: '', name: '' });
  assert.strictEqual(log[10].modal.mode, null);
});

test('reopening the same record starts from the row again, not the old draft', function() {
  var log = play([
    function(a) { a.openEdit(data[0]); },
    function(a) { a.updateField('name', 'typed'); },
    function(a) { a.closeModal(); },
    function(a) { a.openEdit(data[0]); },
    function() {}
  ]);
  assert.strictEqual(log[1].modal.record.name, 'typed');
  assert.strictEqual(log[3].modal.record.name, 'Sales');
});

test('save queues the draft and closes the modal', function() {
  var log = play([
    function(a) { a.openEdit(data[1]); },
    function(a) { a.updateField('name', 'Operations'); },
    function(a) { a.handleSave(); },
    function() {}
  ]);
  var last = log[log.length - 1];
  assert.strictEqual(last.modal.mode, null);
  assert.strictEqual(last.stagedData[1].name, 'Operations');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
