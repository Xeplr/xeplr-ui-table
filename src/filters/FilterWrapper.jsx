import React, { useState, useRef, useEffect } from 'react';

/**
 * Common filter popover shell.
 * Renders a trigger icon and a dropdown panel that closes on outside click.
 *
 * @param {object}  props
 * @param {boolean} props.isActive   - Whether filter is currently applied
 * @param {React.ReactNode} props.children - Filter UI content
 * @param {Function} props.onClear   - Called when user clears the filter
 */
export default function FilterWrapper({ isActive, children, onClear }) {
  var [open, setOpen] = useState(false);
  var wrapperRef = useRef(null);

  // Close on outside click
  useEffect(function() {
    if (!open) return;

    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return function() { document.removeEventListener('mousedown', handleClick); };
  }, [open]);

  return (
    <div className="xeplr-table-filter-wrapper" ref={wrapperRef}>
      <button
        className={'xeplr-table-filter-trigger' + (isActive ? ' xeplr-table-filter-active' : '')}
        onClick={function() { setOpen(!open); }}
        title="Filter"
        type="button"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      </button>

      {open && (
        <div className="xeplr-table-filter-panel">
          {children}
          <div className="xeplr-table-filter-actions">
            <button
              type="button"
              className="xeplr-table-filter-clear-btn"
              onClick={function() { onClear(); setOpen(false); }}
            >
              Clear
            </button>
            <button
              type="button"
              className="xeplr-table-filter-close-btn"
              onClick={function() { setOpen(false); }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
