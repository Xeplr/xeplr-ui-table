# @xeplr/ui-table

**A schema-driven React data table on TanStack Table.** Column types are detected from the data and each gets its own filter; rows sort and paginate; with `onCommit` the table edits, adds and deletes rows — nested children included — and hands back one changeset for a transactional save.

```jsx
import { XeplrTable } from '@xeplr/ui-table'

<XeplrTable
  data={departments}
  schema={{ 0: { key: 'department', columns: [
    { accessor: 'name', header: 'Department' },
    { accessor: 'budget', header: 'Budget', render: { type: 'currency', currency: 'INR' } },
    { accessor: 'isActive', header: 'Active' }
  ] } }}
  onCommit={(changeSet) => api.post('/api/departments/save', changeSet)}
/>
```

The changeset is exactly what [`@xeplr/base-apis`](https://www.npmjs.com/package/@xeplr/base-apis)' `genericRoute` `POST /save` takes.

## How the pieces fit

| what | where |
|---|---|
| The component | `XeplrTable` |
| Sorting, filtering, pagination, type detection | `useTableController` (TanStack wiring) |
| Add / edit / delete staging, selection, commit | `useActionsController` |
| The diff sent to `onCommit` | `buildChangeSet` |
| Conditional cell styles written as sentences | `resolveCellStyle` |
| Declarative cell renderers | `renderers` |
| Style layers → CSS for a host's style panel | `tableStyles` exports |
| Widths sized to content | `useColumnWidths`, `columnWidths` exports |

## Install

```sh
npm i @xeplr/ui-table @tanstack/react-table
```

Peers: `react` 18 or 19, `@tanstack/react-table` 8. Filter panels use `createPortal` from `react-dom`.

The package ships its `src/` as ES modules with JSX and imports its own stylesheet (`xeplr-table.css`), so it needs a bundler that compiles both — Vite does.

## Props

| prop | default | |
|---|---|---|
| `data` | — | row array. Rows need an `id` for editing, selection and the changeset |
| `schema` | — | `{ 0: { key, columns }, 1: { key, columns, header? }, … }` — see below |
| `onCommit` | — | `async (changeSet) => …`. **Omit it and the table is read-only** |
| `rowActions` | — | custom per-row buttons, replacing the built-in set |
| `childDisplay` | `'popup'` | `'popup'` or `'inner'` — how level-1 children show |
| `pageSize` | `20` | initial page size (the page-size menu offers 100, 200, 500, 1000) |
| `enableSorting`, `enableFiltering`, `enablePagination` | `true` | |
| `minDetectionRows` | `10` | non-empty samples a column needs before its detected type is final |
| `sorting`, `onSortingChange` | — | controlled sort (`[{ id, desc }]`) — see Sorting |
| `onHeaderClick` | — | `(columnKey, isGroupHeader)` — **replaces** sort-on-click |
| `toolbarLeading` | — | `(ctx) => node` after the built-in toolbar buttons |
| `toolbarActions` | — | `(ctx) => node` replacing Clear Filters / Clear Sort |
| `rowClassName` | — | `(row) => string` |
| `columnClassName` | — | `(column, index) => string`, applied to the header and every cell of that column |
| `cellStyle` | — | `({ row, rowIndex, columnKey, value }) => style` — on top of the schema's conditional styles |
| `headerStyle` | — | `({ columnKey, isGroupHeader, depth }) => style` |
| `cellZoom` | `false` | double-click a cell to show it enlarged. Ignored when the schema has children shown as `'popup'`, where double-click opens the record |
| `columnSizing` | fill | `'content'` sizes columns to their text |
| `columnText`, `sizingSampleRows` (200), `minColumnWidth` (40), `maxColumnWidth` (420), `columnWidths`, `sizingKey`, `onColumnSizing` | | content sizing — see below |
| `className` | — | added to the container |

Toolbar slots receive `{ rowCount, totalCount, selectedCount, resetFilters, resetSorting, enableFiltering }` — `rowCount` after filtering, `totalCount` before.

## Schema

```js
{
  0: { key: 'department', columns: [...] },     // the rows
  1: { key: 'employees', header: 'Employees', columns: [...] },   // row.employees
  2: { key: 'salaries', columns: [...] }        // each employee's salaries
}
```

Level N+1's `key` is the array property on each level-N row. `header` titles a child table (defaults to `key`).

### Columns

| field | |
|---|---|
| `accessor` | row property — required on a leaf column |
| `header` | title; defaults to `accessor` |
| `dataType` | `'string'`, `'number'`, `'date'` or `'boolean'` — skips detection |
| `render` | `{ type, …config }`, or the renderer name as a string |
| `cell` | TanStack cell function `(ctx) => node`; wins over `render` |
| `cellStyle` | `[{ when, …css }]` or `(value, row) => css` |
| `enableSorting`, `enableColumnFilter` | default `true` |

A column may instead be a **group** — `{ header, id?, columns: [...] }` — rendered as one header cell spanning its children (a pivoted date over its measures). Groups nest; leaves under them sort, filter and render as usual.

An unknown `render` type throws, listing the available ones.

## Column types and filters

Detection samples the first 100 rows, ignoring `null`, `undefined` and `''`. A column is:

1. **boolean** if every value is one of `true false 0 1 '0' '1' 'true' 'false' 'True' 'False' 'TRUE' 'FALSE'`
2. else **number** if every value converts with `Number()`
3. else **date** if every value is a non-numeric string that `Date.parse` accepts
4. else **string**

A column with no samples is a string. Once every column has at least `minDetectionRows` samples, the types are kept for the life of the component.

| type | filter |
|---|---|
| string | searchable checklist of the distinct values, Select All / Clear All, Is Null / Is Not Null |
| number | equals, not equals, `>`, `>=`, `<`, `<=`, between; Is Null / Is Not Null |
| date | equals, not equals, after, on or after, before, on or before, between — compared by calendar day |
| boolean | All / True / False |

Filter panels are portalled to `document.body` so a scrolling table cannot clip them; they close on scroll and resize.

## Sorting

Uncontrolled by default: clicking a header sorts the rows. Pass `sorting` and the table stops sorting itself — header clicks are reported through `onSortingChange` and the rows are shown in the order given. That is for data whose order is not the view's to change: a grouped report's subtotals belong with their group, and a running total describes the order it was computed in.

## Editing

With `onCommit`:

- **+ Add New** opens a form; its fields are the keys of the first row (or the schema columns when there are no rows).
- Each row gets a checkbox, and the Actions column shows **view, copy, edit, delete**. Copy opens Add with the row's values and no id.
- Selected rows: **Delete Selected (n)**.
- Changes are **staged** — the table shows them at once — and counted on **Commit (n)**. **Discard** drops them.
- **Commit** diffs the staged rows against `data` and calls `onCommit(changeSet)`. When it resolves, the stage is cleared; when it rejects, the stage is kept. The table does not update `data` itself — pass the saved rows back in.

Children (a schema with level 1): in `'popup'` mode, double-click or view opens the record with its child tables, which have their own add, edit and delete. In `'inner'` mode an expand arrow shows the child table under the row. Without children, view opens a read-only form.

Without `onCommit` there are no checkboxes, toolbar edit buttons or built-in row actions.

### The changeset

Sparse, nested by child `key`:

```js
[
  { id: 'd1', name: 'Engineering Dept',                    // changed fields only
    employees: [
      { id: '', name: 'New Hire', role: 'Junior' },         // new: every field, no usable id
      { id: 'e2', role: 'Senior' },
      { id: 'e3', deleted: true }
    ] },
  { id: '', name: 'New Department' },
  { id: 'd9', deleted: true }
]
```

| staged row | entry |
|---|---|
| new (no `id`) | all fields, children included; the internal `_tempId` is stripped |
| changed | `id` plus fields whose value is not `===` the original, plus a child array if its children changed |
| removed | `{ id, deleted: true }` |
| unchanged | omitted |

`buildChangeSet(originalData, stagedData, schema)` is exported.

### Row actions

```jsx
rowActions={[
  { key: 'rollback', label: 'Rollback', onClick: (row) => rollback(row.id),
    visible: (row) => row.status === 'done', disabled: (row) => row.locked, variant: 'danger', icon: <UndoIcon /> }
]}
```

Replaces the built-in buttons. Each fires `onClick(row)` immediately — no staging, and `onCommit` is not needed. Button classes: `xeplr-table-action-<key>`, `xeplr-table-action-<variant>`.

## Conditional cell styles

```js
{ accessor: 'status', cellStyle: [
  { when: '$.status is active', backgroundColor: '#1b5e20', color: '#a5d6a7' },
  { when: '$.budget < 100000', backgroundColor: '#bf360c' }
] }
```

Rules are tried in order; **the first match wins** and its keys other than `when` become the inline style. `$.field` reads any field of the row.

| operator | example |
|---|---|
| `is`, `is not` | `$.status is active` |
| `is null`, `is not null` | `$.endDate is null` — `''` counts as null |
| `>`, `<`, `>=`, `<=` | `$.score >= 90` |
| `between … and …` | `$.age between 18 and 65` |
| `in [ … ]`, `not in [ … ]` | `$.region in [north, south]` |
| `starts with`, `ends with`, `contains`, `does not contain` | `$.name starts with 'Jo'` — case-insensitive |

Numeric strings compare as numbers. A host `cellStyle` prop result is merged over this.

## Renderers

`render: { type, …config }`:

| type | config | value |
|---|---|---|
| `twoLine` | `subKey` | text, with `row[subKey]` beneath |
| `avatarName` | `subKey`, `size` (`'md'`), `imgKey`, `imgPrefix` | name with an image (`imgPrefix + row[imgKey]`) or coloured initials |
| `tags` | `variant` (`'gold'`, `'muted'`, `'blue'`), `max` | `string[]` or a comma-separated string; `+N` overflow |
| `currency` | `currency` (`'INR'`), `position` (`'before'` / `'after'`), `decimals` (0), `bold` (true) | number |
| `memberChips` | `max` (3), `nameKey` (`'name'`), `imgKey`, `imgPrefix` | array of objects |
| `statusBadge` | `map: { value: { bg, color, border?, label? } }`, `default` | text |
| `dateDisplay` | `format`: `'date'` (`15 Sep 2026`), `'datetime'`, `'relative'` (`3h ago`, dates after 30 days) | Date or ISO string |
| `link` | `hrefKey` (renders `<a href={row[hrefKey]}>`) and `target`, or `onClick(row)` | text |

Each renderer is `(config) => (ctx) => node`. The `renderers` object is the registry the table reads, so `renderers.myType = (config) => (ctx) => …` adds one.

## Content sizing

`columnSizing="content"` measures each column's text (canvas, at the table's font) over the first `sizingSampleRows` rows of `data` — not the current page, so columns do not jump when paging.

