# @xeplr/ui-table — map

`XeplrTable`: one React data grid on TanStack Table v8 — type-detected filters, sorting, paging, nested child tables,
staged add/edit/delete committed as a changeset, conditional styles, renderers, content-sized and windowed columns.
Used by BI (result tables, widgets), `@xeplr/ui-utils` import screens and generated apps. Not split into
`designs/`/`pages.js` like other UI libs: the view is `XeplrTable.jsx` itself and there is no design-validation layer.
Props/schema: see README → Props, Schema, Editing.

## Where things are
- `src/index.js` — public exports (component, hooks, filters, actions parts, models).
- `src/XeplrTable.jsx` — the component (default) + `CHILD_DISPLAY` (`popup`|`inner`); toolbar, header, body, pinned rows,
  filter popovers, modals; wires the three hooks below. Imports `xeplr-table.css`.
- `src/useTableController.js` — controller: TanStack column defs from `schema[0].columns` (groups via `flattenLeaves`),
  `detectTypes`, `filterFnMap` per type, renderers, controlled `sorting`, `pinBottomRows`. Returns `{table, detectedTypes, resetFilters, resetSorting}`.
- `src/useActionsController.js` — controller: edit queue (`save`/`delete`/`nested-save`/`nested-delete`), `stagedData`,
  temp ids `__new_N`, modal/detail place in the URL via `useUrlState` (`@xeplr/ui-utils/src/url/useUrlState.js`), commit via `buildChangeSet`.
- `src/tableUrlState.js` — pure URL half: `tableUrlKeys(urlKey)` → `<key>Row`/`<key>Edit`, `rowKey`, `encodeModal`/`decodeModal`, `resolvePlace`.
- `src/buildChangeSet.js` — `buildChangeSet(original, staged, schema, level)`: the diff passed to `onCommit`.
- `src/detectTypes.js` — `detectTypes()`, `TYPES` (sample ≤100 rows).
- `src/operators.js` — `resolve` (exported `resolveOperator`), `resolveString/Number/Date`, `isNullish`: shared comparisons.
- `src/resolveCellStyle.js` — conditional formatting rules → style. `src/tableStyles.js` — `STYLE_GROUPS`, `resolveStyle`,
  `toCssProperties`, `resolveCellCss` (theme → overrides layers for a host style panel).
- `src/useColumnWidths.js` + `src/columnWidths.js` — canvas text measuring, `measureColumnDemand`, `allocateColumnWidths`, `resolvePercentWidths`.
- `src/columnWindow.js` — `shouldWindowColumns` (≥`COLUMN_WINDOW_THRESHOLD` 60 leaves), `columnWindow`, `windowHeaders`.
- `src/filters/` — `StringFilter.jsx` (+ `stringSelection.js`: `toggleSelection`, `passesString`, `NONE`), `NumberFilter.jsx`,
  `DateFilter.jsx`, `BooleanFilter.jsx` (each exports its `*FilterFn`), `FilterWrapper.jsx` (portal popover).
- `src/actions/` — `ActionsCell.jsx`, `RecordModal.jsx` (view/edit/add/copy), `RecordDetail.jsx`, `ChildTable.jsx`.
- `src/renderers/` — `index.js` registry (`avatarName`, `tags`, `currency`, `memberChips`, `twoLine`, `statusBadge`,
  `dateDisplay`, `link`, `trend`), `_helpers.js`. `src/trend.js` — `trendOf`, `trendLook`, `TREND_COLORS`.
- `src/CellZoom.jsx` (enlarged cell overlay), `src/pinRows.js` (`bottomRowIds`), `src/pageSizes.js` (`pageSizeOptions`: 100/200/500/1000).
- `src/xeplr-table.css` — all `xeplr-table-*` classes. `demo/` — standalone Vite app, own package.json.

## Flow
`<XeplrTable data schema onCommit urlKey>` → `useActionsController` (queue → `stagedData`) → `useTableController`
(columns + types + filters over staged data when `onCommit` is set, else raw `data`) → `useColumnWidths` →
`columnWindow` (wide tables) → render rows; cell styles via `resolveCellStyle`; Save → `buildChangeSet()` → `props.onCommit(changeSet)`.

## To change X, edit Y
- A new column option from `schema` → `useTableController.js` (column def `build`); its rendering → `XeplrTable.jsx`.
- A new filter type/operator → `filters/<Type>Filter.jsx` + `filterFnMap` in `useTableController.js` + `filterComponentMap` in `XeplrTable.jsx`; comparisons → `operators.js`.
- Type detection rules → `detectTypes.js` → `detectSingle()`.
- What `onCommit` receives → `buildChangeSet.js`; staging/queue → `useActionsController.js` (`applyNestedSave`, `buildEmptyRecord`).
- Which modal/row a link reopens → `tableUrlState.js` + `useActionsController.js` (`urlKey`).
- A new cell renderer → `renderers/<name>.jsx` + register in `renderers/index.js` + export in `src/index.js`.
- Conditional formatting sentences → `resolveCellStyle.js`. Host style panel vocabulary → `tableStyles.js`.
- Auto widths → `columnWidths.js` (math) / `useColumnWidths.js` (measuring, `DEFAULTS`). Windowing threshold → `columnWindow.js`.
- Page size choices → `pageSizes.js`. Grand-total rows → `pinRows.js` + `pinBottomRows` prop.
- Look → `xeplr-table.css` (keep `xeplr-table-*` names).

## Rules and traps
- Row identity is `_tempId` else `id` (`rowKey`); `stagedData` keys rows by `id`, so rows without `id` collide.
- Without `urlKey` modal/detail state stays in memory; with it the URL holds only ids/mode/path, rows are re-found after load.
- `onCommit` is what switches actions on (`hasActions`); without it the table is read-only and shows `props.data` directly.
- Child level is `schema[1].key`; `childDisplay` picks popup vs inner rows.
- Imports `@xeplr/ui-utils/src/url/*` by deep path (a dependency), while `@xeplr/ui-utils` peer-depends on this package — a cycle; bump both together.
- `react-router-dom` is a required peer because `useActionsController` always calls `useUrlState` (works without a router via in-memory fallback).

## Test
- `npm test` = `for f in test/*.test.js; do node "$f" || exit 1; done`; needs `npm install` (react, react-dom,
  react-router-dom, @tanstack/react-table, @xeplr/ui-utils resolvable). No env, no server.
- `actionsUrlState.test.js` renders `useActionsController` with `react-dom/server` under a `MemoryRouter`; `tableUrlState`,
  `buildChangeSet`, `columnWidths`, `columnWindow`, `pageSizes`, `pinRows`, `resolveCellStyle`, `stringSelection`,
  `tableStyles`, `trend` test their modules. `useActionsController.test.js` tests local copies of the queue logic, not `src/`.
