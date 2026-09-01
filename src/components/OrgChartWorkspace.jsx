import React, { useState } from 'react';
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  FileCode, 
  Download, 
  Filter, 
  GitMerge, 
  GitBranch, 
  ArrowLeftRight, 
  Sparkles, 
  SlidersHorizontal, 
  ChevronsDown, 
  ChevronsUp, 
  Image as ImageIcon, 
  FileText, 
  Loader2, 
  BarChart2,
  RefreshCcw
} from 'lucide-react';
import { DEPARTMENTS } from '../data/initialData';
import { computeOrgStats } from '../utils/orgUtils';

export default function OrgChartWorkspace({
  members,
  departmentFilter,
  setDepartmentFilter,
  levelFilter,
  setLevelFilter,
  matchCount,
  totalCount,
  layoutMode,
  setLayoutMode,
  cardMode,
  setCardMode,
  showMatrixLines,
  setShowMatrixLines,
  onExpandAll,
  onCollapseAll,
  onExportPng,
  onExportPdf,
  onReloadJson,
  isJsonLoading,
  children
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const stats = computeOrgStats(members);

  const handleDownloadJsonFile = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(members, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `members.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePngExport = async () => {
    setExportingPng(true);
    try {
      await onExportPng();
    } finally {
      setExportingPng(false);
    }
  };

  const handlePdfExport = async () => {
    setExportingPdf(true);
    try {
      await onExportPdf();
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className={`workspace-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Collapsible Left Sidebar Control Panel */}
      <aside className="workspace-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-icon-box">
              <FileCode size={18} />
            </div>
            <div>
              <div className="sidebar-title">Workspace Controls</div>
              <div className="sidebar-subtitle">OrgChart Engine v2.0</div>
            </div>
          </div>

          <button
            className="sidebar-toggle-btn"
            onClick={() => setIsSidebarOpen(false)}
            title="Collapse Sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <div className="sidebar-content">
          {/* JSON Data Engine Section */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <FileCode size={14} className="section-icon" />
              <span>Data Engine</span>
            </div>

            <div className="excel-status-card">
              <div className="excel-badge">
                <span className="dot pulse" />
                <span>Live Data</span>
              </div>
              <p className="excel-desc">
                Synced with live data source. ({members.length} Employees Loaded)
              </p>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  className="btn btn-primary excel-download-btn"
                  onClick={handleDownloadJsonFile}
                  title="Download current dataset as JSON"
                >
                  <Download size={14} />
                  <span>Download JSON</span>
                </button>

                <button
                  className="icon-btn"
                  onClick={onReloadJson}
                  title="Reload live data source"
                  disabled={isJsonLoading}
                >
                  <RefreshCcw size={14} className={isJsonLoading ? 'spin' : ''} />
                </button>
              </div>
            </div>
          </div>

          {/* Department & Seniority Filters */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <Filter size={14} className="section-icon" />
              <span>Hierarchy Filters</span>
            </div>

            <div className="sidebar-form-group">
              <label className="sidebar-label">Department</label>
              <select
                className="select-box sidebar-select"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="all">All Departments ({members.length})</option>
                {Object.keys(DEPARTMENTS).map(deptKey => (
                  <option key={deptKey} value={deptKey}>
                    {DEPARTMENTS[deptKey].name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sidebar-form-group">
              <label className="sidebar-label">Seniority Level</label>
              <select
                className="select-box sidebar-select"
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
            </div>

            {(departmentFilter !== 'all' || levelFilter !== 'all') && (
              <div className="filter-count-badge">
                Showing {matchCount} of {totalCount} members
              </div>
            )}
          </div>

          {/* Layout Mode Switcher */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <GitBranch size={14} className="section-icon" />
              <span>Trunk Layout Engine</span>
            </div>

            <div className="sidebar-layout-buttons">
              <button
                className={`sidebar-layout-btn ${layoutMode === 'waterfall' ? 'active' : ''}`}
                onClick={() => setLayoutMode('waterfall')}
              >
                <GitMerge size={15} />
                <span>Waterfall Branch</span>
              </button>

              <button
                className={`sidebar-layout-btn ${layoutMode === 'classic' ? 'active' : ''}`}
                onClick={() => setLayoutMode('classic')}
              >
                <GitBranch size={15} />
                <span>Classic Spanning</span>
              </button>

              <button
                className={`sidebar-layout-btn ${layoutMode === 'horizontal' ? 'active' : ''}`}
                onClick={() => setLayoutMode('horizontal')}
              >
                <ArrowLeftRight size={15} />
                <span>Horizontal Tree</span>
              </button>
            </div>
          </div>

          {/* Display & Matrix Line Toggles */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <SlidersHorizontal size={14} className="section-icon" />
              <span>Display Preferences</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                className={`btn btn-secondary ${showMatrixLines ? 'active-purple' : ''}`}
                onClick={() => setShowMatrixLines(!showMatrixLines)}
                title="Toggle Matrix Lines"
                style={{ fontSize: 12, padding: '6px 8px' }}
              >
                <Sparkles size={14} />
                <span>Matrix</span>
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => setCardMode(cardMode === 'detailed' ? 'compact' : 'detailed')}
                style={{ fontSize: 12, padding: '6px 8px' }}
              >
                <SlidersHorizontal size={14} />
                <span>{cardMode === 'detailed' ? 'Compact' : 'Detailed'}</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={onExpandAll} style={{ fontSize: 12 }}>
                <ChevronsDown size={14} />
                <span>Expand All</span>
              </button>
              <button className="btn btn-secondary" onClick={onCollapseAll} style={{ fontSize: 12 }}>
                <ChevronsUp size={14} />
                <span>Collapse</span>
              </button>
            </div>
          </div>

          {/* Export High-DPI Capture */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <ImageIcon size={14} className="section-icon" />
              <span>Export High-DPI</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                className="btn btn-secondary"
                onClick={handlePngExport}
                disabled={exportingPng}
                style={{ fontSize: 12 }}
              >
                {exportingPng ? <Loader2 size={14} className="spin" /> : <ImageIcon size={14} />}
                <span>PNG</span>
              </button>

              <button
                className="btn btn-secondary"
                onClick={handlePdfExport}
                disabled={exportingPdf}
                style={{ fontSize: 12 }}
              >
                {exportingPdf ? <Loader2 size={14} className="spin" /> : <FileText size={14} />}
                <span>PDF</span>
              </button>
            </div>
          </div>

          {/* Org Statistics Summary */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <BarChart2 size={14} className="section-icon" />
              <span>Org Overview</span>
            </div>

            <div className="sidebar-stats-grid">
              <div className="stat-pill">
                <span className="stat-num">{stats.total}</span>
                <span className="stat-lbl">Members</span>
              </div>
              <div className="stat-pill">
                <span className="stat-num">{stats.totalManagers}</span>
                <span className="stat-lbl">Managers</span>
              </div>
              <div className="stat-pill">
                <span className="stat-num">{stats.totalICs}</span>
                <span className="stat-lbl">ICs</span>
              </div>
              <div className="stat-pill">
                <span className="stat-num">{stats.avgSpanOfControl}</span>
                <span className="stat-lbl">Avg Span</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Floating Toggle Button when Sidebar is Collapsed */}
      {!isSidebarOpen && (
        <button
          className="sidebar-open-floating-btn"
          onClick={() => setIsSidebarOpen(true)}
          title="Expand Workspace Controls Sidebar"
        >
          <PanelLeftOpen size={20} />
        </button>
      )}

      {/* Main Workspace Content Area */}
      <div className="workspace-main-content">
        {children}
      </div>
    </div>
  );
}
