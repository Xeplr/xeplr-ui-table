import React from 'react';
import { flexRender } from '@tanstack/react-table';
import useTableController from './useTableController.js';
import useActionsController from './useActionsController.js';
import { TYPES } from './detectTypes.js';
import StringFilter from './filters/StringFilter.jsx';
import NumberFilter from './filters/NumberFilter.jsx';
import DateFilter from './filters/DateFilter.jsx';
import BooleanFilter from './filters/BooleanFilter.jsx';
import ActionsCell from './actions/ActionsCell.jsx';
import ChildTable from './actions/ChildTable.jsx';
import RecordModal from './actions/RecordModal.jsx';
import RecordDetail from './actions/RecordDetail.jsx';
import { resolveCellStyle } from './resolveCellStyle.js';
import './xeplr-table.css';

var filterComponentMap = {
  [TYPES.STRING]: StringFilter,
  [TYPES.NUMBER]: NumberFilter,
  [TYPES.DATE]: DateFilter,
  [TYPES.BOOLEAN]: BooleanFilter
};

/**
 * childDisplay enum:
 *   'popup' (default) — double-click row opens detail popup with children inside
 *   'inner'           — expand arrow shows children inline below the row
 */
var CHILD_DISPLAY = { POPUP: 'popup', INNER: 'inner' };

/**
 * Main table component.
 *
 * @param {object} props
 * @param {Array<object>}  props.data              - Row array
 * @param {object}         props.schema            - { 0: { key, columns }, 1: { key, columns }, ... }
 * @param {string}         [props.childDisplay]    - 'popup' (default) | 'inner'
 * @param {number}         [props.pageSize]        - Default: 20
 * @param {boolean}        [props.enableSorting]    - Default: true
 * @param {boolean}        [props.enableFiltering]  - Default: true
 * @param {boolean}        [props.enablePagination] - Default: true
 * @param {string}         [props.className]        - Additional CSS class
 * @param {Function}       [props.onCommit]         - async (changeSet[]) => void
 */
