import React from 'react';
import FilterWrapper from './FilterWrapper.jsx';
import { resolveNumber, isNullish } from '../operators.js';

var OPERATORS = [
  { value: 'eq', label: '= Equals' },
  { value: 'neq', label: '!= Not Equals' },
  { value: 'gt', label: '> Greater Than' },
  { value: 'gte', label: '>= Greater or Equal' },
  { value: 'lt', label: '< Less Than' },
  { value: 'lte', label: '<= Less or Equal' },
  { value: 'between', label: 'Between' }
];

/**
 * Number filter: operator select + input(s) + null checks.
 *
 * Filter value shape: { operator, value, valueTo, isNull: boolean | null }
 */
export default function NumberFilter({ column }) {
  var currentFilter = column.getFilterValue() || { operator: 'eq', value: '', valueTo: '', isNull: null };
  var isActive = currentFilter.value !== '' || currentFilter.isNull !== null;

  function update(patch) {
    column.setFilterValue(Object.assign({}, currentFilter, patch));
  }

  function setNullMode(mode) {
    var next = currentFilter.isNull === mode ? null : mode;
    update({ isNull: next });
  }

  function handleClear() {
    column.setFilterValue(undefined);
  }

  return (
    <FilterWrapper isActive={isActive} onClear={handleClear}>
      <div className="xeplr-table-number-filter">
        <select
          className="xeplr-table-filter-operator"
          value={currentFilter.operator}
          onChange={function(e) { update({ operator: e.target.value }); }}
        >
          {OPERATORS.map(function(op) {
            return <option key={op.value} value={op.value}>{op.label}</option>;
          })}
        </select>

        <input
          className="xeplr-table-filter-input"
          type="number"
          placeholder={currentFilter.operator === 'between' ? 'Min' : 'Value'}
          value={currentFilter.value}
          onChange={function(e) { update({ value: e.target.value }); }}
        />

        {currentFilter.operator === 'between' && (
          <input
            className="xeplr-table-filter-input"
            type="number"
            placeholder="Max"
            value={currentFilter.valueTo}
            onChange={function(e) { update({ valueTo: e.target.value }); }}
          />
        )}

        <div className="xeplr-table-filter-null-controls">
          <button
            type="button"
            className={currentFilter.isNull === true ? 'active' : ''}
            onClick={function() { setNullMode(true); }}
          >
            Is Null
          </button>
          <button
            type="button"
            className={currentFilter.isNull === false ? 'active' : ''}
            onClick={function() { setNullMode(false); }}
          >
            Is Not Null
          </button>
        </div>
      </div>
    </FilterWrapper>
  );
}

/**
 * Custom filter function for number columns.
 */
export function numberFilterFn(row, columnId, filterValue) {
  if (!filterValue) return true;

  var raw = row.getValue(columnId);

  // Null mode
  if (filterValue.isNull === true) return isNullish(raw);
  if (filterValue.isNull === false && isNullish(raw)) return false;

  // No value entered — pass through
  if (filterValue.value === '' || filterValue.value === undefined) return true;

  return resolveNumber(raw, filterValue.operator, filterValue.value, filterValue.valueTo);
}
