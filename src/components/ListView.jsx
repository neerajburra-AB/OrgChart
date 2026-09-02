import React, { useState, useMemo } from 'react';
import { Eye, Edit3, Trash2, ArrowUpDown } from 'lucide-react';
import { DEPARTMENTS } from '../data/initialData';

export default function ListView({
  members,
  allMembers,
  onSelectMember,
  onOpenEditModal,
  onDeleteMember
}) {
  const [sortField, setSortField] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field) => {
    setPage(0);
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Keep pagination in sync when the incoming (filtered) member list changes size,
  // e.g. the user types into search - avoid landing on a now out-of-range page.
  React.useEffect(() => {
    setPage(0);
  }, [members.length]);

  // O(1) manager lookup instead of allMembers.find(...) per row - the previous
  // per-row linear scan turned a large directory (thousands of employees) into an
  // O(n^2) render and made the Directory tab freeze for several seconds.
  const membersById = useMemo(() => {
    const map = new Map();
    allMembers.forEach((m) => map.set(m.id, m));
    return map;
  }, [allMembers]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [members, sortField, sortAsc]);

  // Paginate large directories so the table never has to mount thousands of rows
  // at once - this is what actually keeps the tab responsive at scale.
  const PAGE_SIZE = 100;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(sortedMembers.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedMembers = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return sortedMembers.slice(start, start + PAGE_SIZE);
  }, [sortedMembers, safePage]);

  return (
    <div className="list-container">
      <table className="org-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Employee <ArrowUpDown size={13} />
              </div>
            </th>
            <th onClick={() => handleSort('title')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Title <ArrowUpDown size={13} />
              </div>
            </th>
            <th onClick={() => handleSort('department')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Department <ArrowUpDown size={13} />
              </div>
            </th>
            <th>Seniority Level</th>
            <th>Location</th>
            <th>Manager</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedMembers.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                No employees match the current search filters.
              </td>
            </tr>
          ) : (
            pagedMembers.map((member) => {
              const dept = DEPARTMENTS[member.department] || { name: member.department, color: '#6366f1' };
              const manager = member.managerId ? membersById.get(member.managerId) : null;

              return (
                <tr key={member.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img
                        src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}`}
                        alt={member.name}
                        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700 }}>{member.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{member.title}</td>
                  <td>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 12,
                        backgroundColor: dept.bg || 'rgba(99, 102, 241, 0.15)',
                        color: dept.color || '#6366f1'
                      }}
                    >
                      {dept.name}
                    </span>
                  </td>
                  <td>{member.level}</td>
                  <td>{member.location}</td>
                  <td>
                    {manager ? (
                      <span style={{ fontWeight: 600 }}>{manager.name}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>CEO / Root</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        className="icon-btn"
                        style={{ width: 30, height: 30 }}
                        onClick={() => onSelectMember(member)}
                        title="View Profile"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        style={{ width: 30, height: 30 }}
                        onClick={() => onOpenEditModal(member)}
                        title="Edit Employee"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {pageCount > 1 && (
        <div className="list-pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '16px 0' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
          >
            Previous
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Page {safePage + 1} of {pageCount} &middot; {sortedMembers.length} employees
          </span>
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
