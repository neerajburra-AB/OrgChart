import React from 'react';
import { 
  Network, 
  Search, 
  X, 
  GitFork, 
  List, 
  BarChart3, 
  Plus, 
  Sun, 
  Moon, 
  Download
} from 'lucide-react';
import SearchAutocomplete from './SearchAutocomplete';

export default function Header({ 
  search, 
  setSearch, 
  activeView, 
  setActiveView, 
  theme, 
  setTheme, 
  onOpenAddModal, 
  onOpenImportExport,
  totalMembers,
  allMembers = [],
  onSelectSearchResult
}) {
  return (
    <header className="app-header">
      {/* Brand Logo & Name */}
      <div className="brand-section">
        <div className="brand-logo">
          <Network size={22} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="brand-title">OrgPulse</span>
            <span className="brand-badge">Pro</span>
          </div>
        </div>
      </div>

      {/* Middle: Search Box with Autocomplete & View Switcher */}
      <div className="header-center">
        <SearchAutocomplete
          members={allMembers}
          searchQuery={search}
          onSearchChange={setSearch}
          onSelectResult={onSelectSearchResult}
        />

        <div className="view-tabs">
          <button
            className={`view-tab ${activeView === 'tree' ? 'active' : ''}`}
            onClick={() => setActiveView('tree')}
          >
            <GitFork size={15} />
            <span>Tree</span>
          </button>
          <button
            className={`view-tab ${activeView === 'list' ? 'active' : ''}`}
            onClick={() => setActiveView('list')}
          >
            <List size={15} />
            <span>Directory</span>
          </button>
          <button
            className={`view-tab ${activeView === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveView('analytics')}
          >
            <BarChart3 size={15} />
            <span>Analytics</span>
          </button>
        </div>
      </div>

      {/* Right Header Actions */}
      <div className="header-actions">
        <button 
          className="btn btn-secondary"
          onClick={onOpenImportExport}
          title="Import / Export Org Chart"
        >
          <Download size={15} />
          <span>Data</span>
        </button>

        <button
          className="icon-btn"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button 
          className="btn btn-primary"
          onClick={onOpenAddModal}
        >
          <Plus size={16} />
          <span>Add Member</span>
        </button>
      </div>
    </header>
  );
}
