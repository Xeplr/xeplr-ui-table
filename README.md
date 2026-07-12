# @xeplr/ui-table

Schema-driven React data table. Sort, filter, paginate, edit, nested children, transactional commits, config-driven cell renderers. Gold-on-dark theme.

(The package name on npm is `@xeplr/ui-table` — the GitHub repo and folder are named `xeplr-ui-table`.)

## Install

```sh
npm i @xeplr/ui-table
```

Peer dep: `react ^18 || ^19`.

## Quick start

```jsx
import { XeplrTable } from '@xeplr/ui-table';

<XeplrTable
  data={projects}
  schema={{ 0: { key: 'projects', columns: [
    { accessor: 'name',    header: 'Project', render: { type: 'twoLine', subKey: 'subtitle' } },
    { accessor: 'client',  header: 'Client',  render: { type: 'avatarName', subKey: 'clientType' } },
    { accessor: 'tags',    header: 'Tags',    render: { type: 'tags' } },
    { accessor: 'budget',  header: 'Budget',  render: { type: 'currency', currency: 'INR' } },
    { accessor: 'members', header: 'Team',    render: { type: 'memberChips', max: 3 } }
  ]}}}
  onCommit={async (changeSet) => api.save(changeSet)}
/>
```

Filters, sort, pagination, type detection are all automatic.

## Column config

Each column object:

| field | type | notes |
|---|---|---|
| `accessor` | string | required — row property |
| `header` | string | column title |
| `dataType` | `'string'\|'number'\|'date'\|'boolean'` | optional — auto-detected from data |
| `render` | `{ type, ...config }` or string | declarative cell — see renderers |
| `cell` | `(ctx) => ReactNode` | escape hatch — custom JSX (overrides `render`) |
| `cellStyle` | array | conditional styles — `[{ when: '$.status is active', backgroundColor, color }]` |
| `enableSorting` | boolean | default true |
| `enableColumnFilter` | boolean | default true |

## Renderers

Pass via `render: { type: 'X', ...config }`. String shorthand `render: 'X'` works for renderers with no config.

| type | config | value shape | output |
|---|---|---|---|
| `avatarName` | `{ subKey?, size? }` | string | avatar+bold name [+ subtitle from `row[subKey]`] |
| `twoLine` | `{ subKey? }` | string | primary line [+ subtitle from `row[subKey]`] |
| `tags` | `{ variant?: 'gold'\|'muted'\|'blue', max? }` | `string[]` or comma-string | pill list, `+N` overflow |
| `currency` | `{ currency?: 'INR', position?: 'before', decimals?: 0, bold? }` | number | symbol + formatted number |
| `memberChips` | `{ max?: 3, nameKey?: 'name' }` | `Array<{name,...}>` | avatar+name chips, `+N` overflow |
| `statusBadge` | `{ map: { value: { bg, color, label? } }, default? }` | string | colored pill |
| `dateDisplay` | `{ format?: 'date'\|'datetime'\|'relative' }` | Date or ISO string | formatted date |
| `link` | `{ onClick?(row), hrefKey?, target? }` | string | clickable text or `<a>` |

Add your own: drop a file in `src/renderers/<name>.jsx` exporting `default function (config) { return cell; }`, register it in `renderers/index.js`. Or import the registry and extend at runtime: `import { renderers } from '@xeplr/ui-table'`.

## Conditional cell styling

```js
{ accessor: 'status', cellStyle: [
  { when: '$.status is active',   backgroundColor: '#1b5e20', color: '#a5d6a7' },
  { when: '$.budget < 100000',    backgroundColor: '#bf360c', color: '#ffab91' }
]}
```

Operators: `is`, `is not`, `>`, `<`, `>=`, `<=`, `contains`, `starts with`, `ends with`, `is empty`, `is not empty`. See `operators.js`.

## Nested data (schema levels)

```js
schema = {
  0: { key: 'teams',     columns: [...] },          // root
  1: { key: 'employees', columns: [...] },          // children of each row
  2: { key: 'tasks',     columns: [...] }           // grandchildren
}
```

Each row at level N must have `row[schema[N+1].key]` as an array.

`childDisplay` prop:
- `'popup'` (default) — double-click row → modal with children
- `'inner'` — expand arrow inline

## Edit / add / delete / commit

Pass `onCommit={async (changeSet) => ...}`. Toolbar gets **+ Add New**, row checkboxes get **Delete Selected**, double-click → edit modal. Edits stage locally; **Commit** flushes a deep diff:

```js
[
  { op: 'add',    path: ['teams', null], record: {...} },
  { op: 'update', path: ['teams', '3'], record: {...}, changes: { status: 'inactive' } },
  { op: 'delete', path: ['teams', '5', 'employees', 'e7'] }
]
```

`buildChangeSet(originalData, stagedData, schema)` is exported if you want to compute diffs yourself.

## Props (XeplrTable)

| prop | type | default |
|---|---|---|
| `data` | `Array<object>` | required |
| `schema` | `{ 0: { key, columns }, 1?, 2?, ... }` | required |
| `childDisplay` | `'popup'\|'inner'` | `'popup'` |
| `pageSize` | number | 20 |
| `enableSorting` | boolean | true |
| `enableFiltering` | boolean | true |
| `enablePagination` | boolean | true |
| `onCommit` | `async (changeSet) => void` | — (omit to make table read-only) |
| `className` | string | — |

## Theme

Gold-on-dark by default. Override in your stylesheet — every chrome rule and renderer class is namespaced `.xeplr-table-*` / `.xeplr-r-*`. The override block at the bottom of `xeplr-table.css` is the canonical theme definition.

## Files

```
src/
  XeplrTable.jsx              ─ main component
  useTableController.js       ─ TanStack wiring + renderer dispatch
  useActionsController.js     ─ add/edit/delete staging + commit
  detectTypes.js              ─ infers column dataType from rows
  resolveCellStyle.js         ─ evaluates `cellStyle` rules
  operators.js                ─ shared comparison logic
  buildChangeSet.js           ─ deep-diff for transactional commits
  xeplr-table.css             ─ chrome + renderer styles + theme

  filters/
    StringFilter.jsx · NumberFilter.jsx · DateFilter.jsx · BooleanFilter.jsx · FilterWrapper.jsx
  actions/
    ActionsCell.jsx · RecordModal.jsx · RecordDetail.jsx · ChildTable.jsx
  renderers/
    avatarName.jsx · twoLine.jsx · tags.jsx · currency.jsx
    memberChips.jsx · statusBadge.jsx · dateDisplay.jsx · link.jsx
    _helpers.js · index.js
```

## Exports

`XeplrTable`, `useTableController`, `useActionsController`, `TYPES`, `detectTypes`, `buildChangeSet`, `resolveCellStyle`, `resolveOperator`, `CHILD_DISPLAY`, individual filter components, action components, `renderers` registry + each renderer factory.
