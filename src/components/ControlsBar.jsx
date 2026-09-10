import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  GitMerge,
  GitBranch,
  ArrowLeftRight,
  ChevronsDown,
  ChevronsUp,
  SlidersHorizontal,
  Filter,
  Tags,
  UserX
} from 'lucide-react';
import { DEPARTMENTS } from '../data/initialData';

export default function ControlsBar({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
  layoutMode,
  setLayoutMode,
  cardMode,
  setCardMode,
  departmentFilter,
  setDepartmentFilter,
  levelFilter,
  setLevelFilter,
  entityFilter,
  setEntityFilter,
  availableDepartments = [],
  availableLevels = [],
  availableEntities = [],
  onExpandAll,
  onCollapseAll,
  matchCount,
  totalCount,
  displayField = 'name',
  setDisplayField,
  hideNames = false,
  setHideNames
}) {
  // Hiding names while the card's primary field is still set to "Name" is a
  // contradiction (getDisplayLabels in orgUtils.js resolves it by falling back to
  // Designation) - checking "Hide Names" here snaps the dropdown to Designation right
  // away instead of leaving it showing "Name" while the card silently shows something
  // else, which would look like a bug rather than the actual (documented) fallback.
  const handleHideNamesToggle = (checked) => {
    setHideNames(checked);
    if (checked && displayField === 'name') {
      setDisplayField('title');
    }
  };
  return (
    <div className="controls-toolbar">
      {/* Left: Department & Level Filters */}
      <div className="toolbar-group">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
          <Filter size={14} />
          <span style={{ fontWeight: 600 }}>Filter:</span>
        </div>

        <select
          className="select-box"
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
        >
          <option value="all">All Departments</option>
          {/* Built from the departments actually present in the loaded data (see
              availableDepartments in App.jsx) - not a hardcoded list - so a department
              string the live Sheet introduces always has a matching option. Falls back
              to DEPARTMENTS' friendly name for the known keys, or the raw value for
              anything custom. */}
          {availableDepartments.map(deptKey => (
            <option key={deptKey} value={deptKey}>
              {DEPARTMENTS[deptKey]?.name || deptKey}
            </option>
          ))}
        </select>

        <select
          className="select-box"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
        >
          <option value="all">All Seniority Levels</option>
          {/* Same idea as the department list above - see availableLevels in App.jsx. */}
          {availableLevels.map(level => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>

        <select
          className="select-box"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
        >
          <option value="all">All Entities</option>
          {/* Same idea as Department/Level above - built from the 'entity' column
              actually present in the loaded data (see availableEntities in App.jsx),
              not a hardcoded list. */}
          {availableEntities.map(entity => (
            <option key={entity} value={entity}>{entity}</option>
          ))}
        </select>

        {(departmentFilter !== 'all' || levelFilter !== 'all' || entityFilter !== 'all') && (
          <span style={{ fontSize: 12, color: 'var(--accent-primary)', fontWeight: 600 }}>
            Showing {matchCount} of {totalCount}
          </span>
        )}
      </div>

      {/* Display Mode: what a card's PRIMARY (bold) line shows, and whether real names
          are hidden entirely - for presenting by designation/department/entity/projects
          instead of by name (see getDisplayLabels in orgUtils.js for the exact rule,
          shared with the PPT export so an exported deck always matches what's on
          screen). */}
      <div className="toolbar-group">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
          <Tags size={14} />
          <span style={{ fontWeight: 600 }}>Display:</span>
        </div>

        <select
          className="select-box"
          value={displayField}
          onChange={(e) => setDisplayField(e.target.value)}
          title="What each card shows as its main label"
        >
          <option value="name">Name</option>
          <option value="title">Designation</option>
          <option value="department">Department</option>
          <option value="entity">Entity</option>
          <option value="projects">Projects</option>
        </select>

        <label
          className="btn btn-secondary"
          style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
          title="Never show a real name on any card, regardless of the Display field above"
        >
          <input
            type="checkbox"
            checked={hideNames}
            onChange={(e) => handleHideNamesToggle(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          <UserX size={14} />
          <span style={{ marginLeft: 4 }}>Hide Names</span>
        </label>
      </div>

      {/* Center: Layout Mode Switches & Actions */}
      <div className="toolbar-group">
        <div style={{ display: 'flex', background: 'var(--bg-input)', padding: 3, borderRadius: 'var(--radius-md)', border: 'var(--glass-border)' }}>
          <button
            className={`view-tab ${layoutMode === 'waterfall' ? 'active' : ''}`}
            onClick={() => setLayoutMode('waterfall')}
            title="Waterfall Branch Layout (WorkforceVision Stacked Tree)"
          >
            <GitMerge size={14} />
            <span>Waterfall Tree</span>
          </button>
          <button
            className={`view-tab ${layoutMode === 'classic' ? 'active' : ''}`}
            onClick={() => setLayoutMode('classic')}
            title="Classic Top-Down Spanning Tree"
          >
            <GitBranch size={14} />
            <span>Classic Spanning</span>
          </button>
          <button
            className={`view-tab ${layoutMode === 'horizontal' ? 'active' : ''}`}
            onClick={() => setLayoutMode('horizontal')}
            title="Horizontal Left-Right Tree"
          >
            <ArrowLeftRight size={14} />
            <span>Horizontal</span>
          </button>
        </div>

        <div style={{ height: 16, width: 1, background: 'var(--border-subtle)' }} />

        <button
          className="btn btn-secondary"
          style={{ padding: '4px 10px', fontSize: 12 }}
          onClick={() => setCardMode(cardMode === 'detailed' ? 'compact' : 'detailed')}
        >
          <SlidersHorizontal size={14} />
          <span>{cardMode === 'detailed' ? 'Detailed' : 'Compact'}</span>
        </button>

        <div style={{ height: 16, width: 1, background: 'var(--border-subtle)' }} />

        <button
          className="icon-btn"
          onClick={onExpandAll}
          title="Expand All Branches"
        >
          <ChevronsDown size={16} />
        </button>
        <button
          className="icon-btn"
          onClick={onCollapseAll}
          title="Collapse All Branches"
        >
          <ChevronsUp size={16} />
        </button>
      </div>

      {/* Right: Zoom Controls */}
      <div className="toolbar-group">
        <button className="icon-btn" onClick={onZoomOut} title="Zoom Out">
          <ZoomOut size={16} />
        </button>
        <span className="zoom-badge">{Math.round(zoom * 100)}%</span>
        <button className="icon-btn" onClick={onZoomIn} title="Zoom In">
          <ZoomIn size={16} />
        </button>
        <button className="icon-btn" onClick={onResetZoom} title="Reset View">
          <RotateCcw size={15} />
        </button>
        <button className="icon-btn" onClick={onFitToScreen} title="Fit whole tree to screen">
          <Maximize2 size={15} />
        </button>
      </div>
    </div>
  );
}
