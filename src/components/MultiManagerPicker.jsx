import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Plus, Check } from 'lucide-react';

const RESULTS_CAP = 50; // same cap as ManagerPicker, same reason (keeps the DOM light against a 1000+ row live Sheet)

// Multi-select sibling of ManagerPicker.jsx - for the "Also Reports To (Dotted-line)"
// matrix-manager field (see MemberModal.jsx). Deliberately a SEPARATE component rather
// than a `multiple` mode bolted onto ManagerPicker: the two fields have genuinely
// different constraints. ManagerPicker's "Reports To" choice feeds buildOrgTree's real
// parent/child structure, so it must exclude a person's own descendants (a cycle would
// break the tree). matrixManagerId never feeds buildOrgTree at all - it's purely
// cosmetic (a dotted-line connector + a small badge, see OrgCanvas.jsx/OrgNode.jsx) - so
// literally anyone else in the company is a valid pick here, including someone who
// reports to this person, and more than one can be picked at once.
export default function MultiManagerPicker({
  members = [],
  value = [],
  onChange,
  excludeId = null,
  addLabel = 'Add a dotted-line manager'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Can't be your own dotted-line manager.
  const selectableMembers = useMemo(
    () => members.filter((m) => m.id !== excludeId),
    [members, excludeId]
  );

  const byId = useMemo(() => new Map(selectableMembers.map((m) => [m.id, m])), [selectableMembers]);
  // Resolved in the order the ids were picked, and silently drops any id that no longer
  // matches a real employee (e.g. that person was deleted since) rather than showing a
  // broken chip with nothing to display.
  const selected = value.map((id) => byId.get(id)).filter(Boolean);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? selectableMembers.filter((m) =>
          m.name.toLowerCase().includes(q) ||
          (m.title || '').toLowerCase().includes(q) ||
          (m.department || '').toLowerCase().includes(q) ||
          (m.id || '').toLowerCase().includes(q)
        )
      : selectableMembers;
    return base.slice(0, RESULTS_CAP);
  }, [selectableMembers, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
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

  // Clicking a result TOGGLES it and keeps the panel open - picking several people in a
  // row shouldn't mean reopening the search each time, unlike the single-choice
  // ManagerPicker this is modeled on.
  const toggle = (memberId) => {
    if (value.includes(memberId)) {
      onChange(value.filter((id) => id !== memberId));
    } else {
      onChange([...value, memberId]);
    }
  };

  const remove = (memberId) => onChange(value.filter((id) => id !== memberId));

  return (
    <div className="manager-picker multi-manager-picker" ref={containerRef}>
      {selected.length > 0 && (
        <div className="multi-picker-chips">
          {selected.map((m) => (
            <span key={m.id} className="multi-picker-chip">
              {m.name}
              <button type="button" onClick={() => remove(m.id)} title={`Remove ${m.name}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {!isOpen ? (
        <button
          type="button"
          className="btn btn-secondary multi-picker-add-btn"
          onClick={() => setIsOpen(true)}
        >
          <Plus size={14} />
          <span>{selected.length > 0 ? 'Add another' : addLabel}</span>
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
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className="icon-btn manager-picker-close"
              onClick={() => setIsOpen(false)}
              title="Done"
            >
              <X size={14} />
            </button>
          </div>

          <div className="manager-picker-list">
            {results.length === 0 && (
              <div className="manager-picker-empty">No matching employees</div>
            )}

            {results.map((m) => {
              const isSelected = value.includes(m.id);
              return (
                <div
                  key={m.id}
                  className={`manager-picker-item ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => toggle(m.id)}
                >
                  <div className="manager-picker-item-main">
                    <span className="manager-picker-item-name">{m.name}</span>
                    <span className="manager-picker-item-title">{m.title} · {m.department}</span>
                  </div>
                  {isSelected && <Check size={14} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
