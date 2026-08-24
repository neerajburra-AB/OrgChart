import React from 'react';
import { ChevronDown, MapPin, Users } from 'lucide-react';
import { DEPARTMENTS } from '../data/initialData';

export default function OrgNode({
  node,
  isSelected,
  isSearchMatch,
  focusedNodeId,
  cardMode,
  onSelect,
  onToggleCollapse
}) {
  const deptInfo = DEPARTMENTS[node.department] || {
    name: node.department,
    color: '#6366f1',
    bg: 'rgba(99, 102, 241, 0.15)'
  };

  const hasChildren = node.children && node.children.length > 0;
  const isCompact = cardMode === 'compact';
  const isFocused = focusedNodeId === node.id;

  return (
    <div
      data-node-id={node.id}
      data-department={node.department}
      className={`org-node-card ${isCompact ? 'compact' : ''} ${isSelected ? 'selected' : ''} ${isSearchMatch ? 'search-match' : ''} ${isFocused ? 'focused-pulse' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node);
      }}
    >
      {/* Department accent line at top */}
      <div 
        className="node-dept-bar" 
        style={{ background: deptInfo.color }}
      />

      <div className="node-header">
        <div className="avatar-wrapper">
          <img 
            src={node.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(node.name)}&background=random`} 
            alt={node.name} 
            className="node-avatar"
            onError={(e) => {
              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(node.name)}&background=6366f1&color=fff`;
            }}
          />
          <div className={`status-dot ${node.status}`} title={`Status: ${node.status}`} />
        </div>

        <div className="node-main-info">
          <div className="node-name" title={node.name}>{node.name}</div>
          <div className="node-title" title={node.title}>{node.title}</div>
          
          <span 
            className="node-dept-tag"
            style={{ 
              backgroundColor: deptInfo.bg,
              color: deptInfo.color,
              border: `1px solid ${deptInfo.color}40`
            }}
          >
            {deptInfo.name}
          </span>
        </div>
      </div>

      {!isCompact && (
        <div className="node-footer">
          <div className="node-meta-item">
            <MapPin size={12} />
            <span>{node.location.split(',')[0]}</span>
          </div>

          {node.directReportsCount > 0 && (
            <div className="node-meta-item" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
              <Users size={12} />
              <span>{node.directReportsCount} reports</span>
            </div>
          )}
        </div>
      )}

      {/* Expand / Collapse Button */}
      {hasChildren && (
        <button
          className="expand-toggle-btn"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(node.id);
          }}
          title={node.isCollapsed ? `Expand ${node.directReportsCount} reports` : 'Collapse reports'}
        >
          {node.isCollapsed ? (
            <span>+{node.directReportsCount}</span>
          ) : (
            <ChevronDown size={14} />
          )}
        </button>
      )}
    </div>
  );
}
