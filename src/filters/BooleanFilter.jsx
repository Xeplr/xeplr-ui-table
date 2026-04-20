import React from 'react';
import FilterWrapper from './FilterWrapper.jsx';

/**
 * Boolean filter: True / False / All toggle.
 *
 * Filter value shape: { value: true | false | null }
 */
export default function BooleanFilter({ column }) {
  var currentFilter = column.getFilterValue() || { value: null };
  var isActive = currentFilter.value !== null;

  function setValue(val) {
    column.setFilterValue(currentFilter.value === val ? { value: null } : { value: val });
  }

  function handleClear() {
    column.setFilterValue(undefined);
  }

  return (
    <FilterWrapper isActive={isActive} onClear={handleClear}>
      <div className="xeplr-table-boolean-filter">
        <button
          type="button"
          className={'xeplr-table-bool-btn' + (currentFilter.value === null ? ' active' : '')}
          onClick={function() { column.setFilterValue(undefined); }}
        >
          All
        </button>
        <button
          type="button"
          className={'xeplr-table-bool-btn' + (currentFilter.value === true ? ' active' : '')}
          onClick={function() { setValue(true); }}
        >
          True
        </button>
        <button
          type="button"
          className={'xeplr-table-bool-btn' + (currentFilter.value === false ? ' active' : '')}
          onClick={function() { setValue(false); }}
        >
          False
        </button>
      </div>
    </FilterWrapper>
  );
}

function toBool(val) {
  if (val === true || val === 1 || val === '1' || val === 'true' || val === 'True' || val === 'TRUE') return true;
  if (val === false || val === 0 || val === '0' || val === 'false' || val === 'False' || val === 'FALSE') return false;
  return null;
}

/**
 * Custom filter function for boolean columns.
 */
export function booleanFilterFn(row, columnId, filterValue) {
  if (!filterValue || filterValue.value === null || filterValue.value === undefined) return true;

  var raw = row.getValue(columnId);
  var bool = toBool(raw);

  return bool === filterValue.value;
}
