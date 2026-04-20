import { useState, useCallback, useMemo, useRef } from 'react';
import { buildChangeSet } from './buildChangeSet.js';

/**
 * Controller for table CRUD actions with transactional queue.
 * Supports N-level nesting via schema.
 *
 * Queue entries use a `path` to target any nesting level:
 *   path: ['employees']                    → level 1
 *   path: ['employees', 'e6', 'salaries']  → level 2
 *
 * @param {object}   options
 * @param {Function} [options.onCommit] - async (changeSet[]) => void
 * @param {object}   options.schema     - { 0: { key, columns }, 1: { key, columns }, ... }
 * @param {Array}    options.data       - Original data
 */
export default function useActionsController(options) {
  var onCommit = options.onCommit || null;
  var schema = options.schema || {};
  var data = options.data || [];

  var hasActions = !!onCommit;
  var hasSave = hasActions;
  var hasDelete = hasActions;

  // Derive child key from schema (level 1's key)
  var childKey = schema[1] ? schema[1].key : null;

  // ── Temp ID counter ──
  var tempIdCounter = useRef(0);
  function nextTempId() {
    tempIdCounter.current++;
    return '__new_' + tempIdCounter.current;
  }

  // ── Queue ──
  // Parent: { type: 'save', record } | { type: 'delete', ids }
  // Nested: { type: 'nested-save', rootId, path, record }
  //         { type: 'nested-delete', rootId, path, ids }
  var [queue, setQueue] = useState([]);

  var pendingCount = queue.length;
  var hasPending = pendingCount > 0;

  // ── Staged data ──
  var stagedData = useMemo(function() {
    if (queue.length === 0) return data;

    // Deep clone data
    var map = new Map();
    var order = [];
    for (var i = 0; i < data.length; i++) {
      map.set(data[i].id, deepClone(data[i]));
      order.push(data[i].id);
    }

    for (var q = 0; q < queue.length; q++) {
      var entry = queue[q];

      if (entry.type === 'save') {
        var rec = entry.record;
        var id = rec._tempId || rec.id;
        if (map.has(id)) {
          // Preserve child arrays when updating parent fields
          var existing = map.get(id);
          var updated = Object.assign({}, rec);
          copyChildArrays(existing, updated);
          map.set(id, updated);
        } else {
          map.set(id, deepClone(rec));
          order.push(id);
        }
      } else if (entry.type === 'delete') {
        for (var d = 0; d < entry.ids.length; d++) {
          map.delete(entry.ids[d]);
          var idx = order.indexOf(entry.ids[d]);
          if (idx !== -1) order.splice(idx, 1);
        }
      } else if (entry.type === 'nested-save') {
        var root = map.get(entry.rootId);
        if (!root) continue;
        root = deepClone(root);
        applyNestedSave(root, entry.path, entry.record);
        map.set(entry.rootId, root);
      } else if (entry.type === 'nested-delete') {
        var root2 = map.get(entry.rootId);
        if (!root2) continue;
        root2 = deepClone(root2);
        applyNestedDelete(root2, entry.path, entry.ids);
        map.set(entry.rootId, root2);
      }
    }

    var result = [];
    for (var o = 0; o < order.length; o++) {
      var item = map.get(order[o]);
      if (item) result.push(item);
    }
    return result;
  }, [data, queue]);

  // ── Selection ──
  var [selectedIds, setSelectedIds] = useState(new Set());

  var toggleSelect = useCallback(function(id) {
    setSelectedIds(function(prev) {
      var next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  var toggleSelectAll = useCallback(function(visibleIds) {
    setSelectedIds(function(prev) {
      var allSelected = visibleIds.length > 0 && visibleIds.every(function(id) { return prev.has(id); });
      if (allSelected) return new Set();
      return new Set(visibleIds);
    });
  }, []);

  var clearSelection = useCallback(function() {
    setSelectedIds(new Set());
  }, []);

  // ── Expanded rows (per level, keyed by row id) ──
  var [expandedIds, setExpandedIds] = useState(new Set());

  var toggleExpand = useCallback(function(id) {
    setExpandedIds(function(prev) {
      var next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  // ── Detail popup (for childDisplay === 'popup') ──
  var [detailRow, setDetailRow] = useState(null);

  var openDetail = useCallback(function(row) {
    setDetailRow(row);
  }, []);

  var closeDetail = useCallback(function() {
    setDetailRow(null);
  }, []);

  // ── Modal ──
  // context: { level, schemaLevel, rootId?, path? }
  var [modal, setModal] = useState({ mode: null, record: null, context: null });

  var openView = useCallback(function(row) {
    setModal({ mode: 'view', record: Object.assign({}, row), context: { level: 'parent' } });
  }, []);

  var openEdit = useCallback(function(row) {
    setModal({ mode: 'edit', record: Object.assign({}, row), context: { level: 'parent' } });
  }, []);

  var openCopy = useCallback(function(row) {
    var copy = Object.assign({}, row);
    copy.id = '';
    delete copy._tempId;
    setModal({ mode: 'add', record: copy, context: { level: 'parent' } });
  }, []);

  var openAdd = useCallback(function() {
    var empty = buildEmptyRecord(schema, 0, data);
    setModal({ mode: 'add', record: empty, context: { level: 'parent' } });
  }, [schema, data]);

  // Nested modal openers
  var openNestedView = useCallback(function(rootId, path, row) {
    setModal({ mode: 'view', record: Object.assign({}, row), context: { level: 'nested', rootId: rootId, path: path } });
  }, []);

  var openNestedEdit = useCallback(function(rootId, path, row) {
    setModal({ mode: 'edit', record: Object.assign({}, row), context: { level: 'nested', rootId: rootId, path: path } });
  }, []);

  var openNestedCopy = useCallback(function(rootId, path, row) {
    var copy = Object.assign({}, row);
    copy.id = '';
    delete copy._tempId;
    setModal({ mode: 'add', record: copy, context: { level: 'nested', rootId: rootId, path: path } });
  }, []);

  var openNestedAdd = useCallback(function(rootId, path, schemaLevel) {
    var empty = buildEmptyRecord(schema, schemaLevel, findNestedArray(stagedData, rootId, path));
    setModal({ mode: 'add', record: empty, context: { level: 'nested', rootId: rootId, path: path } });
  }, [schema, stagedData]);

  var closeModal = useCallback(function() {
    setModal({ mode: null, record: null, context: null });
  }, []);

  var updateField = useCallback(function(field, value) {
    setModal(function(prev) {
      if (!prev.record) return prev;
      var updated = Object.assign({}, prev.record);
      updated[field] = value;
      return { mode: prev.mode, record: updated, context: prev.context };
    });
  }, []);

  // ── Queue: save ──
  var handleSave = useCallback(function() {
    if (!modal.record || !modal.context) return;
    var record = Object.assign({}, modal.record);
    var ctx = modal.context;

    if (!record.id && !record._tempId) {
      record._tempId = nextTempId();
    }

    if (ctx.level === 'parent') {
      setQueue(function(prev) { return prev.concat({ type: 'save', record: record }); });
    } else if (ctx.level === 'nested') {
      setQueue(function(prev) {
        return prev.concat({
          type: 'nested-save',
          rootId: ctx.rootId,
          path: ctx.path,
          record: record
        });
      });
    }
    closeModal();
  }, [modal.record, modal.context, closeModal]);

  // ── Queue: parent delete ──
  var handleDeleteRow = useCallback(function(id) {
    setQueue(function(prev) { return prev.concat({ type: 'delete', ids: [id] }); });
    setSelectedIds(function(prev) {
      if (!prev.has(id)) return prev;
      var next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  var handleDeleteSelected = useCallback(function() {
    if (selectedIds.size === 0) return;
    var ids = Array.from(selectedIds);
    setQueue(function(prev) { return prev.concat({ type: 'delete', ids: ids }); });
    clearSelection();
  }, [selectedIds, clearSelection]);

  // ── Queue: nested delete ──
  var handleNestedDelete = useCallback(function(rootId, path, childId) {
    setQueue(function(prev) {
      return prev.concat({
        type: 'nested-delete',
        rootId: rootId,
        path: path,
        ids: [childId]
      });
    });
  }, []);

  // ── Commit ──
  var [committing, setCommitting] = useState(false);

  var handleCommit = useCallback(function() {
    if (queue.length === 0 || !onCommit) return;

    var changeSet = buildChangeSet(data, stagedData, schema, 0);
    if (changeSet.length === 0) {
      setQueue([]);
      return;
    }

    setCommitting(true);
    Promise.resolve(onCommit(changeSet)).then(function() {
      setCommitting(false);
      setQueue([]);
      clearSelection();
    }).catch(function() {
      setCommitting(false);
    });
  }, [queue, data, stagedData, schema, onCommit, clearSelection]);

  // ── Discard ──
  var handleDiscard = useCallback(function() {
    setQueue([]);
    clearSelection();
    setExpandedIds(new Set());
  }, [clearSelection]);

  return {
    hasActions: hasActions, hasSave: hasSave, hasDelete: hasDelete,
    queue: queue, pendingCount: pendingCount, hasPending: hasPending,
    stagedData: stagedData,
    selectedIds: selectedIds, toggleSelect: toggleSelect, toggleSelectAll: toggleSelectAll, clearSelection: clearSelection,
    expandedIds: expandedIds, toggleExpand: toggleExpand,
    detailRow: detailRow, openDetail: openDetail, closeDetail: closeDetail,
    modal: modal,
    openView: openView, openEdit: openEdit, openCopy: openCopy, openAdd: openAdd,
    openNestedView: openNestedView, openNestedEdit: openNestedEdit,
    openNestedCopy: openNestedCopy, openNestedAdd: openNestedAdd,
    closeModal: closeModal, updateField: updateField,
    handleSave: handleSave,
    handleDeleteRow: handleDeleteRow, handleDeleteSelected: handleDeleteSelected,
    handleNestedDelete: handleNestedDelete,
    handleCommit: handleCommit, handleDiscard: handleDiscard, committing: committing,
    schema: schema
  };
}

// ── Helpers ──

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  var clone = {};
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    clone[keys[i]] = deepClone(obj[keys[i]]);
  }
  return clone;
}

function copyChildArrays(from, to) {
  var keys = Object.keys(from);
  for (var i = 0; i < keys.length; i++) {
    if (Array.isArray(from[keys[i]]) && !to[keys[i]]) {
      to[keys[i]] = from[keys[i]];
    }
  }
}

/**
 * Navigate path and apply a save to the target array.
 * path: ['employees'] → obj.employees
 * path: ['employees', 'e6', 'salaries'] → obj.employees[e6].salaries
 */
function applyNestedSave(obj, path, record) {
  var target = navigatePath(obj, path);
  if (!target) return;

  var childId = record._tempId || record.id;
  var found = false;
  for (var i = 0; i < target.length; i++) {
    var existingId = target[i]._tempId || target[i].id;
    if (existingId === childId) {
      // Preserve deeper child arrays
      var updated = Object.assign({}, record);
      copyChildArrays(target[i], updated);
      target[i] = updated;
      found = true;
      break;
    }
  }
  if (!found) {
    target.push(Object.assign({}, record));
  }
}

function applyNestedDelete(obj, path, ids) {
  var arr = navigatePath(obj, path);
  if (!arr) return;

  // Find the parent object that holds this array, and the key
  var parentRef = navigateToParent(obj, path);
  if (!parentRef) return;

  parentRef.obj[parentRef.key] = arr.filter(function(child) {
    var cid = child._tempId || child.id;
    return ids.indexOf(cid) === -1;
  });
}

/**
 * Navigate a path to get the target array.
 * path: ['employees'] → obj.employees
 * path: ['employees', 'e6', 'salaries'] → find e6 in obj.employees, return e6.salaries
 */
function navigatePath(obj, path) {
  var current = obj;
  for (var i = 0; i < path.length; i++) {
    if (i % 2 === 0) {
      // Even index = field name
      current = current[path[i]];
      if (!current) return null;
    } else {
      // Odd index = record id within the array
      var id = path[i];
      var found = null;
      for (var j = 0; j < current.length; j++) {
        if ((current[j]._tempId || current[j].id) === id) {
          found = current[j];
          break;
        }
      }
      if (!found) return null;
      current = found;
    }
  }
  return current;
}

function navigateToParent(obj, path) {
  if (path.length === 1) {
    return { obj: obj, key: path[0] };
  }
  // Navigate to the parent of the final array
  var parentPath = path.slice(0, path.length - 1);
  var parent = navigatePath(obj, parentPath);
  if (!parent) return null;
  return { obj: parent, key: path[path.length - 1] };
}

/**
 * Build an empty record for add form.
 * Derives fields from existing data (all keys from first record) or schema columns.
 */
function buildEmptyRecord(schema, schemaLevel, existingRecords) {
  var empty = { id: '' };
  var schemaDef = schema[schemaLevel];

  // Try to get keys from existing records
  if (existingRecords && existingRecords.length > 0) {
    var keys = Object.keys(existingRecords[0]);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === '_tempId') continue;
      if (Array.isArray(existingRecords[0][k])) {
        empty[k] = [];
      } else {
        empty[k] = '';
      }
    }
  } else if (schemaDef && schemaDef.columns) {
    for (var i = 0; i < schemaDef.columns.length; i++) {
      empty[schemaDef.columns[i].accessor] = '';
    }
  }

  empty.id = '';
  return empty;
}

/**
 * Find the nested array for a given rootId and path in stagedData.
 */
function findNestedArray(stagedData, rootId, path) {
  for (var i = 0; i < stagedData.length; i++) {
    var rid = stagedData[i]._tempId || stagedData[i].id;
    if (rid === rootId) {
      return navigatePath(stagedData[i], path) || [];
    }
  }
  return [];
}
