import React, { useState, useMemo } from 'react';
import FilterWrapper from './FilterWrapper.jsx';

/**
 * Excel-like string filter: searchable multi-select of unique values + null checks.
 *
 * Filter value shape: { selected: string[], isNull: boolean | null }
 *   - selected: array of checked values (empty = all selected = no filter)
 *   - isNull: true = show only nulls, false = exclude nulls, null = don't care
 */
export default function StringFilter({ column }) {
  var currentFilter = column.getFilterValue() || { selected: [], isNull: null };
  var [search, setSearch] = useState('');

  // Collect unique non-null values from the full (pre-filtered) data
  var uniqueValues = useMemo(function() {
    var vals = new Set();
    var rows = column.getFacetedRowModel().rows;
    for (var i = 0; i < rows.length; i++) {
      var val = rows[i].getValue(column.id);
      if (val !== null && val !== undefined && val !== '') {
        vals.add(String(val));
      }
    }
    var arr = Array.from(vals);
    arr.sort();
    return arr;
  }, [column.getFacetedRowModel()]);

  var filteredValues = useMemo(function() {
    if (!search) return uniqueValues;
    var lower = search.toLowerCase();
    return uniqueValues.filter(function(v) { return v.toLowerCase().includes(lower); });
  }, [uniqueValues, search]);

  var selectedSet = new Set(currentFilter.selected);
  var isActive = currentFilter.selected.length > 0 || currentFilter.isNull !== null;

  function toggleValue(val) {
    var next = new Set(selectedSet);
    if (next.has(val)) {
      next.delete(val);
    } else {
      next.add(val);
    }
    column.setFilterValue({ selected: Array.from(next), isNull: currentFilter.isNull });
  }

  function selectAll() {
    column.setFilterValue({ selected: [], isNull: currentFilter.isNull });
  }

  function selectNone() {
    // Selecting "none" means selecting all visible as the filter — i.e. show nothing
    // Actually, set selected to a sentinel empty-but-active state
    column.setFilterValue({ selected: ['__xeplr_none__'], isNull: currentFilter.isNull });
  }

  function setNullMode(mode) {
    var next = currentFilter.isNull === mode ? null : mode;
    column.setFilterValue({ selected: currentFilter.selected, isNull: next });
  }

  function handleClear() {
    column.setFilterValue(undefined);
    setSearch('');
  }

  return (
    <FilterWrapper isActive={isActive} onClear={handleClear}>
      <div className="xeplr-table-string-filter">
        <input
          className="xeplr-table-filter-search"
          type="text"
          placeholder="Search..."
          value={search}
          onChange={function(e) { setSearch(e.target.value); }}
        />

        <div className="xeplr-table-filter-bulk">
          <button type="button" onClick={selectAll}>Select All</button>
          <button type="button" onClick={selectNone}>Clear All</button>
        </div>

        <div className="xeplr-table-filter-list">
          {filteredValues.map(function(val) {
            var checked = selectedSet.size === 0 || selectedSet.has(val);
            return (
              <label key={val} className="xeplr-table-filter-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={function() { toggleValue(val); }}
                />
                <span>{val}</span>
              </label>
            );
          })}
          {filteredValues.length === 0 && (
            <div className="xeplr-table-filter-empty">No values</div>
          )}
        </div>

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
 * Custom filter function for string columns.
 */
export function stringFilterFn(row, columnId, filterValue) {
  if (!filterValue) return true;

  var val = row.getValue(columnId);
  var isNullish = val === null || val === undefined || val === '';

  // Null mode check
  if (filterValue.isNull === true) return isNullish;
  if (filterValue.isNull === false && isNullish) return false;

  // Selected values check
  if (filterValue.selected.length === 0) return true; // no selection = show all
  if (filterValue.selected[0] === '__xeplr_none__') return false;
  return filterValue.selected.includes(String(val));
}
