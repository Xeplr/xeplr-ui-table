import React from 'react';
import FilterWrapper from './FilterWrapper.jsx';
import { resolveDate } from '../operators.js';

var OPERATORS = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not Equals' },
  { value: 'gt', label: 'After' },
  { value: 'gte', label: 'On or After' },
  { value: 'lt', label: 'Before' },
  { value: 'lte', label: 'On or Before' },
  { value: 'between', label: 'Between' }
];

/**
 * Date filter: operator select + date input(s).
 *
 * Filter value shape: { operator, value, valueTo }
 */
export default function DateFilter({ column }) {
  var currentFilter = column.getFilterValue() || { operator: 'eq', value: '', valueTo: '' };
  var isActive = currentFilter.value !== '';

  function update(patch) {
    column.setFilterValue(Object.assign({}, currentFilter, patch));
  }

  function handleClear() {
    column.setFilterValue(undefined);
  }

  return (
    <FilterWrapper isActive={isActive} onClear={handleClear}>
      <div className="xeplr-table-date-filter">
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
          type="date"
          value={currentFilter.value}
          onChange={function(e) { update({ value: e.target.value }); }}
        />

        {currentFilter.operator === 'between' && (
          <input
            className="xeplr-table-filter-input"
            type="date"
            value={currentFilter.valueTo}
            onChange={function(e) { update({ valueTo: e.target.value }); }}
          />
        )}
      </div>
    </FilterWrapper>
  );
}

/**
 * Custom filter function for date columns.
 */
export function dateFilterFn(row, columnId, filterValue) {
  if (!filterValue || !filterValue.value) return true;

  var raw = row.getValue(columnId);
  if (raw === null || raw === undefined || raw === '') return false;

  return resolveDate(raw, filterValue.operator, filterValue.value, filterValue.valueTo);
}
