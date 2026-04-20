import React from 'react';

/**
 * Actions cell rendered in the last column of each row.
 * Shows view (always), copy, edit (if onSave), delete (if onDelete).
 */
export default function ActionsCell(props) {
  var row = props.row;
  var hasSave = props.hasSave;
  var hasDelete = props.hasDelete;
  var onView = props.onView;
  var onCopy = props.onCopy;
  var onEdit = props.onEdit;
  var onDelete = props.onDelete;

  return (
    <div className="xeplr-table-actions-cell">
      <button
        type="button"
        className="xeplr-table-action-btn xeplr-table-action-view"
        title="View"
        onClick={function() { onView(row); }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>

      {hasSave && (
        <button
          type="button"
          className="xeplr-table-action-btn xeplr-table-action-copy"
          title="Copy"
          onClick={function() { onCopy(row); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        </button>
      )}

      {hasSave && (
        <button
          type="button"
          className="xeplr-table-action-btn xeplr-table-action-edit"
          title="Edit"
          onClick={function() { onEdit(row); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      )}

      {hasDelete && (
        <button
          type="button"
          className="xeplr-table-action-btn xeplr-table-action-delete"
          title="Delete"
          onClick={function() { onDelete(row.id); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
      )}
    </div>
  );
}
