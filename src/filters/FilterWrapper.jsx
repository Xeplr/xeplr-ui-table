import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Common filter popover shell.
 * Renders a trigger icon and a dropdown panel that closes on outside click.
 *
 * PORTALLED TO document.body, and positioned from the trigger's own rect.
 *
 * It used to be `position: absolute; right: 0` inside the header cell, which
 * put it at the mercy of every ancestor: a table scrolls (`overflow: auto`),
 * so the panel was CLIPPED by the table it belongs to. On the first, narrow
 * column a 220px panel anchored to the cell's right edge opened leftward past
 * the table's left edge and had its labels sliced off — a filter list you
 * cannot read is a filter you cannot use.
 *
 * A portal has no ancestors to be clipped by. The cost is that it no longer
 * moves with the page on its own, so it closes on scroll and resize rather
 * than hanging in the wrong place.
 *
 * @param {object}  props
 * @param {boolean} props.isActive   - Whether filter is currently applied
 * @param {React.ReactNode} props.children - Filter UI content
 * @param {Function} props.onClear   - Called when user clears the filter
 */
export default function FilterWrapper({ isActive, children, onClear }) {
  var [open, setOpen] = useState(false);
  var [rect, setRect] = useState(null);
  var wrapperRef = useRef(null);
  var panelRef = useRef(null);

  // Where the panel should sit, in VIEWPORT coordinates (position: fixed).
  var place = useCallback(function() {
    var el = wrapperRef.current;
    if (!el) return;
    var r = el.getBoundingClientRect();
    var W = 240;                       // matches min-width in the stylesheet
    var margin = 8;
    // Right-aligned to the trigger by preference, because that reads as
    // belonging to this column — but never off either edge of the window.
    var left = Math.min(
      Math.max(margin, r.right - W),
      Math.max(margin, window.innerWidth - W - margin)
    );
    setRect({ top: r.bottom + 4, left: left, width: W });
  }, []);

  useEffect(function() {
    if (!open) return undefined;
    place();

    function handleClick(e) {
      var inTrigger = wrapperRef.current && wrapperRef.current.contains(e.target);
      var inPanel = panelRef.current && panelRef.current.contains(e.target);
      if (!inTrigger && !inPanel) setOpen(false);
    }
    // A portalled panel does not travel with what it is anchored to, so
    // rather than let it hang somewhere wrong it closes. `true` catches
    // scrolling in the TABLE, not just the window — the scroll event does not
    // bubble, so a listener without capture never hears it.
    function handleScroll() { setOpen(false); }

    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return function() {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open, place]);

  var panel = open && rect ? createPortal(
    <div
      ref={panelRef}
      className="xeplr-table-filter-panel"
      style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
    >
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
    </div>,
    document.body
  ) : null;

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
      {panel}
    </div>
  );
}
