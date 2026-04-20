import React, { useState } from 'react';
import ChildTable from './ChildTable.jsx';

/**
 * Detail popup — shows parent record fields at top, child tables below.
 * Opened on double-click (or view icon) when childDisplay === 'popup'.
 *
 * @param {object} props
 * @param {object}   props.record        - The parent row (with child arrays)
 * @param {string}   props.rootId        - Row id (or _tempId)
 * @param {object}   props.schema        - Full schema
 * @param {Array}    props.schemaColumns - Level 0 columns for display hints
 * @param {boolean}  props.hasSave       - Whether save is available
 * @param {object}   props.actions       - Actions controller
 * @param {Function} props.onClose       - Close handler
 */
export default function RecordDetail(props) {
  var record = props.record;
  var rootId = props.rootId;
  var schema = props.schema;
  var schemaColumns = props.schemaColumns || [];
  var hasSave = props.hasSave;
  var actions = props.actions;
  var onClose = props.onClose;

  var [editing, setEditing] = useState(false);
  var [editRecord, setEditRecord] = useState(null);

  // Build column lookup for display hints
  var columnMap = {};
  for (var i = 0; i < schemaColumns.length; i++) {
    columnMap[schemaColumns[i].accessor] = schemaColumns[i];
  }

  // Collect child keys from schema
  var childKeys = [];
  var level = 1;
  while (schema[level]) {
    if (level === 1) childKeys.push(schema[level].key);
    level++;
  }

  // Derive display fields from record (exclude arrays and internal fields)
  var fields = [];
  if (record) {
    var keys = Object.keys(record);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === '_tempId') continue;
      if (Array.isArray(record[k])) continue;
      var col = columnMap[k];
      fields.push({
        accessor: k,
        header: col ? (col.header || k) : k,
        dataType: col ? (col.dataType || 'string') : guessType(record[k])
      });
    }
  }

  function guessType(value) {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'string';
  }

  function getInputType(dataType) {
    switch (dataType) {
      case 'number':  return 'number';
      case 'date':    return 'date';
      case 'boolean': return 'checkbox';
      default:        return 'text';
    }
  }

  function handleStartEdit() {
    setEditing(true);
    setEditRecord(Object.assign({}, record));
  }

  function handleFieldChange(field, value) {
    setEditRecord(function(prev) {
      var updated = Object.assign({}, prev);
      updated[field] = value;
      return updated;
    });
  }

  function handleSaveParent() {
    if (!editRecord) return;
    // Queue the parent edit
    var clean = Object.assign({}, editRecord);
    // Remove child arrays — parent save is own fields only
    for (var i = 0; i < childKeys.length; i++) {
      delete clean[childKeys[i]];
    }

    actions.modal = { mode: 'edit', record: clean, context: { level: 'parent' } };
    // Directly queue via handleSave logic
    if (!clean.id && !clean._tempId) {
      clean._tempId = '__inline_';
    }
    // Push to queue manually
    actions.handleSave.__queueDirect
      ? actions.handleSave.__queueDirect(clean)
      : null;

    // Simpler: open the edit modal which handles queueing
    setEditing(false);
    setEditRecord(null);
  }

  // Actually, simpler approach: use the existing modal flow for parent edits
  function handleEditViaModal() {
    actions.openEdit(record);
  }

  function handleCancelEdit() {
    setEditing(false);
    setEditRecord(null);
  }

  var displayRecord = editing ? editRecord : record;

  return (
    <div className="xeplr-table-modal-overlay" onClick={onClose}>
      <div className="xeplr-table-detail" onClick={function(e) { e.stopPropagation(); }}>
        <div className="xeplr-table-modal-header">
          <span className="xeplr-table-modal-title">Record Detail</span>
          <button type="button" className="xeplr-table-modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="xeplr-table-detail-body">
          {/* ── Parent fields ── */}
          <div className="xeplr-table-detail-fields">
            {fields.map(function(field) {
              var value = displayRecord[field.accessor];
              var inputType = getInputType(field.dataType);
              var isId = field.accessor === 'id';
              var disabled = !editing || isId;

              if (inputType === 'checkbox') {
                return (
                  <div key={field.accessor} className="xeplr-table-detail-field">
                    <span className="xeplr-table-detail-label">{field.header}</span>
                    <input
                      type="checkbox"
                      className="xeplr-table-modal-checkbox"
                      checked={!!value}
                      disabled={disabled}
                      onChange={function(e) { handleFieldChange(field.accessor, e.target.checked); }}
                    />
                  </div>
                );
              }

              return (
                <div key={field.accessor} className="xeplr-table-detail-field">
                  <span className="xeplr-table-detail-label">
                    {field.header}
                    {isId && <span className="xeplr-table-modal-id-badge">ID</span>}
                  </span>
                  {editing ? (
                    <input
                      type={inputType}
                      className="xeplr-table-modal-input"
                      value={value != null ? value : ''}
                      disabled={disabled}
                      onChange={function(e) { handleFieldChange(field.accessor, e.target.value); }}
                    />
                  ) : (
                    <span className="xeplr-table-detail-value">{value != null ? String(value) : '—'}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Parent actions ── */}
          <div className="xeplr-table-detail-actions">
            {!editing && hasSave && (
              <button type="button" className="xeplr-table-modal-btn xeplr-table-modal-btn-primary" onClick={handleEditViaModal}>
                Edit
              </button>
            )}
          </div>

          {/* ── Child tables ── */}
          {childKeys.map(function(ck) {
            var nextLevel = schema[1];
            if (!nextLevel || nextLevel.key !== ck) return null;

            return (
              <div key={ck} className="xeplr-table-detail-children">
                <ChildTable
                  rootId={rootId}
                  path={[ck]}
                  schemaLevel={1}
                  schema={schema}
                  rows={record[ck] || []}
                  actions={actions}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
