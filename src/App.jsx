import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
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
  getAncestorIds
} from './utils/orgUtils';
import { exportToPNG, exportToPDF } from './utils/exportUtils';

const STORAGE_KEY = 'orgpulse_members_data';
const THEME_KEY = 'orgpulse_theme';

export default function App() {
  // Members State
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

  const [isExcelLoading, setIsExcelLoading] = useState(false);

  // Dynamic Excel File Data Engine: Fetch public/data/members.xlsx on initial load
  const loadExcelMembers = useCallback(async () => {
    setIsExcelLoading(true);
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const excelUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}data/members.xlsx`;
      const res = await fetch(excelUrl);
      
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (rows && rows.length > 0) {
        const parsedMembers = rows.map((row, index) => {
          const id = String(row.ID || row.id || `emp-${index + 1}`).trim();
          const name = String(row.Name || row.name || 'Unnamed Employee').trim();
          const title = String(row.Title || row.title || 'Team Member').trim();
          const department = String(row.Department || row.department || 'Engineering').trim();
          const rawManagerId = row['Manager ID'] || row.managerId || row.ManagerId || row.manager_id || null;
          const managerId = rawManagerId ? String(rawManagerId).trim() : null;
          const location = String(row.Location || row.location || 'Remote').trim();
          const status = String(row.Status || row.status || 'active').trim();
          const level = String(row.Level || row.level || 'Senior').trim();
          const email = String(row.Email || row.email || `${name.toLowerCase().replace(/\s+/g, '.')}@nexus.io`).trim();
          const phone = String(row.Phone || row.phone || '').trim();
          const rawSkills = row.Skills || row.skills || '';
          const skills = typeof rawSkills === 'string' ? rawSkills.split(',').map(s => s.trim()).filter(Boolean) : (Array.isArray(rawSkills) ? rawSkills : []);
          const bio = String(row.Bio || row.bio || '').trim();

          return {
            id,
            name,
            title,
            department,
            managerId,
            location,
            status,
            level,
            email,
            phone,
            skills,
            bio,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`
          };
        });

        setMembers(parsedMembers);
      }
    } catch (err) {
      console.warn('Excel load fallback to stored/demo dataset:', err);
    } finally {
      setIsExcelLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExcelMembers();
  }, [loadExcelMembers]);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
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

  // Build tree data
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

    // Expand all parent/ancestor nodes along path
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

  // Expand / Collapse All Handlers
  const handleExpandAll = () => setCollapseState({});
  const handleCollapseAll = () => {
    const nextCollapse = {};
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
        onReloadExcel={loadExcelMembers}
        isExcelLoading={isExcelLoading}
      >
        {/* Controls Toolbar (Shown in Tree view) */}
        {activeView === 'tree' && (
          <ControlsBar
            zoom={zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
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
