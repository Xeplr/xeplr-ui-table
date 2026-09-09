import React, { useRef, useEffect, useLayoutEffect } from 'react';
import { flexRender } from '@tanstack/react-table';

/**
 * A cell, popped out and enlarged.
 *
 * The problem it solves is plain readability: report grids run small type so
 * more fits on a page, and a long value in a narrow column wraps to three
 * cramped lines. Double-clicking gives you that one value at a size you can
 * actually read, without changing the table's font for everyone or making the
 * column wider.
 *
 * It renders the column's OWN cell renderer, not the raw value — so a currency
 * cell zooms as ₹36,260.80 and a badge zooms as a badge. Seeing something
 * different up close from what was on the page would defeat the point.
 *
 * Deliberately not a modal: it doesn't trap focus or block the page, because
 * it's a reading aid, not a task. Escape, a click anywhere else, or scrolling
 * the table all dismiss it.
 */
export default function CellZoom({ cell, anchorRect, font, onClose }) {
  var boxRef = useRef(null);

  // Position after render, once the box's real size is known — a value's
  // width isn't predictable before it's laid out at the larger size.
  useLayoutEffect(function() {
    var box = boxRef.current;
    if (!box || !anchorRect) return;
    var margin = 8;
    var rect = box.getBoundingClientRect();

    // Grows out of the cell it came from, so the eye doesn't lose its place.
    var left = anchorRect.left;
    var top = anchorRect.top;
    if (left + rect.width > window.innerWidth - margin) left = window.innerWidth - rect.width - margin;
    if (top + rect.height > window.innerHeight - margin) top = anchorRect.bottom - rect.height;
    box.style.left = Math.max(margin, left) + 'px';
    box.style.top = Math.max(margin, top) + 'px';
    box.focus();
  }, [anchorRect]);

  useEffect(function() {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    function onPointer(e) { if (boxRef.current && !boxRef.current.contains(e.target)) onClose(); }
    // Scroll closes rather than re-anchoring: a box chasing its cell across a
    // scrolling table is harder to read than one that simply gets out of the way.
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('scroll', onClose, true);
    return function() {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  return (
    <div
      ref={boxRef}
      className="xeplr-table-cell-zoom"
      role="dialog"
      aria-label="Enlarged cell"
      tabIndex={-1}
      style={{
        minWidth: anchorRect ? Math.min(anchorRect.width, 320) + 'px' : undefined,
        // Everything inside is sized in em, so this one value sets the scale.
        fontSize: font ? font.fontSize : undefined,
        fontFamily: font ? font.fontFamily : undefined
      }}
    >
      <div className="xeplr-table-cell-zoom-label">{String(cell.column.columnDef.header || '')}</div>
      <div className="xeplr-table-cell-zoom-value">
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </div>
    </div>
  );
}
