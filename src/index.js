// Main component
export { default as XeplrTable } from './XeplrTable.jsx';

// Controller hooks
export { default as useTableController } from './useTableController.js';
export { default as useActionsController } from './useActionsController.js';

// Type detection
export { detectTypes, TYPES } from './detectTypes.js';

// Individual filter components (for custom layouts)
export { default as StringFilter, stringFilterFn } from './filters/StringFilter.jsx';
export { default as NumberFilter, numberFilterFn } from './filters/NumberFilter.jsx';
export { default as DateFilter, dateFilterFn } from './filters/DateFilter.jsx';
export { default as BooleanFilter, booleanFilterFn } from './filters/BooleanFilter.jsx';
export { default as FilterWrapper } from './filters/FilterWrapper.jsx';

// Action components (for custom layouts)
export { default as ActionsCell } from './actions/ActionsCell.jsx';
export { default as RecordModal } from './actions/RecordModal.jsx';
export { default as ChildTable } from './actions/ChildTable.jsx';
export { default as RecordDetail } from './actions/RecordDetail.jsx';
export { CHILD_DISPLAY } from './XeplrTable.jsx';

// Change set builder
export { buildChangeSet } from './buildChangeSet.js';

// Operator resolver (shared comparison logic)
export { resolve as resolveOperator, resolveString, resolveNumber, resolveDate, isNullish } from './operators.js';

// Conditional formatting
export { resolveCellStyle } from './resolveCellStyle.js';
