import React, { useState, useMemo, useRef } from 'react';
import {
  Crosshair,
  RotateCcw,
  ChevronsDown,
  ChevronsUp,
  ZoomIn,
  ZoomOut,
  Maximize2,
  SlidersHorizontal,
  FileDown,
  FileType
} from 'lucide-react';
import ManagerPicker from './ManagerPicker';
import OrgCanvas from './OrgCanvas';
import { buildFocusTree, computeCollapseStateFromRoot } from '../utils/orgUtils';
import { exportOrgChartToPpt } from '../utils/exportPpt';
import { downloadSmartArtOutline, SMARTART_PRACTICAL_LIMIT } from '../utils/exportSmartArtOutline';

// Same depth-1 default (root + direct reports expanded, everything deeper collapsed)
// as the main Tree - see computeCollapseStateFromRoot in orgUtils.js.
const FOCUS_AUTO_EXPAND_DEPTH = 1;

// A completely separate page from the main Tree/Directory/Analytics tabs (see the
// "Focus View" tab in Header.jsx) - none of those tabs' own code paths are touched by
// this file. Shows ONE chosen employee's subtree in isolation: that employee plus
// everyone who reports to them (directly or through a chain of managers), with
// everyone above and beside them left out entirely - not just visually hidden, they're
// never even loaded into the tree (see buildFocusTree). Deliberately session-only
// (no shareable link/URL) and starts from a blank picker every time this tab is
// opened or "Change Employee" is clicked - confirmed with the user rather than
// assumed. Reuses OrgCanvas as-is for the actual rendering (zoom/pan/wrap-grid/
// fit-to-screen all come for free), and ManagerPicker (already built as a
// searchable, capped-results employee lookup for the "Reports To" field) for
// choosing the starting employee - not new UI, less to get wrong twice.
export default function FocusView({ members, displayField, hideNames, cardMode, setCardMode }) {
  const [focusRootId, setFocusRootId] = useState(null);
  const [collapseState, setCollapseState] = useState({});
  const [zoom, setZoom] = useState(1);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const fitToScreenRef = useRef(null);

  const { root: treeRoot, memberMap } = useMemo(() => {
    if (!focusRootId) return { root: null, memberMap: new Map() };
    return buildFocusTree(members, focusRootId, collapseState);
  }, [members, focusRootId, collapseState]);

  const handleChooseRoot = (memberId) => {
    setFocusRootId(memberId);
    setSelectedMember(null);
    setZoom(1);
    setCollapseState(memberId ? computeCollapseStateFromRoot(members, memberId, FOCUS_AUTO_EXPAND_DEPTH) : {});
  };

  const handleToggleCollapse = (nodeId) => {
    setCollapseState((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleExpandAll = () => setCollapseState({});

  const handleCollapseAll = () => {
    const next = {};
    memberMap.forEach((node) => {
      if (node.children && node.children.length > 0) next[node.id] = true;
    });
    setCollapseState(next);
  };

  const handleExportPpt = async () => {
    if (!treeRoot) return;
    setIsExporting(true);
    try {
      await exportOrgChartToPpt(treeRoot, {
        displayField,
        hideNames,
        title: `${treeRoot.name}'s Team Structure`,
        fileName: `org-chart-${treeRoot.name.replace(/\s+/g, '-').toLowerCase()}.pptx`
      });
    } catch (err) {
      window.alert(`Could not generate the PPT: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // The OTHER hierarchy option - a paste-able outline for PowerPoint's OWN
  // SmartArt (see exportSmartArtOutline.js for why that can't just be generated
  // directly). SmartArt itself gets unreadable well before real org sizes, so
  // this warns rather than silently producing something that will look broken
  // the moment it's pasted in - but still lets the user proceed if they want to.
  const handleDownloadSmartArt = () => {
    if (!treeRoot) return;
    const count = treeRoot.totalSubtreeCount + 1;
    if (count > SMARTART_PRACTICAL_LIMIT) {
      const proceed = window.confirm(
        `${treeRoot.name}'s team is ${count} people. PowerPoint's own SmartArt Hierarchy ` +
        `gets cramped and hard to read well before that size (roughly ${SMARTART_PRACTICAL_LIMIT}) - ` +
        `there's no auto-pagination like the PPT export above. Download the outline anyway?`
      );
      if (!proceed) return;
    }
    downloadSmartArtOutline(treeRoot, {
      displayField,
      hideNames,
      fileName: `org-chart-${treeRoot.name.replace(/\s+/g, '-').toLowerCase()}-smartart-outline.txt`
    });
  };

  if (!focusRootId) {
    return (
      <div className="focus-picker-screen">
        <div className="focus-picker-card">
          <Crosshair size={28} style={{ color: 'var(--accent-primary)' }} />
          <h2>Focus On One Employee</h2>
          <p>
            Pick a starting employee to see their team on its own page - that person
            plus everyone below them. Everyone above and beside them is left out.
          </p>
          <ManagerPicker
            members={members}
            value={null}
            onChange={handleChooseRoot}
            placeholder="Search for an employee..."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="focus-view-container">
      <div className="controls-toolbar">
        <div className="toolbar-group">
          <button className="btn btn-secondary" onClick={() => handleChooseRoot(null)}>
            <RotateCcw size={14} />
            <span>Change Employee</span>
          </button>
          {treeRoot && (
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
              {treeRoot.name} + {treeRoot.totalSubtreeCount} report{treeRoot.totalSubtreeCount === 1 ? '' : 's'} below
            </span>
          )}
        </div>

        <div className="toolbar-group">
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={() => setCardMode(cardMode === 'detailed' ? 'compact' : 'detailed')}
          >
            <SlidersHorizontal size={14} />
            <span>{cardMode === 'detailed' ? 'Detailed' : 'Compact'}</span>
          </button>
          <button className="icon-btn" onClick={handleExpandAll} title="Expand All Branches">
            <ChevronsDown size={16} />
          </button>
          <button className="icon-btn" onClick={handleCollapseAll} title="Collapse All Branches">
            <ChevronsUp size={16} />
          </button>
        </div>

        <div className="toolbar-group">
          <button className="icon-btn" onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))} title="Zoom Out">
            <ZoomOut size={16} />
          </button>
          <span className="zoom-badge">{Math.round(zoom * 100)}%</span>
          <button className="icon-btn" onClick={() => setZoom((z) => Math.min(z + 0.15, 2.0))} title="Zoom In">
            <ZoomIn size={16} />
          </button>
          <button className="icon-btn" onClick={() => setZoom(1)} title="Reset View">
            <RotateCcw size={15} />
          </button>
          <button
            className="icon-btn"
            onClick={() => fitToScreenRef.current && fitToScreenRef.current()}
            title="Fit whole team to screen"
          >
            <Maximize2 size={15} />
          </button>

          <div style={{ height: 16, width: 1, background: 'var(--border-subtle)' }} />

          <button
            className="btn btn-secondary"
            onClick={handleDownloadSmartArt}
            title={`Paste into PowerPoint's Insert > SmartArt > Hierarchy Text Pane for a real native SmartArt diagram (best under ~${SMARTART_PRACTICAL_LIMIT} people)`}
          >
            <FileType size={14} />
            <span>SmartArt Outline (.txt)</span>
          </button>

          <button className="btn btn-primary" onClick={handleExportPpt} disabled={isExporting}>
            <FileDown size={14} />
            <span>{isExporting ? 'Exporting...' : 'Export to PPT'}</span>
          </button>
        </div>
      </div>

      <div className="focus-canvas-area">
        <OrgCanvas
          treeRoot={treeRoot}
          allMembers={members}
          selectedMember={selectedMember}
          searchMatches={null}
          searchPathIds={null}
          focusedNodeId={null}
          zoom={zoom}
          layoutMode="waterfall"
          cardMode={cardMode}
          displayField={displayField}
          hideNames={hideNames}
          onSelectMember={setSelectedMember}
          onToggleCollapse={handleToggleCollapse}
          onZoomChange={setZoom}
          onRegisterFitToScreen={(fn) => { fitToScreenRef.current = fn; }}
        />
      </div>
    </div>
  );
}