- Everything fits → each column gets its natural width; leftover space stays empty.
- It does not fit → no empty space; every column drops to its floor (its longest word) and the remainder is shared in proportion to what each wanted.
- Not even the floors fit → floors, and the table scrolls horizontally.

`columnWidths: { [leafIndex]: percent }` pins columns to a share of the width the columns divide (after checkbox, expand and actions columns). **By index**, because a pivot's column keys are data and change on refresh. `columnText(row, column)` supplies the displayed text when cells are formatted; `sizingKey` forces a re-measure (a font change cannot be observed); `onColumnSizing` receives each column's natural width, floor, assigned width and reason (`natural`, `shrunk`, `floor`, `pinned`).

## Styling

CSS classes are namespaced `xeplr-table-*` (chrome) and `xeplr-r-*` (renderers). Colours come from `@xeplr/ui-account`'s theme tokens when present (`.xeplr-theme-light` / `.xeplr-theme-dark` on an ancestor), with a dark palette as fallback:

`--xeplr-text-primary`, `--xeplr-text-secondary`, `--xeplr-text-muted`, `--xeplr-bg-secondary`, `--xeplr-bg-tertiary`, `--xeplr-bg-hover`, `--xeplr-bg-active`, `--xeplr-bg-overlay`, `--xeplr-border-primary`, `--xeplr-border-secondary`, `--xeplr-accent`, `--xeplr-accent-hover`, `--xeplr-accent-muted`, `--xeplr-accent-text`, `--xeplr-input-bg`, `--xeplr-input-border`, `--xeplr-input-text`, `--xeplr-tag-bg`, `--xeplr-tag-border`, `--xeplr-tag-text`, `--xeplr-success`, `--xeplr-success-bg`, `--xeplr-warning`, `--xeplr-warning-bg`, `--xeplr-danger`, `--xeplr-danger-bg`, `--xeplr-shadow-lg`, `--xeplr-table-group-border`.

