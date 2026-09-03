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

import { INITIAL_MEMBERS, DEPARTMENTS } from './data/initialData';
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

// Preferred display order for known seniority levels in the filter dropdown. A level
// value from the data that isn't in this map (a custom one the live Sheet introduces)
// still shows up - see availableLevels below - just sorted after these, alphabetically.
const LEVEL_RANK = { 'C-Level': 0, 'VP': 1, 'Director': 2, 'Lead': 3, 'Senior': 4, 'Mid': 5 };

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

  // Filter dropdown options, built from the ACTUAL loaded data rather than a hardcoded
  // list. The old dropdowns only offered the 8 department keys and 6 level values baked
  // into the demo dataset - selecting a filter did nothing useful once the live Sheet
  // introduced a department or level string that isn't one of those (e.g. "Operations",
  // "Manager"), because that value had no matching option to pick in the first place.
  const availableDepartments = useMemo(() => {
    const seen = new Set();
    members.forEach((m) => { if (m.department) seen.add(m.department); });
    return Array.from(seen).sort((a, b) => {
      const nameA = (DEPARTMENTS[a]?.name || a).toLowerCase();
      const nameB = (DEPARTMENTS[b]?.name || b).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [members]);

  const availableLevels = useMemo(() => {
    const seen = new Set();
    members.forEach((m) => { if (m.level) seen.add(m.level); });
    return Array.from(seen).sort((a, b) => {
      const rankA = LEVEL_RANK[a] ?? 999;
      const rankB = LEVEL_RANK[b] ?? 999;
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b);
    });
  }, [members]);

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

  // Search Match IDs. Pure computation, no state updates inside it.
  const searchMatches = useMemo(() => {
    if (!search && departmentFilter === 'all' && levelFilter === 'all') {
      return null;
    }
    return new Set(filteredMembers.map(m => m.id));
  }, [search, departmentFilter, levelFilter, filteredMembers]);

  // Ancestors of the CURRENT search matches, so a match deep in a collapsed branch is
  // actually visible in the tree. Also pure - see the block right below for why this
  // is never written into collapseState.
  const searchForceExpandIds = useMemo(() => {
    if (!search || search.trim().length === 0 || !searchMatches || searchMatches.size === 0) {
      return null;
    }
    const ids = new Set();
    searchMatches.forEach((id) => {
      getAncestorIds(id, memberMap).forEach((aId) => ids.add(aId));
    });
    return ids;
  }, [search, searchMatches, memberMap]);

  // Apply the search override on top of the user's actual collapse choices, fresh on
  // every render - deliberately NOT via setCollapseState.
  //
  // An earlier version called setCollapseState from inside the searchMatches memo to
  // "auto-expand" ancestors, which (a) crashed the whole app (calling a state setter
  // during render trips React's error #301, unmounting everything - hence a blank page
  // on every keystroke) and, separately, (b) even once moved into a proper effect, left
  // every ancestor it opened stuck open forever: `delete next[id]` never puts a node
  // back into collapseState once removed, so as soon as ANY earlier, broader search
  // string (which typing a name necessarily passes through one character at a time -
  // "R" alone already matches half the titles in the org, e.g. "Director", "Engineer")
  // had forced a branch open, nothing ever closed it again, even after the search text
  // moved on to something specific. That's what "all the nodes get expanded" actually
  // was: not one bug, but every keystroke permanently accumulating more forced-open
  // branches on top of the last, which also produces far more simultaneously-expanded
  // content than the layout (or the user) ever intended - directly feeding the
  // overlapping-cards symptom reported alongside it.
  //
  // The fix is to never persist this at all: recompute which nodes the CURRENT search
  // needs open, every render, straight onto the tree buildOrgTree already produced for
  // this collapseState (memberMap's nodes are fresh objects whenever `members` or
  // `collapseState` changes, so mutating them here is just finishing this render's own
  // derived data, not a side effect). Every node's isCollapsed is set from scratch each
  // time - `!!collapseState[id]` overridden to false only for ids in the CURRENT
  // `searchForceExpandIds` - so nothing can carry over from a previous keystroke, and a
  // branch the user actually left collapsed stays collapsed again the moment the
  // search text no longer needs it open.
  memberMap.forEach((node) => {
    node.isCollapsed = !!collapseState[node.id] && !(searchForceExpandIds && searchForceExpandIds.has(node.id));
  });

  // Ids that make up the current search's "path": the matches themselves plus their
  // ancestor chain. Rendered nodes NOT on this path (typically siblings that are only
  // visible because their parent had to open to reveal the path) get visually dimmed
  // instead of hidden - per Power BI parity, nothing actually disappears (still
  // rendered, still counted, still clickable), but the path is easy to follow instead
  // of getting lost among e.g. 30 unrelated siblings under the same manager.
  const searchPathIds = useMemo(() => {
    if (!searchMatches) return null;
    const ids = new Set(searchMatches);
    if (searchForceExpandIds) {
      searchForceExpandIds.forEach((id) => ids.add(id));
    }
    return ids;
  }, [searchMatches, searchForceExpandIds]);

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

      {/* Main Workspace (the collapsible left sidebar was removed - see OrgChartWorkspace.jsx) */}
      <OrgChartWorkspace>
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
            availableDepartments={availableDepartments}
            availableLevels={availableLevels}
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
              searchPathIds={searchPathIds}
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
