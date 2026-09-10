// ============================================================================
// The THIRD PPT hierarchy option: a CSV data file paired with a VBA macro
// (macros/BuildOrgChartFromCsv.bas) that runs INSIDE PowerPoint and drives its
// own SmartArt engine directly via the documented Object Model
// (Shapes.AddSmartArt / SmartArtNode.AddNode). Unlike exportPpt.js (real
// shapes styled to LOOK like SmartArt) and exportSmartArtOutline.js (a
// paste-able outline for ONE manually-built SmartArt diagram), this produces
// ONE real, native SmartArt diagram PER MANAGER, automatically, cascading
// through the whole subtree the same way exportPpt.js's slides do - the best
// of both: genuine SmartArt AND handles a large org without becoming one
// giant unreadable diagram.
//
// Why a CSV, not JSON: vanilla VBA has no built-in JSON parser, and pulling in
// a third-party VBA JSON library is one more thing to install/trust. A small
// hand-rolled CSV line parser (in the .bas file) is a few lines and has no
// dependencies.
//
// This file reuses buildCascadingSlideSpecs from exportPpt.js - the exact same
// per-manager grouping/pagination the native-shapes PPT export uses - so the
// macro's slide boundaries always match what the PPT export would have
// produced, rather than two independently-written groupings drifting apart.
// ============================================================================

import { buildCascadingSlideSpecs } from './exportPpt';

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Combines a node's primary + secondary display label into ONE cell (the
// macro just sets this whole string as the SmartArt node's text) - keeps the
// CSV shape simple (one label column) rather than needing the macro to know
// about primary/secondary at all.
function labelCell(labels) {
  return labels.secondary ? `${labels.primary} (${labels.secondary})` : labels.primary;
}

/**
 * The CSV content itself - exposed separately from the download trigger so it
 * can be unit-checked/previewed without touching the DOM.
 */
export function generateSmartArtMacroCsv(rootNode, opts = {}) {
  const specs = buildCascadingSlideSpecs(rootNode, opts);
  const rows = [['SlideTitle', 'Role', 'Label']];
  specs.forEach((spec) => {
    rows.push([spec.title, 'HEADER', labelCell(spec.manager)]);
    spec.reports.forEach((r) => rows.push([spec.title, 'CHILD', labelCell(r)]));
  });
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

/**
 * Generates the CSV and triggers a download - same Blob/anchor pattern already
 * used for JSON/CSV export in ImportExportModal.jsx and the plain SmartArt
 * outline export, no new download mechanism introduced.
 */
export function downloadSmartArtMacroData(rootNode, opts = {}) {
  if (!rootNode) throw new Error('Nothing to export - no employee is selected.');

  const csv = generateSmartArtMacroCsv(rootNode, opts);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', opts.fileName || 'org-chart-smartart-macro-data.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