The `gold` / `blue` tag variants and `link` use fixed colours. The header is not sticky by default; add `position: sticky; top: 0` to `.xeplr-table-th` and the table offsets each grouped header row by the real height of the rows above it.

### Style layers for a host panel

`tableStyles.js` is the vocabulary a host builds a style editor from — no React:

| export | |
|---|---|
| `STYLE_GROUPS`, `STYLE_FIELDS`, `styleField(path)` | every stylable property by path: `text.*`, `fill.background`, `box.padding.*`, `box.height`, `border.radius`, `border.{all,top,right,bottom,left}.{width,style,color}` |
| `flattenStyle(style)` | nested → `{ path: value }`, with `border.all` expanded into the sides **inside its own layer** |
| `resolveStyle(layers)` | per property, the higher `rank` wins; equal ranks are decided by the later `at` |
| `toCssProperties(resolved)`, `resolveCellCss(layers)` | → a React style object; a border width without a style becomes `solid` |
| `cssLength(value)` | `12` → `12px`, `{ value, unit }` → `value+unit`, strings unchanged |

There is no margin property: a `<td>` ignores margin.

## Exports

`XeplrTable`, `CHILD_DISPLAY`, `useTableController`, `useActionsController`, `detectTypes`, `TYPES`, `StringFilter` / `stringFilterFn`, `NumberFilter` / `numberFilterFn`, `DateFilter` / `dateFilterFn`, `BooleanFilter` / `booleanFilterFn`, `FilterWrapper`, `ActionsCell`, `RecordModal`, `RecordDetail`, `ChildTable`, `CellZoom`, `buildChangeSet`, `resolveOperator`, `resolveString`, `resolveNumber`, `resolveDate`, `isNullish`, `resolveCellStyle`, `STYLE_GROUPS`, `STYLE_FIELDS`, `BORDER_SIDES`, `styleField`, `cssLength`, `flattenStyle`, `resolveStyle`, `toCssProperties`, `resolveCellCss`, `useColumnWidths`, `measureColumnDemand`, `allocateColumnWidths`, `resolvePercentWidths`, `longestToken`, `WIDTH_NATURAL`, `WIDTH_SHRUNK`, `WIDTH_FLOOR`, `renderers`, `avatarName`, `tags`, `currency`, `memberChips`, `twoLine`, `statusBadge`, `dateDisplay`, `link`.

## Tests

```sh
npm test
```

Plain Node, no browser: changeset building, conditional-style parsing, style-layer resolution, column-width allocation, and the staging logic behind `useActionsController`. A Vite demo lives in `demo/`.

## License

MIT
