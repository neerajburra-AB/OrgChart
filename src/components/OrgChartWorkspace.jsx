import React from 'react';

// This used to render a collapsible left sidebar (Department/Seniority filters, layout
// mode switch, matrix-lines/compact toggle, expand/collapse all, export PNG/PDF, JSON
// download/reload, Org Overview stats) alongside the main content. Removed at the
// user's request: every one of those controls already lives in the top ControlsBar
// toolbar, so the sidebar was pure duplication permanently taking up a 280px column.
// The two things it had that weren't duplicated there - "Download JSON" and the Org
// Overview stats (Members/Managers/ICs/Avg Span) - already have equivalents elsewhere
// (the "Data" button's Import/Export modal has its own "Export as JSON", and the
// Analytics view shows the same four stats plus more detail), so nothing is actually
// lost. The one genuinely sidebar-only action, "reload the live Google Sheet without a
// full page refresh," has no replacement - a normal browser refresh covers it, since
// the live sheet is already re-fetched on every page load.
//
// This wrapper component is kept (rather than inlining a div in App.jsx) only so the
// existing `.workspace-wrapper > .workspace-main-content` flex/height CSS didn't need
// to change anywhere else.
export default function OrgChartWorkspace({ children }) {
  return (
    <div className="workspace-wrapper">
      <div className="workspace-main-content">
        {children}
      </div>
    </div>
  );
}
