import React from 'react';
import ActionsCell from './ActionsCell.jsx';
import { resolveCellStyle } from '../resolveCellStyle.js';

/**
 * Recursive nested child table.
 * Renders rows for a child array, with expand support for deeper levels.
 *
 * @param {string} props.rootId       - Level-0 parent id
 * @param {Array}  props.path         - Navigation path from root (e.g. ['employees'])
 * @param {number} props.schemaLevel  - Current schema level (1, 2, ...)
 * @param {object} props.schema       - Full schema object
 * @param {Array}  props.rows         - Child records to display
 * @param {object} props.actions      - Actions controller
 */
export default function ChildTable(props) {
  var rootId = props.rootId;
  var path = props.path;
  var schemaLevel = props.schemaLevel;
  var schema = props.schema;
  var rows = props.rows || [];
  var actions = props.actions;

  var schemaDef = schema[schemaLevel];
  if (!schemaDef) return null;

  var columns = schemaDef.columns || [];
  var header = schemaDef.header || schemaDef.key;

  // Check if there's a deeper level
  var nextLevel = schema[schemaLevel + 1];
  var nextChildKey = nextLevel ? nextLevel.key : null;

  function getChildId(child) {
    return child._tempId || child.id;
  }

  return (
    <div className="xeplr-table-child-container">
      <div className="xeplr-table-child-header">
        <span className="xeplr-table-child-title">{header}</span>
        {actions.hasSave && (
          <button
            type="button"
            className="xeplr-table-toolbar-btn xeplr-table-toolbar-btn-add xeplr-table-child-add"
            onClick={function() { actions.openNestedAdd(rootId, path, schemaLevel); }}
          >
            + Add
          </button>
        )}
      </div>
      <table className="xeplr-table xeplr-table-child">
        <thead>
          <tr>
            {nextChildKey && <th className="xeplr-table-th xeplr-table-th-expand" />}
            {columns.map(function(col) {
              return (
                <th key={col.accessor} className="xeplr-table-th">
                  <div className="xeplr-table-header-cell">
                    <span className="xeplr-table-header-label">{col.header || col.accessor}</span>
                  </div>
                </th>
              );
            })}
            <th className="xeplr-table-th xeplr-table-th-actions">
              <div className="xeplr-table-header-cell">
                <span className="xeplr-table-header-label">Actions</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="xeplr-table-empty" colSpan={columns.length + (nextChildKey ? 2 : 1)}>
                No {header.toLowerCase()}
              </td>
            </tr>
          )}
          {rows.map(function(child) {
            var childId = getChildId(child);
            var isNew = !!child._tempId;
            var isExpanded = actions.expandedIds.has(childId);

            var rowElements = [];

            rowElements.push(
              <tr key={childId} className={'xeplr-table-row' + (isNew ? ' xeplr-table-row-new' : '')}>
                {nextChildKey && (
                  <td className="xeplr-table-td xeplr-table-td-expand">
                    <button
                      type="button"
                      className={'xeplr-table-expand-btn' + (isExpanded ? ' expanded' : '')}
                      onClick={function() { actions.toggleExpand(childId); }}
                    >
                      ▸
                    </button>
                  </td>
                )}
                {columns.map(function(col) {
                  var value = child[col.accessor];
                  var cellStyleDef = col.cellStyle;
                  var condStyle = cellStyleDef
                    ? resolveCellStyle(value, cellStyleDef, col.accessor, child)
                    : null;

                  var displayValue = value;
                  if (col.cell) {
                    displayValue = col.cell({ getValue: function() { return value; }, row: { original: child } });
                  } else {
                    displayValue = value != null ? String(value) : '';
                  }

                  return (
                    <td key={col.accessor} className="xeplr-table-td" style={condStyle}>
                      {displayValue}
                    </td>
                  );
                })}
                <td className="xeplr-table-td xeplr-table-td-actions">
                  <ActionsCell
                    row={child}
                    hasSave={actions.hasSave}
                    hasDelete={actions.hasDelete}
                    onView={function() { actions.openNestedView(rootId, path, child); }}
                    onCopy={function() { actions.openNestedCopy(rootId, path, child); }}
                    onEdit={function() { actions.openNestedEdit(rootId, path, child); }}
                    onDelete={function() { actions.handleNestedDelete(rootId, path, childId); }}
                  />
                </td>
              </tr>
            );

            // Expanded sub-children (recursive)
            if (isExpanded && nextChildKey) {
              var subPath = path.concat([childId, nextChildKey]);
              rowElements.push(
                <tr key={childId + '-children'} className="xeplr-table-row-expanded">
                  <td colSpan={columns.length + 2} className="xeplr-table-td-expanded">
                    <ChildTable
                      rootId={rootId}
                      path={subPath}
                      schemaLevel={schemaLevel + 1}
                      schema={schema}
                      rows={child[nextChildKey] || []}
                      actions={actions}
                    />
                  </td>
                </tr>
              );
            }

            return rowElements;
          })}
        </tbody>
      </table>
    </div>
  );
}
