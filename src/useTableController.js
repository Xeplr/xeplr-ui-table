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

/**
 * Hook that wires TanStack Table with auto-detected column types and smart filters.
 *
 * @param {object} options
 * @param {Array<object>}  options.data               - Row array
 * @param {Array<object>}  options.columns             - [{ accessor, header, dataType?, cell? }]
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
    var result = detectTypes(data, columns, minDetectionRows);
    detectionRef.current = { types: result.types, confident: result.confident, dataRef: data };
    return result.types;
  }, [data, columns, minDetectionRows]);

  // ── Build TanStack column defs ──
  var tanstackColumns = useMemo(function() {
    return columns.map(function(col) {
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
    });
  }, [columns, detectedTypes]);

  // ── Table state ──
  var [sorting, setSorting] = useState([]);
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
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
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
