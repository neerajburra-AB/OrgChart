import React, { useState } from 'react';
import { ChevronDown, MapPin, Users, AlertTriangle } from 'lucide-react';
import { DEPARTMENTS } from '../data/initialData';

// First letter of up to the first two words of a name, e.g. "Elena Rostova" -> "ER".
// Used as a network-independent avatar fallback - see the avatarFailed state below.
function getInitials(name) {
  if (!name) return '?';
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('');
  return initials || '?';
}

export default function OrgNode({
  node,
  isSelected,
  isSearchMatch,
  isDimmed,
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

  // Real photo if one is set and hasn't failed to load; otherwise a local, drawn
  // initials badge - not another remote URL. The old fallback swapped to a SECOND
  // ui-avatars.com URL on error, which is still a network request that can itself
  // fail (or just be slow/blocked), leaving the <img> in a broken or perpetually-
  // loading state. That's a real problem beyond just a missing photo: "Export PNG/PDF"
  // captures the DOM with html2canvas, and a broken/half-loaded <img> gets captured as
  // whatever the browser's tiny broken-image glyph looks like at that moment, which
  // then gets scaled up by the export's 2x resolution - producing the blurry/pixelated
  // avatar squares in exported charts. A same-origin, no-network initials badge can't
  // fail to load at all, so it can't produce that artifact.
  const [avatarFailed, setAvatarFailed] = useState(false);
  const hasPhoto = !!node.avatar && !avatarFailed;

  // The synthetic "Unknown RM" grouping node (see UNASSIGNED_MANAGER_ID in orgUtils.js)
  // isn't a real employee - it doesn't have a profile to open, so clicking it shouldn't
  // open the member drawer/edit modal like a normal card would.
  if (node.isVirtual) {
    return (
      <div
        data-node-id={node.id}
        className={`org-node-card virtual-node ${isCompact ? 'compact' : ''} ${isFocused ? 'focused-pulse' : ''} ${isDimmed ? 'dimmed' : ''}`}
      >
        <div className="node-header">
          <div className="avatar-wrapper">
            <div className="node-avatar virtual-node-icon">
              <AlertTriangle size={20} />
            </div>
          </div>

          <div className="node-main-info">
            <div className="node-name" title={node.name}>{node.name}</div>
            <div className="node-title" title={node.title}>{node.title}</div>
          </div>
        </div>

        {hasChildren && (
          <button
            className="expand-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(node.id);
            }}
            title={node.isCollapsed ? `Expand ${node.directReportsCount} employee(s)` : 'Collapse'}
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

  return (
    <div
      data-node-id={node.id}
      data-department={node.department}
      className={`org-node-card ${isCompact ? 'compact' : ''} ${isSelected ? 'selected' : ''} ${isSearchMatch ? 'search-match' : ''} ${isFocused ? 'focused-pulse' : ''} ${isDimmed ? 'dimmed' : ''}`}
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
          {hasPhoto ? (
            <img
              src={node.avatar}
              alt={node.name}
              className="node-avatar"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div
              className="node-avatar node-avatar-initials"
              style={{ background: deptInfo.color }}
              title={node.name}
            >
              {getInitials(node.name)}
            </div>
          )}
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
