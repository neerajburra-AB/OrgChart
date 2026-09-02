import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Header from './components/Header';
import ControlsBar from './components/ControlsBar';
import OrgCanvas from './components/OrgCanvas';
import ListView from './components/ListView';
import AnalyticsView from './components/AnalyticsView';
import MemberDrawer from './components/MemberDrawer';
import MemberModal from './components/MemberModal';
import ImportExportModal from './components/ImportExportModal';
import OrgChartWorkspace from './components/OrgChartWorkspace';

import { INITIAL_MEMBERS } from './data/initialData';
import {
  buildOrgTree,
  filterMembers,
  getAncestorIds,
  UNASSIGNED_MANAGER_ID
} from './utils/orgUtils';
import { exportToPNG, exportToPDF } from './utils/exportUtils';
import * as XLSX from 'xlsx';

const STORAGE_KEY = 'orgpulse_members_data';
const THEME_KEY = 'orgpulse_theme';

// Live data source: a Google Sheet published as CSV (File > Share > Publish to web > CSV).
// Update the URL below whenever you republish a new Sheet. Leave it as '' to skip straight
// to the bundled public/data/members.json file below.
const LIVE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1SA7KNxIUxZ5ed7KbaPSS7xva6O541RtMuwoTWPlQ-k6fsBzHeMq0VCWp9wUkKP9dq1y8-MzpgfJW/pub?gid=0&single=true&output=csv';

// Large-dataset safety net: past this many employees, the Tree view starts fully
// collapsed except the root and its direct reports, so the first render only has to
// draw a handful of cards instead of the entire company. Small/medium datasets keep
// the original fully-expanded-by-default behavior unchanged.
const LARGE_DATASET_THRESHOLD = 200;
const AUTO_EXPAND_DEPTH = 1; // 0 = only the root starts expanded, 1 = root + direct reports

function computeDefaultCollapseState(memberList) {
  // The synthetic "Unknown RM" grouping node (see UNASSIGNED_MANAGER_ID / buildOrgTree)
  // holds data-quality problem rows, not real top-level structure, so it always starts
  // collapsed regardless of org size - seeded here so it's collapsed from the very
  // first render, before any user has touched the collapse toggle.
  const baseCollapse = { [UNASSIGNED_MANAGER_ID]: true };

  if (!memberList || memberList.length <= LARGE_DATASET_THRESHOLD) {
    return baseCollapse;
  }

  const byId = new Map(memberList.map((m) => [m.id, m]));
  const childrenOf = new Map();
  memberList.forEach((m) => {
    if (m.managerId && byId.has(m.managerId)) {
      if (!childrenOf.has(m.managerId)) childrenOf.set(m.managerId, []);
      childrenOf.get(m.managerId).push(m.id);
    }
  });

  // Root for this BFS must be picked the same way buildOrgTree picks the real tree
  // root - genuinely blank managerId only. A non-blank-but-invalid managerId is a
  // data error, not a signal of being the top of the org (see buildOrgTree for the
  // full reasoning); using the same rule here keeps this default-collapse pass
  // aligned with the actual tree shape instead of starting from a random broken row.
  const root = memberList.find((m) => !m.managerId);
  if (!root) return baseCollapse;

  const collapse = { ...baseCollapse };
  const queue = [{ id: root.id, depth: 0 }];
  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    const kids = childrenOf.get(id) || [];
    if (kids.length > 0 && depth >= AUTO_EXPAND_DEPTH) {
      collapse[id] = true;
    }
    kids.forEach((childId) => queue.push({ id: childId, depth: depth + 1 }));
  }
  return collapse;
}

