import React, { useState } from 'react';
import { ChevronDown, MapPin, Users, AlertTriangle, GitBranch } from 'lucide-react';
import { DEPARTMENTS } from '../data/initialData';
import { getDisplayLabels, toIdArray } from '../utils/orgUtils';

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
  displayField = 'name',
  hideNames = false,
  membersById,
  dottedReportsByManagerId,
  onSelect,
  onToggleCollapse,
  onJumpToMember
}) {
  // See getDisplayLabels in orgUtils.js for the shared rule (also used by the PPT
  // export) - primary is whatever field "Display by" picked (Name by default), falling
  // back to Designation if Hide Names is on and Name was picked; secondary is
  // Designation unless that's already the primary, in which case it's Department.
  const { primary, secondary } = getDisplayLabels(node, { displayField, hideNames });
  // Initials/alt text are derived from the same value the card actually shows, not the
  // raw name - so turning Hide Names on doesn't leak an identity through the avatar
  // fallback or a hover tooltip that a hidden name wouldn't otherwise reveal.
  const identityLabel = hideNames ? primary : node.name;

  const deptInfo = DEPARTMENTS[node.department] || {
    name: node.department,
    color: '#6366f1',
    bg: 'rgba(99, 102, 241, 0.15)'
  };

  // Card top accent bar + avatar-initials circle color, by STATUS rather than
  // Department - the department name chip (node-dept-tag below) still uses
  // deptInfo.color/bg as-is and is unaffected. Before this, both the bar and the
  // initials circle used deptInfo.color too, which meant every employee in a
  // department not listed in DEPARTMENTS (initialData.js) - a very normal thing on
  // a large real Sheet - fell back to the same generic indigo/violet, regardless of
  // whether that person was Active, Inactive, or anything else. An unrecognized
  // status string falls back to the same neutral gray the status-dot uses for
  // Inactive, not indigo - so a data mismatch here can no longer look like "the
  // app's default color" again.
  const STATUS_ACCENT_COLORS = {
    active: 'var(--status-accent-active)',
    'on-leave': 'var(--status-accent-leave)',
    hiring: 'var(--status-accent-hiring)',
    inactive: 'var(--status-accent-inactive)'
  };
  const statusAccentColor = STATUS_ACCENT_COLORS[node.status] || '#6b7280';

  const hasChildren = node.children && node.children.length > 0;
  const isCompact = cardMode === 'compact';
  const isFocused = focusedNodeId === node.id;

  // Dotted-line/matrix manager(s) - see MemberModal.jsx's "Also Reports To" field. This
  // badge shows the name(s) regardless of whether that person is anywhere in the
  // currently-rendered tree (membersById is built from the WHOLE company, not just the
  // visible subset - see OrgCanvas.jsx), since a dashed connector line can only be drawn
  // when both cards happen to be on screen at once (see the matrixLines effect there) -
  // this badge is what still communicates the relationship the rest of the time. Kept as
  // full {id, name} entries, not just names, so the popover below can jump to any of them
  // even when they're an arbitrary distance away in the tree.
  const matrixManagerEntries = toIdArray(node.matrixManagerId)
    .map((id) => membersById?.get(id))
    .filter(Boolean);
  const matrixManagerNames = matrixManagerEntries.map((m) => m.name);

  // The REVERSE direction of the same relationship - people who list THIS node as
  // one of THEIR dotted managers. Without this, the only visual sign that someone is
  // a dotted-line manager for anyone was the dashed connector line itself, which only
  // ever appears when both cards happen to be rendered on screen at the same time -
  // if the report's branch is collapsed elsewhere, this card gave no hint at all.
  const dottedManagerReports = dottedReportsByManagerId?.get(node.id) || [];
  const dottedManagerForNames = dottedManagerReports.map((m) => m.name);

  // Which of the two badge popovers ("Also reports to" / "Dotted-line manager for N") is
  // currently open, if any - a manager+reportee pair can be an arbitrary distance apart on
  // the canvas (the whole reason this exists - see the "long gap/distance" feature this
  // popover was built for), so rather than trying to draw a line across a potentially huge
  // span, clicking the badge opens a small list of the actual name(s), and clicking a name
  // jumps the camera straight to that person's card (via onJumpToMember - auto-expands any
  // collapsed branch in the way and pulses the target, see handleJumpToMember in App.jsx).
  const [openPopover, setOpenPopover] = useState(null); // 'outgoing' | 'incoming' | null

  const handleJumpClick = (e, memberId) => {
    e.stopPropagation();
    setOpenPopover(null);
    onJumpToMember?.(memberId);
  };

  // Real photo if one is set and hasn't failed to load; otherwise a local, drawn
  // initials badge - not another remote URL. The old fallback swapped to a SECOND
  // ui-avatars.com URL on error, which is still a network request that can itself
  // fail (or just be slow/blocked), leaving the card showing the browser's tiny
  // broken-image glyph instead of a missing photo looking intentional. A same-origin,
  // no-network initials badge can't fail to load at all, so it can't produce that.
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
      className={`org-node-card ${isCompact ? 'compact' : ''} ${isSelected ? 'selected' : ''} ${isSearchMatch ? 'search-match' : ''} ${isFocused ? 'focused-pulse' : ''} ${isDimmed ? 'dimmed' : ''} ${openPopover ? 'has-open-popover' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node);
      }}
    >
      {/* Status accent line at top (Active/On Leave/Hiring/Inactive) - was Department
          color before, see statusAccentColor above for why that changed. */}
      <div
        className="node-dept-bar"
        style={{ background: statusAccentColor }}
      />

      {/* Employee ID, top-right corner - on its OWN row above node-header, not sharing
          the name's row. Two earlier attempts both cost the name width: absolutely
          positioned, it floated over the name text in Compact mode; as a flex sibling
          of node-main-info in the same row as the avatar, it shrank node-main-info's
          available width and made long names ellipsize much sooner ("Rajesh Bal...").
          A dedicated row above costs a little vertical space instead of horizontal
          space, so the name/title below get the card's FULL width again, unchanged
          from before this badge existed. title carries the full id in case it's longer
          than the badge's own max-width. */}
      <div className="node-id-row">
        <div className="node-id-badge" title={`Employee ID: ${node.id}`}>
          {node.id}
        </div>
      </div>

      <div className="node-header">
        <div className="avatar-wrapper">
          {hasPhoto ? (
            <img
              src={node.avatar}
              alt={identityLabel}
              className="node-avatar"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div
              className="node-avatar node-avatar-initials"
              style={{ background: statusAccentColor }}
              title={identityLabel}
            >
              {getInitials(identityLabel)}
            </div>
          )}
          <div className={`status-dot ${node.status}`} title={`Status: ${node.status}`} />
        </div>

        <div className="node-main-info">
          <div className="node-name" title={primary}>{primary}</div>
          {secondary && <div className="node-title" title={secondary}>{secondary}</div>}

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

      {/* Invisible full-canvas click-catcher, only mounted while a popover is open - lets
          clicking anywhere else close it, same pattern as the member drawer's own backdrop,
          just without darkening the screen since this is a much smaller, transient popover. */}
      {openPopover && (
        <div
          className="node-badge-popover-backdrop"
          onClick={(e) => { e.stopPropagation(); setOpenPopover(null); }}
        />
      )}

      {matrixManagerNames.length > 0 && (
        <div
          className="node-matrix-row node-badge-row-clickable"
          title={`Also reports to (dotted-line): ${matrixManagerNames.join(', ')} - click to jump to any of them`}
          onClick={(e) => { e.stopPropagation(); setOpenPopover((prev) => (prev === 'outgoing' ? null : 'outgoing')); }}
        >
          <GitBranch size={11} />
          <span>Also reports to: {matrixManagerNames.join(', ')}</span>

          {openPopover === 'outgoing' && (
            <div className="node-badge-popover" onClick={(e) => e.stopPropagation()}>
              {matrixManagerEntries.map((m) => (
                <div key={m.id} className="node-badge-popover-item" onClick={(e) => handleJumpClick(e, m.id)}>
                  {m.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reciprocal direction of the badge above - this person IS a dotted manager
          for someone else. Visually distinguished (violet, not pink) so the two
          directions never read as the same relationship at a glance. */}
      {dottedManagerForNames.length > 0 && (
        <div
          className="node-dotted-manager-row node-badge-row-clickable"
          title={`Dotted-line manager for: ${dottedManagerForNames.join(', ')} - click to jump to any of them`}
          onClick={(e) => { e.stopPropagation(); setOpenPopover((prev) => (prev === 'incoming' ? null : 'incoming')); }}
        >
          <GitBranch size={11} style={{ transform: 'scaleX(-1)' }} />
          <span>
            Dotted-line manager for {dottedManagerForNames.length}{' '}
            {dottedManagerForNames.length === 1 ? 'person' : 'people'}
          </span>

          {openPopover === 'incoming' && (
            <div className="node-badge-popover" onClick={(e) => e.stopPropagation()}>
              {dottedManagerReports.map((m) => (
                <div key={m.id} className="node-badge-popover-item" onClick={(e) => handleJumpClick(e, m.id)}>
                  {m.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
