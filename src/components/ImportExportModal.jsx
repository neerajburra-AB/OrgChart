import React, { useState } from 'react';
import { X, Download, Upload, RefreshCw, FileText, Database } from 'lucide-react';
import { exportToCSV } from '../utils/orgUtils';

export default function ImportExportModal({
  isOpen,
  members,
  onClose,
  onImportData,
  onResetToDemo
}) {
  const [jsonInput, setJsonInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Download JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(members, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `org-chart-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Download CSV
  const handleExportCSV = () => {
    const csvContent = exportToCSV(members);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `org-headcount-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Process JSON Upload
  const handleImportSubmit = (e) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) {
        throw new Error('Imported data must be an array of member objects.');
      }
      onImportData(parsed);
      onClose();
    } catch (err) {
      setErrorMsg(`Invalid JSON format: ${err.message}`);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (Array.isArray(parsed)) {
          onImportData(parsed);
          onClose();
        } else {
          setErrorMsg('File content must be a JSON array of members.');
        }
      } catch (err) {
        setErrorMsg(`Failed to parse file: ${err.message || 'Please upload a valid JSON file.'}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={20} style={{ color: 'var(--accent-primary)' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Data & Import / Export</h3>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Export Options */}
          <div className="drawer-section">
            <div className="drawer-section-title">Export Org Chart</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button className="btn btn-secondary" onClick={handleExportJSON} style={{ justifyContent: 'center' }}>
                <Download size={16} />
                <span>Export as JSON</span>
              </button>
              <button className="btn btn-secondary" onClick={handleExportCSV} style={{ justifyContent: 'center' }}>
                <FileText size={16} />
                <span>Export as CSV</span>
              </button>
            </div>
          </div>

          {/* Import JSON Section */}
          <div className="drawer-section" style={{ marginTop: 24 }}>
            <div className="drawer-section-title">Import Custom JSON</div>
            
            <div style={{ marginBottom: 12 }}>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                style={{ fontSize: 13, color: 'var(--text-secondary)' }}
              />
            </div>

            <form onSubmit={handleImportSubmit}>
              <textarea
                className="form-control"
                rows="4"
                placeholder='Paste raw JSON array of members here...'
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  setErrorMsg('');
                }}
              />
              {errorMsg && (
                <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6, fontWeight: 600 }}>
                  {errorMsg}
                </div>
              )}
              {jsonInput && (
                <button type="submit" className="btn btn-primary" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>
                  <Upload size={15} />
                  <span>Import JSON Data</span>
                </button>
              )}
            </form>
          </div>

          {/* Reset Demo Data */}
          <div className="drawer-section" style={{ marginTop: 24, paddingTop: 16, borderTop: 'var(--glass-border)' }}>
            <div className="drawer-section-title">Reset Preset Datasets</div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                onResetToDemo();
                onClose();
              }}
            >
              <RefreshCw size={15} />
              <span>Reset to Sample Company Preset (25 Members)</span>
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
