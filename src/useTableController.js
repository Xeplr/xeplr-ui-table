import { useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  createColumnHelper
} from '@tanstack/react-table';
import { detectTypes, TYPES } from './detectTypes.js';
import { stringFilterFn } from './filters/StringFilter.jsx';
import { numberFilterFn } from './filters/NumberFilter.jsx';
import { dateFilterFn } from './filters/DateFilter.jsx';
import { booleanFilterFn } from './filters/BooleanFilter.jsx';
import renderers from './renderers/index.js';

var filterFnMap = {
  [TYPES.STRING]: stringFilterFn,
  [TYPES.NUMBER]: numberFilterFn,
  [TYPES.DATE]: dateFilterFn,
  [TYPES.BOOLEAN]: booleanFilterFn
};

var columnHelper = createColumnHelper();

// A column def may itself be a GROUP — `{ header, columns: [...] }` instead of
// `{ accessor, ... }` — which becomes a spanning header cell over its
// children (a pivoted date over the measures under it), same as Excel merges
// a date across the columns it covers. Optional and recursive: a caller that
// never nests columns gets exactly the flat header it always got.
function flattenLeaves(cols) {
  var out = [];
  for (var i = 0; i < cols.length; i++) {
    var col = cols[i];
    if (col.columns && col.columns.length) out = out.concat(flattenLeaves(col.columns));
    else out.push(col);
  }
  return out;
}

/**
 * Hook that wires TanStack Table with auto-detected column types and smart filters.
 *
 * @param {object} options
 * @param {Array<object>}  options.data               - Row array
 * @param {Array<object>}  options.columns             - [{ accessor, header, dataType?, cell? } | { header, columns: [...] }]
 * @param {number}         [options.minDetectionRows]  - Min samples for confident detection (default: 10)
 * @param {number}         [options.pageSize]           - Rows per page (default: 20)
 * @param {boolean}        [options.enableSorting]       - Default: true
 * @param {boolean}        [options.enableFiltering]     - Default: true
 * @param {boolean}        [options.enablePagination]    - Default: true
 *
 * @returns {{ table, detectedTypes: Map, resetFilters: Function, resetSorting: Function }}
 */
export default function useTableController(options) {
  var data = options.data || [];
  var columns = options.columns || [];
  var minDetectionRows = options.minDetectionRows ?? 10;
  var pageSize = options.pageSize ?? 20;
  var enableSorting = options.enableSorting !== false;
  var enableFiltering = options.enableFiltering !== false;
  var enablePagination = options.enablePagination !== false;

  // ── Type detection with memoization ──
  var detectionRef = useRef({ types: null, confident: false, dataRef: null });

  var detectedTypes = useMemo(function() {
    var cached = detectionRef.current;

    // Reuse cached types if detection was confident and data reference hasn't changed
    if (cached.types && cached.confident && cached.dataRef === data) {
      return cached.types;
    }

    // Reuse if confident even with new data reference (types don't change)
    if (cached.types && cached.confident) {
      return cached.types;
    }

    // Run detection
    // Leaves only — a group column has no accessor and no data of its own to
    // sample, it is purely a spanning header over the columns that do.
    var result = detectTypes(data, flattenLeaves(columns), minDetectionRows);
    detectionRef.current = { types: result.types, confident: result.confident, dataRef: data };
    return result.types;
  }, [data, columns, minDetectionRows]);

  // ── Build TanStack column defs ──
  var tanstackColumns = useMemo(function() {
    function build(col) {
      // A group has no data of its own — column.group() renders it as a
      // spanning header cell (TanStack's own colSpan) over whichever leaf
      // columns are nested under it, and nothing else about those leaves
      // changes: same filters, same sort, same cells they'd have flat.
      if (col.columns && col.columns.length) {
        return columnHelper.group({
          id: col.id || col.header,
          header: col.header,
          columns: col.columns.map(build)
        });
      }

      var type = detectedTypes.get(col.accessor) || TYPES.STRING;
      var filterFn = filterFnMap[type] || stringFilterFn;

      var colDef = {
        header: col.header || col.accessor,
        filterFn: filterFn,
        meta: { dataType: type, cellStyle: col.cellStyle || null },
        enableSorting: col.enableSorting !== false,
        enableColumnFilter: col.enableColumnFilter !== false
      };
      if (col.cell) {
        colDef.cell = col.cell;
      } else if (col.render) {
        var rendererName = typeof col.render === 'string' ? col.render : col.render.type;
        var rendererFn = renderers[rendererName];
        if (!rendererFn) {
          throw new Error('[xeplr-ui-table] Unknown renderer "' + rendererName + '". Available: ' + Object.keys(renderers).join(', '));
        }
        var rendererConfig = typeof col.render === 'string' ? {} : col.render;
        colDef.cell = rendererFn(rendererConfig);
      }
      return columnHelper.accessor(col.accessor, colDef);
    }
    return columns.map(build);
  }, [columns, detectedTypes]);

  // ── Table state ──
  //
  // Sorting can be CONTROLLED by the host. Uncontrolled is the default and is
  // what a plain data grid wants: click a header, the table reorders itself.
  //
  // A host takes it over when the ordering is not the table's to decide.
  // A grouped report is the case that forces it — its rows carry subtotals
  // that must stay with their group, and columns whose values are derived
  // from the row above them. Re-sorting such a result in the view layer
  // scatters the subtotals and leaves every running total describing an order
  // that is no longer on screen. So the host supplies the order and takes the
  // header click as an instruction, which is what `manualSorting` means to
  // TanStack: "already sorted, do not sort it again".
  var controlledSorting = options.sorting !== undefined;
  var [ownSorting, setOwnSorting] = useState([]);
  var sorting = controlledSorting ? options.sorting : ownSorting;
  var setSorting = function (updater) {
    var next = typeof updater === 'function' ? updater(sorting) : updater;
    if (controlledSorting) {
      if (options.onSortingChange) options.onSortingChange(next);
      return;
    }
    setOwnSorting(next);
  };
  var [columnFilters, setColumnFilters] = useState([]);
  var [pagination, setPagination] = useState({ pageIndex: 0, pageSize: pageSize });

  // ── TanStack table instance ──
  var table = useReactTable({
    data: data,
    columns: tanstackColumns,
    state: {
      sorting: sorting,
      columnFilters: columnFilters,
      pagination: pagination
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: enableFiltering ? getFilteredRowModel() : undefined,
    // Not applied when the host controls the order — the rows arrive sorted
    // and sorting them again is both wasted work and, for a grouped result,
    // wrong.
    getSortedRowModel: (enableSorting && !controlledSorting) ? getSortedRowModel() : undefined,
    manualSorting: controlledSorting,
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    enableSorting: enableSorting,
    enableFilters: enableFiltering
  });

  function resetFilters() {
    setColumnFilters([]);
  }

  function resetSorting() {
    setSorting([]);
  }

  return {
    table: table,
    detectedTypes: detectedTypes,
    resetFilters: resetFilters,
    resetSorting: resetSorting
  };
}
