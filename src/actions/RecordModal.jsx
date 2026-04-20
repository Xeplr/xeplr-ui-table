import React from 'react';

/**
 * Modal overlay for viewing, editing, or adding a record.
 *
 * Form fields are auto-generated from ALL keys in the record.
 * Schema columns provide display hints (header, dataType) where available.
 * Fields not in schema columns still appear — with the key name as header.
 *
 * @param {object} props
 * @param {string}   props.mode           - 'view' | 'edit' | 'add'
 * @param {object}   props.record         - Current form data
 * @param {Array}    [props.schemaColumns] - Schema column configs for display hints
 * @param {boolean}  props.hasSave        - Whether save action is available
 * @param {Function} props.onFieldChange  - (accessor, value) => void
 * @param {Function} props.onSave         - Save handler
 * @param {Function} props.onEdit         - Switch to edit mode
 * @param {Function} props.onClose        - Close modal
 */
export default function RecordModal(props) {
  var mode = props.mode;
  var record = props.record;
  var schemaColumns = props.schemaColumns || [];
  var hasSave = props.hasSave;
  var onFieldChange = props.onFieldChange;
  var onSave = props.onSave;
  var onEdit = props.onEdit;
  var onClose = props.onClose;

  var isReadOnly = mode === 'view';
  var title = mode === 'view' ? 'View Record' : mode === 'edit' ? 'Edit Record' : 'Add Record';

  // Build column lookup for display hints
  var columnMap = {};
  for (var i = 0; i < schemaColumns.length; i++) {
    columnMap[schemaColumns[i].accessor] = schemaColumns[i];
  }

  // Derive form fields from ALL keys in the record
  var fields = [];
  if (record) {
    var keys = Object.keys(record);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === '_tempId') continue;
      // Skip array fields (those are child tables, not form fields)
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

  function handleSubmit(e) {
    e.preventDefault();
    onSave();
  }

  return (
    <div className="xeplr-table-modal-overlay" onClick={onClose}>
      <div className="xeplr-table-modal" onClick={function(e) { e.stopPropagation(); }}>
        <div className="xeplr-table-modal-header">
          <span className="xeplr-table-modal-title">{title}</span>
          <button type="button" className="xeplr-table-modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form className="xeplr-table-modal-body" onSubmit={handleSubmit}>
          {fields.map(function(field) {
            var value = record[field.accessor];
            var inputType = getInputType(field.dataType);
            var isId = field.accessor === 'id';
            var disabled = isReadOnly || isId;

            if (inputType === 'checkbox') {
              return (
                <div key={field.accessor} className="xeplr-table-modal-field">
                  <label className="xeplr-table-modal-label">{field.header}</label>
                  <input
                    type="checkbox"
                    className="xeplr-table-modal-checkbox"
                    checked={!!value}
                    disabled={disabled}
                    onChange={function(e) { onFieldChange(field.accessor, e.target.checked); }}
                  />
                </div>
              );
            }

            return (
              <div key={field.accessor} className="xeplr-table-modal-field">
                <label className="xeplr-table-modal-label">
                  {field.header}
                  {isId && <span className="xeplr-table-modal-id-badge">ID</span>}
                </label>
                <input
                  type={inputType}
                  className="xeplr-table-modal-input"
                  value={value != null ? value : ''}
                  disabled={disabled}
                  onChange={function(e) { onFieldChange(field.accessor, e.target.value); }}
                />
              </div>
            );
          })}

          <div className="xeplr-table-modal-footer">
            {isReadOnly && hasSave && (
              <button
                type="button"
                className="xeplr-table-modal-btn xeplr-table-modal-btn-primary"
                onClick={function() { onEdit(record); }}
              >
                Edit
              </button>
            )}
            {!isReadOnly && (
              <button
                type="submit"
                className="xeplr-table-modal-btn xeplr-table-modal-btn-primary"
              >
                Save
              </button>
            )}
            <button
              type="button"
              className="xeplr-table-modal-btn"
              onClick={onClose}
            >
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
