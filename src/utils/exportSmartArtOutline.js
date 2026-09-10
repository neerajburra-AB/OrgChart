// ============================================================================
// The OTHER PPT hierarchy option: a plain, Tab-indented text outline the user
// pastes into PowerPoint's own SmartArt Hierarchy "Text Pane" to get a REAL,
// native SmartArt diagram - not achievable by any generator library (see the
// header comment in exportPpt.js for why), only by PowerPoint's own engine.
//
// How to use the file this produces, in PowerPoint:
//   1. Insert > SmartArt > Hierarchy > pick a layout (e.g. "Organization Chart").
//   2. Click the small arrow on the diagram's left edge to open the Text Pane
//      (or View > Text Pane), and delete PowerPoint's placeholder bullet lines.
//   3. Paste this file's contents into the Text Pane. Each Tab of indentation
//      in the file becomes one level deeper in the diagram automatically.
//
// Deliberately size-guarded: a real SmartArt Hierarchy diagram is ONE object on
// ONE slide with no pagination of its own, and becomes unreadable (and slow to
// even lay out) well before a few dozen people - nowhere near what exportPpt.js's
// cascading slides can handle. This is for one team/department at a time, not a
// whole large org - SMARTART_PRACTICAL_LIMIT below is the line callers should
// warn the user about before generating a huge outline that will look broken
// the moment it's pasted in.
// ============================================================================

import { getDisplayLabels } from './orgUtils';

export const SMARTART_PRACTICAL_LIMIT = 40;

export function countAll(node) {
  if (!node) return 0;
  let count = 1;
  (node.children || []).forEach((c) => { count += countAll(c); });
  return count;
}

/**
 * Tab-indented outline of `rootNode` and everyone below it - depth 0 (the root)
 * has no leading tab, depth 1 has one, etc. Uses the same getDisplayLabels rule
 * as the on-screen card and the exportPpt.js deck, so this always shows
 * whatever "Display by"/"Hide Names" is currently set to.
 */
export function generateSmartArtOutline(rootNode, opts = {}) {
  const lines = [];
  function walk(node, depth) {
    const { primary } = getDisplayLabels(node, opts);
    lines.push('\t'.repeat(depth) + primary);
    (node.children || []).forEach((child) => walk(child, depth + 1));
  }
  walk(rootNode, 0);
  return lines.join('\n');
}

/**
 * Generates the outline and triggers a .txt download - a plain Blob/anchor
 * download, same pattern already used for JSON/CSV export in
 * ImportExportModal.jsx (no new download mechanism introduced).
 */
export function downloadSmartArtOutline(rootNode, opts = {}) {
  if (!rootNode) throw new Error('Nothing to export - no employee is selected.');

  const text = generateSmartArtOutline(rootNode, opts);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', opts.fileName || 'org-chart-smartart-outline.txt');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
