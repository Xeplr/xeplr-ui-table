import React, { useState, useCallback, useRef, useLayoutEffect } from 'react';
import { flexRender } from '@tanstack/react-table';
import useTableController from './useTableController.js';
import useActionsController from './useActionsController.js';
import useColumnWidths from './useColumnWidths.js';
import CellZoom from './CellZoom.jsx';
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
 * @param {Array}          [props.sorting]          - Controlled sort state, e.g. [{ id, desc }].
 *   Supplying it hands the ORDER to the host: the table stops sorting the
 *   rows itself and reports header clicks through onSortingChange instead.
 *   Needed wherever the rows are already ordered for a reason the view layer
 *   cannot see — a grouped report's subtotals belong with their group, and a
 *   running total is a statement about the order it was computed in.
 * @param {Function}       [props.onSortingChange]  - Called with the next sort state.
 * @param {boolean}        [props.enableFiltering]  - Default: true
 * @param {boolean}        [props.enablePagination] - Default: true
 * @param {Function}       [props.rowClassName]     - (row) => string|falsy. Extra
 *   CSS class per row, so a host can mark rows that mean something to IT.
 * @param {Function}       [props.toolbarActions]   - (ctx) => ReactNode.
 *   Replaces the toolbar's trailing Clear Filters/Clear Sort buttons. The
 *   handlers are supplied; the presentation is entirely the consumer's, so no
 *   host-specific styling lives in here.
 * @param {Function}       [props.toolbarLeading]   - (ctx) => ReactNode. The
 *   toolbar's LEADING area — the run of empty space before the trailing
 *   actions. The built-in Add/Delete/Commit buttons live there when editing is
 *   enabled, so on a read-only table it is simply blank; this hands that space
 *   to the host for a caption, a count, a status line, whatever it has.
 *
 *   Both slots receive the same context: { rowCount, totalCount, selectedCount,
 *   resetFilters, resetSorting, enableFiltering }. rowCount is what's left
 *   after filtering, totalCount is everything — a table can say "showing 12 of
 *   400" without the host recounting rows it already handed over.
 * @param {string}         [props.columnSizing]     - undefined (default) fills
 *   the container, as a table always has. 'content' instead sizes each column
 *   to its text at the current font, and leaves any width it doesn't need
 *   blank rather than stretching to fill. See columnWidths.js for the rule.
 * @param {Function}       [props.columnText]       - (row, column) => string.
 *   Only used by 'content' sizing, and only worth passing if cells are
 *   formatted: measuring 36260.8 when the screen shows ₹36,260.80 sizes the
 *   column too narrow. Defaults to the raw value.
 * @param {number}         [props.sizingSampleRows] - How many rows content
 *   sizing measures. Default 200 — enough to be right on normal data, cheap
 *   enough to be invisible. Raise it (or pass Infinity) when precision on a
 *   wide dataset is worth the scan; the cost is linear in rows × columns and
 *   is paid once per dataset, not per render or per page.
 * @param {number}         [props.minColumnWidth]   - Default 40
 * @param {number}         [props.maxColumnWidth]   - Default 420. Stops one
 *   long-text column demanding the whole table.
 * @param {*}              [props.sizingKey]        - Changing this re-measures.
 *   Nothing can observe a font change, so a host that restyles the table
 *   (a compact theme, a different type scale) signals it here.
 * @param {object}         [props.columnWidths]     - { columnIndex: percent }.
 *   Explicit widths for individual columns, as a PERCENTAGE of the width the
 *   columns have to divide (so two columns at 50 fill the table exactly, with
 *   or without a checkbox column in front of them). Those columns are held at
 *   that share, never measured, and never squeezed; the rest divide whatever
 *   is left. Percent rather than px so a pin keeps its proportion when the
 *   container resizes — a widget on a dashboard is resized constantly. Keyed by
 *   INDEX because a generated column's key is data — a pivot's `Q3 · Sum`
 *   becomes `Q4 · Sum` on the next refresh, and a width keyed to it would be
 *   lost by a plain reload. Position is what the width actually belongs to.
 *   Only used by 'content' sizing.
 * @param {Function}       [props.columnClassName]  - (column, index) => string|falsy.
 *   Extra CSS class for one column, applied to its header AND every body cell,
 *   so a marked column reads as one thing down the table rather than stopping
 *   at the label. `index` is the same leaf index columnWidths uses, so a host
 *   that pins column 3 marks column 3 without a second way of naming it.
 * @param {Function}       [props.onHeaderClick]    - (columnKey, isGroupHeader)
 *   => void. TAKES OVER the header click, replacing sorting rather than sharing
 *   with it: a host that wants the click for selecting a column would otherwise
 *   get a sort it never asked for on every selection. Hosts that use this are
 *   expected to offer sorting elsewhere.
 * @param {Function}       [props.onColumnSizing]   - Receives the full sizing
 *   record — per column: natural width, floor, assigned width, and WHY. For
 *   hosts that need to explain a width back to a user.
 * @param {boolean}        [props.cellZoom]         - Double-click a cell to
 *   pop it out enlarged, for reading a small or long value. A reading aid, so
 *   hosts generally enable it on read-only views and leave it off while
 *   editing. Takes over the double-click gesture, so it is ignored when
 *   childDisplay is 'popup' (there, double-click already opens the record).
 * @param {Function}       [props.cellStyle]        - ({ row, rowIndex,
 *   columnKey, value }) => style object | null. Applied per cell, on top of
 *   any conditional formatting from the schema. The host decides WHERE the
 *   style comes from (theme, saved overrides); tableStyles.js is exported to
 *   resolve those layers, but this component only applies what it's handed.
 *   Its presence also switches the table to separated borders — see the CSS.
 * @param {Function}       [props.headerStyle]      - ({ columnKey, isGroupHeader,
 *   depth }) => style object | null. The header's counterpart to cellStyle,
 *   and it exists for the same reason: a host that can style every row band
 *   but not the header can restyle a table into something the header no
 *   longer belongs to. Resolved by the host from the same vocabulary
 *   (tableStyles.js); this component only applies what it's handed.
 * @param {string}         [props.className]        - Additional CSS class
 * @param {Function}       [props.onCommit]         - async (changeSet[]) => void
 * @param {Array<{key: string, label: string, icon?: any, onClick: (row) => void,
 *   visible?: (row) => boolean, disabled?: (row) => boolean, variant?: string}>} [props.rowActions]
 *   - Custom per-row action buttons (e.g. Rollback, Delete), replacing the built-in
 *     view/copy/edit/delete set. Fires immediately via each action's onClick — works
 *     standalone, without onCommit.
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
    // Controlled sorting, when the host owns the order — see
    // useTableController. Passing `sorting` is what switches it on; the
    // header still reads and clicks exactly as before.
    sorting: props.sorting,
    onSortingChange: props.onSortingChange,
    enableFiltering: props.enableFiltering,
    enablePagination: props.enablePagination
  });

  var enableFiltering = props.enableFiltering !== false;
  var enablePagination = props.enablePagination !== false;
  var headerGroups = table.getHeaderGroups();
  var rows = table.getRowModel().rows;

  // A consumer that wants a frozen header opts in with its own CSS
  // (`position: sticky; top: 0` on .xeplr-table-th) — this component has no
  // opinion on whether stickiness is on. What it DOES have to get right,
  // once it opts in, is WHERE each row sticks: a single-row header can
  // hardcode top:0 and be done, but a grouped one (a pivoted date over its
  // measures) has a SECOND row that also needs to freeze, directly below
  // the first — and it doesn't know that row's height in advance, because
  // that depends on the font/theme/padding a THEME sets, not anything this
  // component controls. Measured after layout and set as an inline `top`
  // per row, which wins over a consumer's blanket `top: 0` by specificity —
  // row 0 keeps top:0 (same value, so nothing changes there), every row
  // below it gets pushed down by the actual height of the rows above it.
  // A no-op for every table that has exactly one header row (offsets[0] is
  // always 0) and for every table that never opts into sticky at all (an
  // inline `top` with no `position: sticky` does nothing).
  var headerRowRefs = useRef([]);
  var [stickyTops, setStickyTops] = useState([]);
  useLayoutEffect(function() {
    var heights = headerRowRefs.current.slice(0, headerGroups.length).map(function(el) {
      return el ? el.offsetHeight : 0;
    });
    var offsets = [];
    var acc = 0;
    for (var i = 0; i < heights.length; i++) {
      offsets.push(acc);
      acc += heights[i];
    }
    setStickyTops(offsets);
  }, [headerGroups.length]);

  function getRowId(row) {
    return row._tempId || row.id;
  }

  var visibleIds = rows.map(function(row) { return getRowId(row.original); });
  var allSelected = visibleIds.length > 0 && visibleIds.every(function(id) { return actions.selectedIds.has(id); });

  // Show expand column only in inner mode
  var showExpandCol = hasChildren && useInner;

  var hasRowActions = actions.hasActions || !!(props.rowActions && props.rowActions.length > 0);

  // Content sizing measures the whole dataset's first N rows, not the current
  // page — otherwise every page turn would re-measure and the columns would
  // visibly jump.
  var widths = useColumnWidths({
    enabled: props.columnSizing === 'content',
    data: props.data,
    columns: columns,
    columnText: props.columnText,
    sizingKey: props.sizingKey,
    columnWidths: props.columnWidths,
    onSizing: props.onColumnSizing,
    sampleRows: props.sizingSampleRows,
    minColumnWidth: props.minColumnWidth,
    maxColumnWidth: props.maxColumnWidth
  });
  var sizing = widths.sizing;

  // PER-COLUMN CLASS, resolved by leaf index — the same index `columnWidths`
  // uses, so a host that pins column 3 highlights column 3 without a second
  // way of naming it. Header and body share one answer: a selected column is
  // selected all the way down, or the highlight stops at the header and the
  // thing being resized looks like just a label.
  var columnClassName = props.columnClassName;
  var classForColumn = useCallback(function(accessor) {
    if (!columnClassName) return '';
    var index = columns.findIndex(function(c) { return c.accessor === accessor; });
    if (index < 0) return '';
    return columnClassName(columns[index], index) || '';
  }, [columnClassName, columns]);

  // Zoom is addressed by row+column id rather than by holding the cell object,
  // so paging, sorting or a refresh can't leave a stale cell open — the lookup
  // below simply stops finding it and the box closes.
  var [zoom, setZoom] = useState(null);
  var closeZoom = useCallback(function() { setZoom(null); }, []);
  var cellZoom = !!props.cellZoom && !usePopup;

  // One context for both toolbar slots.
  var toolbarContext = {
    rowCount: table.getFilteredRowModel().rows.length,
    totalCount: (props.data || []).length,
    selectedCount: actions.selectedIds.size,
    resetFilters: resetFilters,
    resetSorting: resetSorting,
    enableFiltering: enableFiltering
  };

  var totalColumns = headerGroups[0]?.headers.length || 1;
  if (showExpandCol) totalColumns++;
  if (actions.hasDelete) totalColumns++;
  if (hasRowActions) totalColumns++;

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

  // Resolved fresh each render: if the row has paged, sorted or filtered away,
  // there is nothing to find and the box simply isn't rendered.
  var zoomCell = null;
  if (cellZoom && zoom) {
    var zoomRow = rows.find(function(r) { return r.id === zoom.rowId; });
    if (zoomRow) {
      zoomCell = zoomRow.getVisibleCells().find(function(c) { return c.column.id === zoom.columnId; }) || null;
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
        {/* Rendered AFTER the built-in buttons: those are driven by the
            table's own behaviour (there is a pending commit, rows are
            selected) and a host slot shouldn't be able to displace them. */}
        {props.toolbarLeading && props.toolbarLeading(toolbarContext)}

        <div className="xeplr-table-toolbar-spacer" />
        {/* The toolbar's trailing actions. A consumer can replace them
            entirely by passing `toolbarActions` — it receives the behaviour
            (the reset handlers) and returns whatever presentation it wants.
            The library owns what the buttons DO; how they look, and whether
            they're text or icons or sit beside other controls, is the
            consumer's business, not something this component should carry an
            opinion about. */}
        {props.toolbarActions
          ? props.toolbarActions(toolbarContext)
          : (
            <>
              {enableFiltering && (
                <button type="button" className="xeplr-table-toolbar-btn" onClick={resetFilters}>
                  Clear Filters
                </button>
              )}
              <button type="button" className="xeplr-table-toolbar-btn" onClick={resetSorting}>
                Clear Sort
              </button>
            </>
          )}
      </div>

      <div className="xeplr-table-scroll" ref={widths.scrollRef}>
        {/* When sized to content the table stops at the width it needs; the
            container's own background fills the rest. No filler cells, so row
            styling (banding, selection, host row classes) ends cleanly at the
            table edge instead of being stretched across empty space. */}
        <table
          ref={widths.tableRef}
          className={'xeplr-table' + (sizing ? ' xeplr-table-sized' : '') + (props.cellStyle ? ' xeplr-table-styled' : '')}
          style={sizing ? { width: sizing.tableWidth + 'px' } : undefined}
        >
          {sizing && (
            <colgroup>
              {showExpandCol && <col style={{ width: (sizing.extraWidths.expand || 36) + 'px' }} />}
              {actions.hasDelete && <col style={{ width: (sizing.extraWidths.checkbox || 40) + 'px' }} />}
              {sizing.widths.map(function(width, i) {
                return <col key={columns[i] ? columns[i].accessor : i} style={{ width: width + 'px' }} />;
              })}
              {hasRowActions && <col style={{ width: (sizing.extraWidths.actions || 80) + 'px' }} />}
            </colgroup>
          )}
          <thead>
            {headerGroups.map(function(headerGroup, rowIndex) {
              // Every cell in a header row that ISN'T the last one needs the
              // divider under it, not just the ones that happen to be real
              // groups — otherwise the line drawn under "2025-05-01" simply
              // stops where a plain (never-grouped) column like Category
              // Name sits beside it, and a divider that quits partway across
              // reads as broken, not as "this column has nothing under it."
              var isNotLastHeaderRow = rowIndex < headerGroups.length - 1;
              var stickyTop = stickyTops[rowIndex] || 0;
              return (
                <tr key={headerGroup.id} ref={function(el) { headerRowRefs.current[rowIndex] = el; }}>
                  {showExpandCol && <th className="xeplr-table-th xeplr-table-th-expand" style={{ top: stickyTop }} />}
                  {actions.hasDelete && (
                    <th className="xeplr-table-th xeplr-table-th-checkbox" style={{ top: stickyTop }}>
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
                    // A REAL group column (built via columnHelper.group, e.g.
                    // a pivoted date) carries its child column defs on
                    // header.column.columns. header.subHeaders.length > 0 is
                    // NOT this check — TanStack also pads every OTHER
                    // top-level column to the same depth with a placeholder
                    // header the moment ANY column in the table is grouped,
                    // and that placeholder reports subHeaders too, which
                    // would misclassify a plain ungrouped column (Category
                    // here) as a group and center/border its empty top cell.
                    var isGroupHeader = Boolean(header.column.columns && header.column.columns.length);
                    // The FIRST/LAST column under a group is where that
                    // group's own block actually begins/ends — that edge
                    // gets the heavy boundary, carried down through the data
                    // rows too. The group header cell itself spans the whole
                    // block by definition (that's what colSpan means), so
                    // its own left/right edges are always both boundaries.
                    var parentCols = header.column.parent && header.column.parent.columns;
                    var isGroupStart = isGroupHeader || (parentCols ? parentCols[0].id === header.column.id : false);
                    var isGroupEnd = isGroupHeader || (parentCols ? parentCols[parentCols.length - 1].id === header.column.id : false);
                    var colClass = isGroupHeader ? '' : classForColumn(header.column.id);
                    var thClass = 'xeplr-table-th' +
                      (colClass ? ' ' + colClass : '') +
                      (isGroupHeader ? ' xeplr-table-th-group' : '') +
                      (isNotLastHeaderRow ? ' xeplr-table-th-row-divider' : '') +
                      (isGroupStart ? ' xeplr-table-th-group-start' : '') +
                      (isGroupEnd ? ' xeplr-table-th-group-end' : '');

                    return (
                      // colSpan defaults to 1 for a flat leaf column — every
                      // table that never nests columns renders exactly as
                      // before. It only widens for a GROUP header (a pivoted
                      // date spanning the measures under it), which is what
                      // TanStack computed it for.
                      <th key={header.id} colSpan={header.colSpan} className={thClass}
                        // The host's header style sits UNDER `top`, so a
                        // sticky header stays stuck whatever it is styled with.
                        style={Object.assign(
                          {},
                          props.headerStyle
                            ? props.headerStyle({ columnKey: header.column.id, isGroupHeader: isGroupHeader, depth: header.depth })
                            : null,
                          { top: stickyTop }
                        )}>
                        <div className="xeplr-table-header-cell">
                          {/* onHeaderClick TAKES THE GESTURE. A host that wants
                              the click for something else (selecting a column to
                              resize) gets it outright rather than having to fight
                              the sort handler — two things on one click is how you
                              get a sort nobody asked for on every selection. */}
                          <span
                            className={'xeplr-table-header-label' +
                              (props.onHeaderClick ? ' clickable' : (canSort ? ' sortable' : ''))}
                            onClick={props.onHeaderClick
                              ? function() { props.onHeaderClick(header.column.id, isGroupHeader); }
                              : (canSort ? header.column.getToggleSortingHandler() : undefined)}
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
                  {hasRowActions && (
                    <th className="xeplr-table-th xeplr-table-th-actions" style={{ top: stickyTop }}>
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
              // Consumer-supplied per-row class. Lets a host mark rows that
              // mean something to IT without this component needing to know
              // what those categories are, or that they exist.
              if (props.rowClassName) {
                var extraClass = props.rowClassName(original);
                if (extraClass) rowClass += ' ' + extraClass;
              }
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
                    // Host-supplied styling wins over the schema's conditional
                    // formatting: the conditional rule is a default the report
                    // author set once, the override is what they just chose.
                    var hostStyle = props.cellStyle
                      ? props.cellStyle({ row: row.original, rowIndex: row.index,
                          columnKey: cell.column.id, value: cell.getValue() })
                      : null;
                    var tdStyle = condStyle || hostStyle
                      ? Object.assign({}, condStyle, hostStyle) : undefined;
                    // Same boundary the header drew for this column — so a
                    // group's divider is one continuous line down the table,
                    // not a border that stops after the header row.
                    var cellParentCols = cell.column.parent && cell.column.parent.columns;
                    var tdColClass = classForColumn(cell.column.id);
                    var tdClass = 'xeplr-table-td' +
                      (tdColClass ? ' ' + tdColClass : '') +
                      (cellParentCols && cellParentCols[0].id === cell.column.id ? ' xeplr-table-td-group-start' : '') +
                      (cellParentCols && cellParentCols[cellParentCols.length - 1].id === cell.column.id
                        ? ' xeplr-table-td-group-end' : '');
                    return (
                      <td
                        key={cell.id}
                        className={tdClass}
                        style={tdStyle}
                        onDoubleClick={cellZoom ? function(e) {
                          // Stopped so the row's own double-click handler
                          // doesn't also fire — the gesture belongs to the cell.
                          e.stopPropagation();
                          // The cell's own font travels with it, so the box
                          // scales off THIS cell's size rather than the
                          // container's — a compact theme zooms proportionally
                          // instead of jumping to some fixed size.
                          var cellStyle = window.getComputedStyle(e.currentTarget);
                          setZoom({
                            rowId: row.id,
                            columnId: cell.column.id,
                            rect: e.currentTarget.getBoundingClientRect(),
                            font: { fontSize: cellStyle.fontSize, fontFamily: cellStyle.fontFamily }
                          });
                        } : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                  {hasRowActions && (
                    <td className="xeplr-table-td xeplr-table-td-actions">
                      <ActionsCell row={original} hasSave={actions.hasSave} hasDelete={actions.hasDelete}
                        rowActions={props.rowActions}
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
            {[100, 200, 500, 1000].map(function(size) { return <option key={size} value={size}>{size} rows</option>; })}
          </select>
          <span className="xeplr-table-row-count">({table.getFilteredRowModel().rows.length} total)</span>
        </div>
      )}

      {zoomCell && <CellZoom cell={zoomCell} anchorRect={zoom.rect} font={zoom.font} onClose={closeZoom} />}

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
