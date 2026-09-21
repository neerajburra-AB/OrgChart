import React, { useState } from 'react';
import {
  X,
  Mail,
  Phone,
  MapPin,
  Calendar,
  UserPlus,
  Edit,
  UserCheck,
  Trash2,
  Briefcase,
  ChevronRight,
  Shield,
  Layers,
  CornerDownRight,
  ArrowRightLeft,
  GitBranch
} from 'lucide-react';
import { DEPARTMENTS } from '../data/initialData';
import { toIdArray } from '../utils/orgUtils';

export default function MemberDrawer({
  member,
  allMembers,
  onClose,
  onOpenEditModal,
  onOpenAddModal,
  onDeleteMember,
  onSelectMember,
  onOpenReassignModal
}) {
  if (!member) return null;

  const deptInfo = DEPARTMENTS[member.department] || {
    name: member.department,
    color: '#6366f1',
    bg: 'rgba(99, 102, 241, 0.15)'
  };

  const manager = allMembers.find(m => m.id === member.managerId);
  const directReports = allMembers.filter(m => m.managerId === member.id);

  // Everyone who lists THIS person as a dotted-line/matrix manager (see MemberModal.jsx's
  // "Also Reports To" field) - the reverse direction of that field, so it has to be found
  // by scanning, not read off member.* directly. Shown as its own list here rather than
  // nested into the Tree/Focus canvas itself: matrixManagerId has no cycle/descendant
  // restriction at all (anyone can pick anyone), so actually nesting a dotted report's own
  // subtree under every dotted manager they have would risk duplicating large branches
  // repeatedly (or worse, an literal render loop if two people ever cross-list each other)
  // for very little real benefit over just listing them here - confirmed with the user.
  const dottedReports = allMembers.filter(m => toIdArray(m.matrixManagerId).includes(member.id));

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      
      <div className="drawer-panel">
        {/* Drawer Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} style={{ color: deptInfo.color }} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Employee Profile</span>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close Profile">
            <X size={18} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body">
          {/* Profile Hero */}
          <div className="drawer-profile-hero">
            <img 
              src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`} 
              alt={member.name}
              className="hero-avatar"
            />
            <h2 className="hero-name">{member.name}</h2>
            <div className="hero-title">{member.title}</div>
            
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <span 
                className="skill-chip"
                style={{ 
                  backgroundColor: deptInfo.bg, 
                  color: deptInfo.color,
                  borderColor: `${deptInfo.color}40`
                }}
              >
                {deptInfo.name}
              </span>
              <span className="skill-chip" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                {member.level}
              </span>
            </div>
          </div>

          {/* Action Buttons Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
            <button 
              className="btn btn-secondary" 
              style={{ justifyContent: 'center' }}
              onClick={() => onOpenAddModal(member.id)}
            >
              <UserPlus size={15} />
              <span>Add Report</span>
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ justifyContent: 'center' }}
              onClick={() => onOpenEditModal(member)}
            >
              <Edit size={15} />
              <span>Edit Details</span>
            </button>
          </div>

          {/* Details Grid */}
          <div className="drawer-section">
            <div className="drawer-section-title">Contact & Location</div>
            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Mail size={12} /> Email
                </div>
                <div className="detail-value" style={{ fontSize: 12 }}>
                  <a href={`mailto:${member.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {member.email}
                  </a>
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Phone size={12} /> Phone
                </div>
                <div className="detail-value" style={{ fontSize: 12 }}>
                  {member.phone || 'N/A'}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={12} /> Location
                </div>
                <div className="detail-value">
                  {member.location}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={12} /> Joined
                </div>
                <div className="detail-value">
                  {member.joinDate || '2022'}
                </div>
              </div>
            </div>
          </div>

          {/* Manager & Org Hierarchy */}
          <div className="drawer-section">
            <div className="drawer-section-title">Reporting Structure</div>
            
            {manager ? (
              <div 
                className="report-item" 
                onClick={() => onSelectMember(manager)}
                style={{ marginBottom: 12 }}
              >
                <img 
                  src={manager.avatar} 
                  alt={manager.name} 
                  style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} 
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Reports to (Manager)</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{manager.name}</div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 12 }}>
                Top-Level Leader (No Manager)
              </div>
            )}
          </div>

          {/* Bio / Summary */}
          {member.bio && (
            <div className="drawer-section">
              <div className="drawer-section-title">Bio & Summary</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {member.bio}
              </p>
            </div>
          )}

          {/* Skills & Expertise */}
          {member.skills && member.skills.length > 0 && (
            <div className="drawer-section">
              <div className="drawer-section-title">Key Skills & Expertise</div>
              <div className="skills-flex">
                {member.skills.map((skill, i) => (
                  <span key={i} className="skill-chip">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Direct Reports List */}
          <div className="drawer-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
              <div className="drawer-section-title" style={{ marginBottom: 0 }}>
                Direct Reports ({directReports.length})
              </div>
              {/* Bulk-move everyone below this person to a new manager in one go -
                  e.g. this person is leaving and someone else is taking over their
                  team - instead of opening each report's Edit form one at a time.
                  See ReassignManagerModal.jsx for the actual picker/confirm flow. */}
              {directReports.length > 0 && (
                <button
                  className="icon-btn"
                  title="Reassign all direct reports to a different manager"
                  onClick={() => onOpenReassignModal(member)}
                  style={{ flexShrink: 0 }}
                >
                  <ArrowRightLeft size={15} />
                </button>
              )}
            </div>
            {directReports.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No direct reports.
              </div>
            ) : (
              <div className="direct-reports-list">
                {directReports.map((report) => (
                  <div 
                    key={report.id}
                    className="report-item"
                    onClick={() => onSelectMember(report)}
                  >
                    <img 
                      src={report.avatar} 
                      alt={report.name} 
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} 
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{report.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{report.title}</div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dotted-Line Reports - people who list THIS person as a matrix manager. Only
              shown when at least one exists (most employees have none), same pattern as
              Bio/Skills above - unlike Direct Reports, this isn't a universal field every
              card has something to say about. */}
          {dottedReports.length > 0 && (
            <div className="drawer-section">
              <div className="drawer-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <GitBranch size={13} />
                <span>Dotted-Line Reports ({dottedReports.length})</span>
              </div>
              <div className="direct-reports-list">
                {dottedReports.map((report) => (
                  <div
                    key={report.id}
                    className="report-item"
                    onClick={() => onSelectMember(report)}
                  >
                    <img
                      src={report.avatar}
                      alt={report.name}
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{report.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{report.title}</div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Danger Zone / Delete Button */}
          {manager && (
            <div className="drawer-section" style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid rgba(239,68,68,0.2)' }}>
              <button
                className="btn"
                style={{
                  width: '100%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  justify: 'center'
                }}
                onClick={() => onDeleteMember(member.id)}
              >
                <Trash2 size={15} />
                <span>Remove Employee</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
