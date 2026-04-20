/**
 * Build a sparse deep diff between original and staged data.
 * Recursive — supports N levels of nesting via schema.
 *
 * Rules:
 *   - No id           → new record (include all fields)
 *   - Has id, changed → include id + only changed fields
 *   - Has id, deleted → { id, deleted: true }
 *   - Unchanged       → omitted entirely
 *
 * @param {Array}  originalData - Original data
 * @param {Array}  stagedData   - Staged data after queue applied
 * @param {object} schema       - { 0: { key, columns }, 1: { key, columns }, ... }
 * @param {number} [level]      - Current nesting level (default: 0)
 * @returns {Array} Sparse changeset
 */
export function buildChangeSet(originalData, stagedData, schema, level) {
  level = level || 0;

  // Determine child key from next level in schema
  var nextLevel = schema[level + 1];
  var childKey = nextLevel ? nextLevel.key : null;

  // Collect all child keys at deeper levels rooted under this level
  var childKeys = [];
  var l = level + 1;
  while (schema[l]) {
    if (l === level + 1) childKeys.push(schema[l].key);
    l++;
  }

  var originalMap = new Map();
  for (var i = 0; i < originalData.length; i++) {
    originalMap.set(originalData[i].id, originalData[i]);
  }

  var stagedMap = new Map();
  for (var i = 0; i < stagedData.length; i++) {
    var row = stagedData[i];
    var key = row._tempId || row.id;
    stagedMap.set(key, row);
  }

  var changes = [];

  // ── New and modified records ──
  stagedMap.forEach(function(staged) {
    var isNew = !!staged._tempId || !staged.id;

    if (isNew) {
      changes.push(buildNewRecord(staged, childKey));
    } else {
      var original = originalMap.get(staged.id);
      if (!original) return;

      var fieldDiff = diffFields(original, staged, childKeys);
      var childDiffResult = null;

      if (childKey) {
        var origChildren = original[childKey] || [];
        var stagedChildren = staged[childKey] || [];
        var childChanges = buildChangeSet(origChildren, stagedChildren, schema, level + 1);
        if (childChanges.length > 0) {
          childDiffResult = childChanges;
        }
      }

      if (fieldDiff || childDiffResult) {
        var entry = fieldDiff ? Object.assign({ id: staged.id }, fieldDiff) : { id: staged.id };
        if (childDiffResult) {
          entry[childKey] = childDiffResult;
        }
        changes.push(entry);
      }
    }
  });

  // ── Deleted records ──
  originalMap.forEach(function(original, id) {
    if (!stagedMap.has(id)) {
      changes.push({ id: id, deleted: true });
    }
  });

  return changes;
}

/**
 * Build a new record for the changeset (strip internal fields).
 * Recursively cleans child arrays.
 */
function buildNewRecord(staged, childKey) {
  var rec = {};
  var keys = Object.keys(staged);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k === '_tempId') continue;

    if (k === childKey && Array.isArray(staged[k])) {
      rec[k] = staged[k].map(function(child) {
        return buildNewRecord(child, null);
      });
    } else {
      rec[k] = staged[k];
    }
  }
  return rec;
}

/**
 * Diff own fields (excluding id, _tempId, and child array keys).
 */
function diffFields(original, staged, childKeys) {
  var diff = null;
  var keys = Object.keys(staged);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k === 'id' || k === '_tempId') continue;
    if (childKeys.indexOf(k) !== -1) continue;
    if (staged[k] !== original[k]) {
      if (!diff) diff = {};
      diff[k] = staged[k];
    }
  }
  return diff;
}