export default function XeplrTable(props) {
  var schema = props.schema || {};
  var level0 = schema[0] || {};
  var columns = level0.columns || [];
  var nextLevel = schema[1];
  var childKey = nextLevel ? nextLevel.key : null;
  var hasChildren = !!childKey;
  var childDisplay = props.childDisplay || CHILD_DISPLAY.POPUP;
  var useInner = childDisplay === CHILD_DISPLAY.INNER;
  var usePopup = hasChildren && !useInner;

  var actions = useActionsController({
    onCommit: props.onCommit,
    schema: schema,
    data: props.data
  });

  var { table, detectedTypes, resetFilters, resetSorting } = useTableController({
    data: actions.hasActions ? actions.stagedData : props.data,
    columns: columns,
    minDetectionRows: props.minDetectionRows,
    pageSize: props.pageSize,
    enableSorting: props.enableSorting,
    enableFiltering: props.enableFiltering,
    enablePagination: props.enablePagination
  });

  var enableFiltering = props.enableFiltering !== false;
  var enablePagination = props.enablePagination !== false;

  var headerGroups = table.getHeaderGroups();
  var rows = table.getRowModel().rows;

  function getRowId(row) {
    return row._tempId || row.id;
  }

  var visibleIds = rows.map(function(row) { return getRowId(row.original); });
  var allSelected = visibleIds.length > 0 && visibleIds.every(function(id) { return actions.selectedIds.has(id); });

  // Show expand column only in inner mode
  var showExpandCol = hasChildren && useInner;

  var totalColumns = headerGroups[0]?.headers.length || 1;
  if (showExpandCol) totalColumns++;
  if (actions.hasDelete) totalColumns++;
  if (actions.hasActions) totalColumns++;

  // Resolve modal schema columns for form hints
  var modalSchemaColumns = columns;
  if (actions.modal.context && actions.modal.context.level === 'nested' && actions.modal.context.path) {
    var pathChildKeys = actions.modal.context.path.filter(function(_, i) { return i % 2 === 0; });
    var modalLevel = pathChildKeys.length;
    if (schema[modalLevel] && schema[modalLevel].columns) {
      modalSchemaColumns = schema[modalLevel].columns;
    }
  }

  // Double-click handler for popup mode
  function handleRowDoubleClick(original) {
    if (usePopup) {
      actions.openDetail(original);
    }
  }

  return (
    <div className={'xeplr-table-container' + (props.className ? ' ' + props.className : '')}>
      <div className="xeplr-table-toolbar">
        {actions.hasSave && (
          <button type="button" className="xeplr-table-toolbar-btn xeplr-table-toolbar-btn-add" onClick={actions.openAdd}>
            + Add New
          </button>
        )}
        {actions.hasDelete && actions.selectedIds.size > 0 && (
          <button type="button" className="xeplr-table-toolbar-btn xeplr-table-toolbar-btn-delete" onClick={actions.handleDeleteSelected}>
            Delete Selected ({actions.selectedIds.size})
          </button>
        )}
        {actions.hasPending && (
          <div className="xeplr-table-toolbar-pending">
            <button
              type="button"
              className="xeplr-table-toolbar-btn xeplr-table-toolbar-btn-commit"
              onClick={actions.handleCommit}
              disabled={actions.committing}
            >
              {actions.committing ? 'Committing...' : 'Commit (' + actions.pendingCount + ')'}
            </button>
            <button
              type="button"
              className="xeplr-table-toolbar-btn xeplr-table-toolbar-btn-discard"
              onClick={actions.handleDiscard}
              disabled={actions.committing}
            >
              Discard
            </button>
          </div>
        )}
        <div className="xeplr-table-toolbar-spacer" />
        {enableFiltering && (
          <button type="button" className="xeplr-table-toolbar-btn" onClick={resetFilters}>
            Clear Filters
          </button>
        )}
        <button type="button" className="xeplr-table-toolbar-btn" onClick={resetSorting}>
          Clear Sort
        </button>
      </div>

      <div className="xeplr-table-scroll">
        <table className="xeplr-table">
          <thead>
            {headerGroups.map(function(headerGroup) {
              return (
                <tr key={headerGroup.id}>
                  {showExpandCol && <th className="xeplr-table-th xeplr-table-th-expand" />}
                  {actions.hasDelete && (
                    <th className="xeplr-table-th xeplr-table-th-checkbox">
                      <input type="checkbox" className="xeplr-table-checkbox" checked={allSelected}
                        onChange={function() { actions.toggleSelectAll(visibleIds); }} />
                    </th>
                  )}
                  {headerGroup.headers.map(function(header) {
                    var canSort = header.column.getCanSort();
                    var sorted = header.column.getIsSorted();
                    var dataType = header.column.columnDef.meta?.dataType || TYPES.STRING;
                    var FilterComponent = filterComponentMap[dataType];
                    var canFilter = header.column.getCanFilter() && enableFiltering;

                    return (
                      <th key={header.id} className="xeplr-table-th">
                        <div className="xeplr-table-header-cell">
                          <span
                            className={'xeplr-table-header-label' + (canSort ? ' sortable' : '')}
                            onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          >
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                            {sorted === 'asc' && <span className="xeplr-table-sort-icon"> ▲</span>}
                            {sorted === 'desc' && <span className="xeplr-table-sort-icon"> ▼</span>}
                          </span>
                          {canFilter && FilterComponent && <FilterComponent column={header.column} />}
                        </div>
                      </th>
                    );
                  })}
                  {actions.hasActions && (
                    <th className="xeplr-table-th xeplr-table-th-actions">
                      <div className="xeplr-table-header-cell">
                        <span className="xeplr-table-header-label">Actions</span>
                      </div>
                    </th>
                  )}
                </tr>
              );
            })}
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="xeplr-table-empty" colSpan={totalColumns}>No data</td>
              </tr>
            )}
            {rows.map(function(row) {
              var original = row.original;
              var rowId = getRowId(original);
              var isSelected = actions.selectedIds.has(rowId);
              var isExpanded = useInner && actions.expandedIds.has(rowId);
              var isNew = !!original._tempId;

              var rowClass = 'xeplr-table-row';
              if (isSelected) rowClass += ' xeplr-table-row-selected';
              if (isNew) rowClass += ' xeplr-table-row-new';
              if (usePopup) rowClass += ' xeplr-table-row-clickable';

              var rowElements = [];

              rowElements.push(
                <tr key={row.id} className={rowClass}
                  onDoubleClick={function() { handleRowDoubleClick(original); }}>
                  {showExpandCol && (
                    <td className="xeplr-table-td xeplr-table-td-expand">
                      <button type="button"
                        className={'xeplr-table-expand-btn' + (isExpanded ? ' expanded' : '')}
                        onClick={function() { actions.toggleExpand(rowId); }}>
                        ▸
                      </button>
                    </td>
                  )}
                  {actions.hasDelete && (
                    <td className="xeplr-table-td xeplr-table-td-checkbox">
                      <input type="checkbox" className="xeplr-table-checkbox" checked={isSelected}
                        onChange={function() { actions.toggleSelect(rowId); }} />
                    </td>
                  )}
                  {row.getVisibleCells().map(function(cell) {
                    var meta = cell.column.columnDef.meta;
                    var cellStyleDef = meta?.cellStyle;
                    var condStyle = cellStyleDef
                      ? resolveCellStyle(cell.getValue(), cellStyleDef, cell.column.id, row.original) : null;
                    return (
                      <td key={cell.id} className="xeplr-table-td" style={condStyle}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                  {actions.hasActions && (
                    <td className="xeplr-table-td xeplr-table-td-actions">
                      <ActionsCell row={original} hasSave={actions.hasSave} hasDelete={actions.hasDelete}
                        onView={function() { usePopup ? actions.openDetail(original) : actions.openView(original); }}
                        onCopy={actions.openCopy} onEdit={actions.openEdit}
                        onDelete={function() { actions.handleDeleteRow(rowId); }} />
                    </td>
                  )}
                </tr>
              );

              // Inner mode: expandable child rows
              if (isExpanded && hasChildren) {
                rowElements.push(
                  <tr key={row.id + '-children'} className="xeplr-table-row-expanded">
                    <td colSpan={totalColumns} className="xeplr-table-td-expanded">
                      <ChildTable
                        rootId={rowId}
                        path={[childKey]}
                        schemaLevel={1}
                        schema={schema}
                        rows={original[childKey] || []}
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

      {enablePagination && (
        <div className="xeplr-table-pagination">
          <button type="button" onClick={function() { table.setPageIndex(0); }} disabled={!table.getCanPreviousPage()}>««</button>
          <button type="button" onClick={function() { table.previousPage(); }} disabled={!table.getCanPreviousPage()}>«</button>
          <span className="xeplr-table-page-info">Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
          <button type="button" onClick={function() { table.nextPage(); }} disabled={!table.getCanNextPage()}>»</button>
          <button type="button" onClick={function() { table.setPageIndex(table.getPageCount() - 1); }} disabled={!table.getCanNextPage()}>»»</button>
          <select className="xeplr-table-page-size" value={table.getState().pagination.pageSize}
            onChange={function(e) { table.setPageSize(Number(e.target.value)); }}>
            {[10, 20, 50, 100].map(function(size) { return <option key={size} value={size}>{size} rows</option>; })}
          </select>
          <span className="xeplr-table-row-count">({table.getFilteredRowModel().rows.length} total)</span>
        </div>
      )}

      {/* Detail popup (childDisplay === 'popup') */}
      {actions.detailRow && usePopup && (
        <RecordDetail
          record={actions.detailRow}
          rootId={getRowId(actions.detailRow)}
          schema={schema}
          schemaColumns={columns}
          hasSave={actions.hasSave}
          actions={actions}
          onClose={actions.closeDetail}
        />
      )}

      {/* Record edit/add modal (works on top of detail popup too) */}
      {actions.modal.mode && (
        <RecordModal
          mode={actions.modal.mode}
          record={actions.modal.record}
          schemaColumns={modalSchemaColumns}
          hasSave={actions.hasSave}
          onFieldChange={actions.updateField}
          onSave={actions.handleSave}
          onEdit={actions.modal.context?.level === 'nested'
            ? function(rec) { actions.openNestedEdit(actions.modal.context.rootId, actions.modal.context.path, rec); }
            : actions.openEdit}
          onClose={actions.closeModal}
        />
      )}
    </div>
  );
}

export { CHILD_DISPLAY };
