import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, User, Briefcase, Hash, ChevronRight } from 'lucide-react';
import { DEPARTMENTS } from '../data/initialData';

export default function SearchAutocomplete({
  members = [],
  searchQuery,
  onSearchChange,
  onSelectResult
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Filter matching members by name, title, or ID (case-insensitive)
  const matches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return members.filter(m => {
      const nameMatch = m.name.toLowerCase().includes(query);
      const titleMatch = m.title.toLowerCase().includes(query);
      const idMatch = m.id.toLowerCase().includes(query);
      const deptMatch = m.department.toLowerCase().includes(query);
      const emailMatch = m.email.toLowerCase().includes(query);
      return nameMatch || titleMatch || idMatch || deptMatch || emailMatch;
    }).slice(0, 8); // Limit dropdown to top 8 items for optimal UI UX
  }, [members, searchQuery]);

  // Open dropdown when query changes
  useEffect(() => {
    if (searchQuery.trim().length > 0 && matches.length > 0) {
      setIsOpen(true);
      setSelectedIndex(-1);
    } else {
      setIsOpen(false);
    }
  }, [searchQuery, matches]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = (e) => {
    if (!isOpen || matches.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < matches.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : matches.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < matches.length) {
        handleChoose(matches[selectedIndex]);
      } else if (matches.length > 0) {
        handleChoose(matches[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleChoose = (member) => {
    onSelectResult(member);
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  return (
    <div className="search-autocomplete-container" ref={containerRef}>
      <div className="search-box">
        <Search size={16} className="search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search by employee name, job title, or ID..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => {
            if (searchQuery.trim() && matches.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        {searchQuery && (
          <button
            className="clear-search"
            onClick={() => {
              onSearchChange('');
              setIsOpen(false);
            }}
            title="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown List */}
      {isOpen && matches.length > 0 && (
        <div className="autocomplete-dropdown shadow-lg">
          <div className="autocomplete-header">
            <span>Matching Employees ({matches.length})</span>
            <span className="key-hint">Press ↵ to select</span>
          </div>

          <div className="autocomplete-list">
            {matches.map((member, idx) => {
              const dept = DEPARTMENTS[member.department] || { color: '#6366f1' };
              const isFocused = idx === selectedIndex;

              return (
                <div
                  key={member.id}
                  className={`autocomplete-item ${isFocused ? 'active' : ''}`}
                  onClick={() => handleChoose(member)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <img
                    src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}`}
                    alt={member.name}
                    className="item-avatar"
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=6366f1&color=fff`;
                    }}
                  />

                  <div className="item-info">
                    <div className="item-name-row">
                      <span className="item-name">{member.name}</span>
                      <span className="item-id-badge">ID: {member.id}</span>
                    </div>
                    <div className="item-title">{member.title}</div>
                  </div>

                  <span
                    className="item-dept-pill"
                    style={{
                      backgroundColor: dept.bg || 'rgba(99, 102, 241, 0.15)',
                      color: dept.color,
                      borderColor: `${dept.color}40`
                    }}
                  >
                    {member.department}
                  </span>

                  <ChevronRight size={14} className="item-arrow" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
