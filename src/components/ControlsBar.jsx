import React, { useState } from 'react';
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
  Sparkles,
  Image as ImageIcon,
  FileText,
  Loader2
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
  showMatrixLines,
  setShowMatrixLines,
  departmentFilter,
  setDepartmentFilter,
  levelFilter,
  setLevelFilter,
  onExpandAll,
  onCollapseAll,
  matchCount,
  totalCount,
  onExportPng,
  onExportPdf
}) {
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handlePngClick = async () => {
    setExportingPng(true);
    try {
      await onExportPng();
    } finally {
      setExportingPng(false);
    }
  };

  const handlePdfClick = async () => {
    setExportingPdf(true);
    try {
      await onExportPdf();
    } finally {
      setExportingPdf(false);
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
          {Object.keys(DEPARTMENTS).map(deptKey => (
            <option key={deptKey} value={deptKey}>
              {DEPARTMENTS[deptKey].name}
            </option>
          ))}
        </select>

        <select
          className="select-box"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
        >
          <option value="all">All Seniority Levels</option>
          <option value="C-Level">C-Level</option>
          <option value="VP">VP</option>
          <option value="Director">Director</option>
          <option value="Lead">Lead</option>
          <option value="Senior">Senior</option>
          <option value="Mid">Mid</option>
        </select>

        {(departmentFilter !== 'all' || levelFilter !== 'all') && (
          <span style={{ fontSize: 12, color: 'var(--accent-primary)', fontWeight: 600 }}>
            Showing {matchCount} of {totalCount}
          </span>
        )}
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

        {/* Matrix Lines Toggle */}
        <button
          className={`btn btn-secondary ${showMatrixLines ? 'active' : ''}`}
          style={{ 
            padding: '4px 10px', 
            fontSize: 12,
            background: showMatrixLines ? 'rgba(139, 92, 246, 0.2)' : undefined,
            color: showMatrixLines ? '#8b5cf6' : undefined,
            borderColor: showMatrixLines ? 'rgba(139, 92, 246, 0.4)' : undefined
          }}
          onClick={() => setShowMatrixLines(!showMatrixLines)}
          title="Toggle Dotted Matrix Reporting Lines"
        >
          <Sparkles size={14} />
          <span>Matrix Lines</span>
        </button>

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

        <div style={{ height: 16, width: 1, background: 'var(--border-subtle)' }} />

        {/* EXPORT TO PNG & PDF BUTTONS */}
        <button
          className="btn btn-secondary export-btn"
          onClick={handlePngClick}
          disabled={exportingPng}
          title="Export high-resolution PNG image"
        >
          {exportingPng ? <Loader2 size={14} className="spin" /> : <ImageIcon size={14} />}
          <span>{exportingPng ? 'Exporting...' : 'Export PNG'}</span>
        </button>

        <button
          className="btn btn-secondary export-btn"
          onClick={handlePdfClick}
          disabled={exportingPdf}
          title="Export high-resolution PDF document"
        >
          {exportingPdf ? <Loader2 size={14} className="spin" /> : <FileText size={14} />}
          <span>{exportingPdf ? 'Exporting...' : 'Export PDF'}</span>
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