export default function App() {
  // Members state initialized with INITIAL_MEMBERS fallback
  const [members, setMembers] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse stored org members', e);
      }
    }
    return INITIAL_MEMBERS;
  });

  const [isJsonLoading, setIsJsonLoading] = useState(false);

  // Converts a raw spreadsheet row (from the live Google Sheet CSV) into a member object,
  // matching the exact shape used by public/data/members.json.
  const parseSheetRow = (row) => ({
    id: String(row.id ?? '').trim(),
    name: row.name ?? '',
    title: row.title ?? '',
    department: row.department ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    location: row.location ?? '',
    avatar: row.avatar ?? '',
    status: row.status ?? 'active',
    managerId: row.managerId ? String(row.managerId).trim() : null,
    matrixManagerId: row.matrixManagerId ? String(row.matrixManagerId).trim() : null,
    skills: row.skills
      ? String(row.skills).split('|').map((s) => s.trim()).filter(Boolean)
      : [],
    bio: row.bio ?? '',
    joinDate: row.joinDate ?? '',
    level: row.level ?? ''
  });

  // Try loading members from the live published Google Sheet CSV.
  // Returns the parsed member array, or null if the sheet couldn't be loaded/parsed.
  const loadLiveSheetMembers = async () => {
    if (!LIVE_SHEET_CSV_URL) return null;
    try {
      const res = await fetch(LIVE_SHEET_CSV_URL);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const csvText = await res.text();
      const workbook = XLSX.read(csvText, { type: 'string' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      const parsed = rows.map(parseSheetRow).filter((m) => m.id);

      return parsed.length > 0 ? parsed : null;
    } catch (err) {
      console.warn('Live Google Sheet load failed, falling back to bundled JSON:', err);
      return null;
    }
  };

  // Safe Data Engine: try the live Google Sheet CSV first (so day-to-day data edits show up
  // without a redeploy), then fall back to the bundled public/data/members.json, then to the
  // built-in sample dataset. Guarantees NO blank/white screen under any condition.
  const loadJsonMembers = useCallback(async () => {
    setIsJsonLoading(true);
    try {
      const liveMembers = await loadLiveSheetMembers();
      if (liveMembers) {
        setMembers(liveMembers);
        setCollapseState(computeDefaultCollapseState(liveMembers));
        return;
      }

      const baseUrl = import.meta.env.BASE_URL || '/';
      const jsonUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}data/members.json`;
      const res = await fetch(jsonUrl);

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        setMembers(data);
        setCollapseState(computeDefaultCollapseState(data));
      }
    } catch (err) {
      console.warn('JSON load fallback to default dataset:', err);
      // Fallback array guarantees NO blank/white screen under any condition
      setMembers(INITIAL_MEMBERS);
      setCollapseState(computeDefaultCollapseState(INITIAL_MEMBERS));
    } finally {
      setIsJsonLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJsonMembers();
  }, [loadJsonMembers]);

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
    } catch (err) {
      // Large datasets can exceed the browser's localStorage quota; fail soft
      // instead of throwing an uncaught error out of this effect.
      console.warn('Could not persist members to localStorage (dataset may be too large):', err);
    }
  }, [members]);

  // Theme State
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(THEME_KEY) || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // View Mode: 'tree' | 'list' | 'analytics'
  const [activeView, setActiveView] = useState('tree');

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');

  // Focused Node State (for Auto-Focus Camera Centering & Pulsing Glow)
  const [focusedNodeId, setFocusedNodeId] = useState(null);

  // Layout Controls State
  const [zoom, setZoom] = useState(1);
  const [layoutMode, setLayoutMode] = useState('waterfall'); // 'waterfall' | 'classic' | 'horizontal'
  const [cardMode, setCardMode] = useState('detailed'); // 'detailed' | 'compact'
  const [showMatrixLines, setShowMatrixLines] = useState(true);

  // Tree Node Collapse State map { nodeId: boolean }
  const [collapseState, setCollapseState] = useState({});

  // Selected Member for Side Drawer
  const [selectedMember, setSelectedMember] = useState(null);

  // Viewport DOM Element reference for Export PNG/PDF
  const viewportElemRef = useRef(null);

  // OrgCanvas registers its "fit whole tree into view" function here so the toolbar
  // button (which lives outside OrgCanvas) can trigger it.
  const fitToScreenRef = useRef(null);

  const handleRegisterViewportRef = useCallback((elem) => {
    viewportElemRef.current = elem;
  }, []);

  // Modal State (Add / Edit)
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'add',
    initialData: null,
    presetManagerId: null
  });

  // Import / Export Modal State
  const [importExportModalOpen, setImportExportModalOpen] = useState(false);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return filterMembers(members, {
      search,
      department: departmentFilter,
      level: levelFilter
    });
  }, [members, search, departmentFilter, levelFilter]);

  // Build tree data recursively using buildOrgTree
  const { root: treeRoot, memberMap } = useMemo(() => {
    return buildOrgTree(members, collapseState);
  }, [members, collapseState]);

  // Search Match IDs
  const searchMatches = useMemo(() => {
    if (!search && departmentFilter === 'all' && levelFilter === 'all') {
      return null;
    }
    const matchIds = new Set(filteredMembers.map(m => m.id));
    
    if (search.trim().length > 0) {
      const ancestorsToExpand = new Set();
      matchIds.forEach(id => {
        const ancestors = getAncestorIds(id, memberMap);
        ancestors.forEach(aId => ancestorsToExpand.add(aId));
      });

      if (ancestorsToExpand.size > 0) {
        setCollapseState(prev => {
          const next = { ...prev };
          ancestorsToExpand.forEach(aId => {
            delete next[aId];
          });
          return next;
        });
      }
    }

    return matchIds;
  }, [search, departmentFilter, levelFilter, filteredMembers, memberMap]);

  // On selecting an employee from Node Search Autocomplete:
  const handleSelectSearchResult = useCallback((member) => {
    if (!member) return;

    // Expand all parent/ancestor nodes along hierarchy path
    const ancestors = getAncestorIds(member.id, memberMap);
    setCollapseState(prev => {
      const next = { ...prev };
      ancestors.forEach(aId => {
        delete next[aId];
      });
      return next;
    });

    setActiveView('tree');
    setSelectedMember(member);
    setFocusedNodeId(member.id);

    setTimeout(() => {
      setFocusedNodeId(null);
    }, 2500);
  }, [memberMap]);

  // Export PNG & PDF Handlers
  const handleExportPng = useCallback(async () => {
    if (viewportElemRef.current) {
      await exportToPNG(viewportElemRef.current, theme);
    }
  }, [theme]);

  const handleExportPdf = useCallback(async () => {
    if (viewportElemRef.current) {
      await exportToPDF(viewportElemRef.current, theme);
    }
  }, [theme]);

  // Zoom Handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 2.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.4));
  const handleResetZoom = () => setZoom(1.0);
  const handleFitToScreen = () => {
    if (fitToScreenRef.current) fitToScreenRef.current();
  };

  // Expand / Collapse All Handlers
  const handleExpandAll = () => {
    // Expanding everything renders every employee's card at once - safe for small/
    // medium orgs, but on a large dataset it can freeze the tab for several seconds
    // (or longer). Warn before doing that instead of silently locking up the page.
    if (members.length > LARGE_DATASET_THRESHOLD) {
      const proceed = window.confirm(
        `This will expand all ${members.length} employees at once, which can be slow ` +
        `or freeze the page for a few seconds on this many records. Continue?`
      );
      if (!proceed) return;
    }
    setCollapseState({});
  };
  const handleCollapseAll = () => {
    // Always collapse the synthetic "Unknown RM" group too, even though it isn't a
    // real row in `members` (see UNASSIGNED_MANAGER_ID) - otherwise "Collapse All"
    // would leave it expanded.
    const nextCollapse = { [UNASSIGNED_MANAGER_ID]: true };
    members.forEach(m => {
      const reports = members.filter(r => r.managerId === m.id);
      if (reports.length > 0) {
        nextCollapse[m.id] = true;
      }
    });
    setCollapseState(nextCollapse);
  };

  const handleToggleCollapse = (nodeId) => {
    setCollapseState(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // Member CRUD Handlers
  const handleSaveMember = (memberPayload) => {
    setMembers(prev => {
      const exists = prev.some(m => m.id === memberPayload.id);
      if (exists) {
        return prev.map(m => m.id === memberPayload.id ? memberPayload : m);
      }
      return [...prev, memberPayload];
    });

    if (selectedMember && selectedMember.id === memberPayload.id) {
      setSelectedMember(memberPayload);
    }
  };

  const handleDeleteMember = (memberId) => {
    if (!window.confirm('Are you sure you want to remove this employee? Direct reports will be reassigned to their manager.')) {
      return;
    }

    const target = members.find(m => m.id === memberId);
    if (!target) return;

    const managerId = target.managerId;

    setMembers(prev => {
      const updated = prev.map(m => {
        if (m.managerId === memberId) {
          return { ...m, managerId: managerId };
        }
        return m;
      });
      return updated.filter(m => m.id !== memberId);
    });

    if (selectedMember?.id === memberId) {
      setSelectedMember(null);
    }
  };

  const handleResetToDemo = () => {
    setMembers(INITIAL_MEMBERS);
    localStorage.removeItem(STORAGE_KEY);
    setSelectedMember(null);
    setCollapseState({});
  };

  return (
    <div className="app-container">
      {/* Top Navbar Header with Search Autocomplete */}
      <Header
        search={search}
        setSearch={setSearch}
        activeView={activeView}
        setActiveView={setActiveView}
        theme={theme}
        setTheme={setTheme}
        totalMembers={members.length}
        allMembers={members}
        onSelectSearchResult={handleSelectSearchResult}
        onOpenAddModal={() => setModalState({ isOpen: true, mode: 'add', initialData: null, presetManagerId: null })}
        onOpenImportExport={() => setImportExportModalOpen(true)}
      />

      {/* Controlled Org Chart Workspace with Collapsible Sidebar */}
      <OrgChartWorkspace
        members={members}
        departmentFilter={departmentFilter}
        setDepartmentFilter={setDepartmentFilter}
        levelFilter={levelFilter}
        setLevelFilter={setLevelFilter}
        matchCount={filteredMembers.length}
        totalCount={members.length}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        cardMode={cardMode}
        setCardMode={setCardMode}
        showMatrixLines={showMatrixLines}
        setShowMatrixLines={setShowMatrixLines}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        onExportPng={handleExportPng}
        onExportPdf={handleExportPdf}
        onReloadJson={loadJsonMembers}
        isJsonLoading={isJsonLoading}
      >
        {/* Controls Toolbar (Shown in Tree view) */}
        {activeView === 'tree' && (
          <ControlsBar
            zoom={zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
            onFitToScreen={handleFitToScreen}
            layoutMode={layoutMode}
            setLayoutMode={setLayoutMode}
            cardMode={cardMode}
            setCardMode={setCardMode}
            showMatrixLines={showMatrixLines}
            setShowMatrixLines={setShowMatrixLines}
            departmentFilter={departmentFilter}
            setDepartmentFilter={setDepartmentFilter}
            levelFilter={levelFilter}
            setLevelFilter={setLevelFilter}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
            matchCount={filteredMembers.length}
            totalCount={members.length}
            onExportPng={handleExportPng}
            onExportPdf={handleExportPdf}
          />
        )}

        {/* Main View Area */}
        <main className="app-main">
          {activeView === 'tree' && (
            <OrgCanvas
              treeRoot={treeRoot}
              allMembers={members}
              selectedMember={selectedMember}
              searchMatches={searchMatches}
              focusedNodeId={focusedNodeId}
              zoom={zoom}
              layoutMode={layoutMode}
              cardMode={cardMode}
              showMatrixLines={showMatrixLines}
              onSelectMember={(member) => setSelectedMember(member)}
              onToggleCollapse={handleToggleCollapse}
              onRegisterViewportRef={handleRegisterViewportRef}
              onZoomChange={setZoom}
              onRegisterFitToScreen={(fn) => { fitToScreenRef.current = fn; }}
            />
          )}

          {activeView === 'list' && (
            <ListView
              members={filteredMembers}
              allMembers={members}
              onSelectMember={(member) => {
                handleSelectSearchResult(member);
              }}
              onOpenEditModal={(member) => setModalState({ isOpen: true, mode: 'edit', initialData: member, presetManagerId: null })}
              onDeleteMember={handleDeleteMember}
            />
          )}

          {activeView === 'analytics' && (
            <AnalyticsView members={members} />
          )}
        </main>
      </OrgChartWorkspace>

      {/* Side Drawer for Member Details Inspector */}
      {selectedMember && (
        <MemberDrawer
          member={selectedMember}
          allMembers={members}
          onClose={() => setSelectedMember(null)}
          onSelectMember={(member) => handleSelectSearchResult(member)}
          onOpenEditModal={(member) => setModalState({ isOpen: true, mode: 'edit', initialData: member, presetManagerId: null })}
          onOpenAddModal={(managerId) => setModalState({ isOpen: true, mode: 'add', initialData: null, presetManagerId: managerId })}
          onDeleteMember={handleDeleteMember}
        />
      )}

      {/* Add / Edit Member Modal */}
      <MemberModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        initialData={modalState.initialData}
        presetManagerId={modalState.presetManagerId}
        allMembers={members}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        onSave={handleSaveMember}
      />

      {/* Import / Export Modal */}
      <ImportExportModal
        isOpen={importExportModalOpen}
        members={members}
        onClose={() => setImportExportModalOpen(false)}
        onImportData={(importedData) => setMembers(importedData)}
        onResetToDemo={handleResetToDemo}
      />
    </div>
  );
}
