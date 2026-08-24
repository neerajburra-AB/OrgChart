import React, { useState } from 'react';
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
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedMembers = [...members].sort((a, b) => {
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';
    
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

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
            sortedMembers.map((member) => {
              const dept = DEPARTMENTS[member.department] || { name: member.department, color: '#6366f1' };
              const manager = allMembers.find(m => m.id === member.managerId);

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
    </div>
  );
}
