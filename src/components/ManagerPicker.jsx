import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, Check } from 'lucide-react';

const NONE_LABEL = 'None (Top-Level Executive)';
const RESULTS_CAP = 50; // keeps the DOM light even against a 1000+ row live Sheet

// Search-filterable replacement for a plain <select> on the "Reports To (Manager)"
// field. A flat <select> listing every employee in whatever order the Sheet happens
// to have them in makes finding one specific new manager, out of hundreds/thousands
// of rows, a slow scroll-and-squint exercise - this lets the user type a few
// characters of the manager's name, title, or department and pick from the
// filtered results instead.
//
// The results panel renders INLINE, in normal document flow (not position:absolute)
// - deliberately different from SearchAutocomplete.jsx's toolbar dropdown. This field
// sits inside MemberModal's .modal-body, which scrolls internally
// (overflow-y:auto) and .modal-content itself clips overflow too, so an
// absolutely-positioned panel would silently get cut off any time this field isn't
// near the very bottom of whatever's currently scrolled into view. Growing the form
// in place (pushing the fields below it down) has no such blind spot.
export default function ManagerPicker({ members = [], value, onChange, placeholder = NONE_LABEL }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = members.find(m => m.id === value) || null;

  const matchingCount = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members.length;
    return members.reduce((count, m) => (
      count + ((
        m.name.toLowerCase().includes(q) ||
        (m.title || '').toLowerCase().includes(q) ||
        (m.department || '').toLowerCase().includes(q) ||
        (m.id || '').toLowerCase().includes(q)
      ) ? 1 : 0)
    ), 0);
  }, [members, query]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? members.filter(m =>
          m.name.toLowerCase().includes(q) ||
          (m.title || '').toLowerCase().includes(q) ||
          (m.department || '').toLowerCase().includes(q) ||
          (m.id || '').toLowerCase().includes(q)
        )
      : members;
    return base.slice(0, RESULTS_CAP);
  }, [members, query]);

  // "None" is a real, always-selectable choice (top-level exec), not a placeholder -
  // so it's pinned at the top of the list whenever it still matches what's typed,
  // exactly like any other row would.
  const noneMatches = !query.trim() || NONE_LABEL.toLowerCase().includes(query.trim().toLowerCase());
  const flatOptions = noneMatches ? [null, ...results] : results;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(-1);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const choose = (member) => {
    onChange(member ? member.id : null);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || flatOptions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % flatOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + flatOptions.length) % flatOptions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(flatOptions[activeIndex >= 0 ? activeIndex : 0]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="manager-picker" ref={containerRef}>
      {!isOpen ? (
        <button
          type="button"
          className="form-control manager-picker-trigger"
          onClick={() => setIsOpen(true)}
        >
          <span className="manager-picker-trigger-label">
            {selected ? `${selected.name} (${selected.title})` : placeholder}
          </span>
          <ChevronDown size={15} />
        </button>
      ) : (
        <div className="manager-picker-panel">
          <div className="manager-picker-search-box">
            <Search size={14} className="manager-picker-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="manager-picker-search-input"
              placeholder="Search by name, title, or department..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className="icon-btn manager-picker-close"
              onClick={() => setIsOpen(false)}
              title="Close"
            >
              <X size={14} />
            </button>
          </div>

          <div className="manager-picker-list">
            {flatOptions.length === 0 && (
              <div className="manager-picker-empty">No matching employees</div>
            )}

            {noneMatches && (
              <div
                className={`manager-picker-item ${activeIndex === 0 ? 'active' : ''} ${!selected ? 'is-selected' : ''}`}
                onClick={() => choose(null)}
                onMouseEnter={() => setActiveIndex(0)}
              >
                <span className="manager-picker-item-name">{NONE_LABEL}</span>
                {!selected && <Check size={14} />}
              </div>
            )}

            {results.map((m, idx) => {
              const flatIdx = noneMatches ? idx + 1 : idx;
              const isActive = activeIndex === flatIdx;
              const isSelected = selected?.id === m.id;
              return (
                <div
                  key={m.id}
                  className={`manager-picker-item ${isActive ? 'active' : ''} ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => choose(m)}
                  onMouseEnter={() => setActiveIndex(flatIdx)}
                >
                  <div className="manager-picker-item-main">
                    <span className="manager-picker-item-name">{m.name}</span>
                    <span className="manager-picker-item-title">{m.title} · {m.department}</span>
                  </div>
                  {isSelected && <Check size={14} />}
                </div>
              );
            })}

            {matchingCount > RESULTS_CAP && (
              <div className="manager-picker-hint">
                Showing {RESULTS_CAP} of {matchingCount} matches - keep typing to narrow it down
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
