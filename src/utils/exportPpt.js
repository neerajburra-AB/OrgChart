// ============================================================================
// PPT export - native, editable PowerPoint shapes (rectangles + connector lines)
// styled like a traditional org-chart / SmartArt Hierarchy diagram, NOT a
// screenshot of the on-screen tree.
//
// Why not a screenshot: this project already tried a screenshot-based Export
// PNG/PDF (html2canvas) once - see the "Remove non-functional Export PNG/PDF"
// commit - and it was pulled out for being unreliable. Re-attempting the same
// approach for PPT would risk the same failure mode, plus a screenshot dropped
// onto a slide isn't editable in PowerPoint afterwards anyway.
//
// Why not actual SmartArt: PowerPoint's SmartArt is rendered by an internal
// engine with its own proprietary diagram-data XML - no library (this one,
// python-pptx, anything) can generate a real SmartArt object from scratch.
// What IS achievable, and what this file does, is drawing plain shapes styled
// to LOOK like the classic Hierarchy SmartArt: uniform boxes, right-angle
// ("elbow") trunk/bus/drop connectors instead of diagonal lines - while
// staying fully editable, unlike a screenshot, and able to auto-paginate
// across slides, unlike SmartArt (which has no such thing and gets unreadable
// past ~30-40 shapes in one diagram). See exportSmartArtOutline.js for the
// other option: a paste-able outline that produces REAL SmartArt inside
// PowerPoint itself, for subtrees small enough for that to stay readable.
//
// Why cascading (one slide per manager), not one giant slide: a subtree from a
// senior leader down to individual contributors can be hundreds or thousands of
// people - no single slide/diagram can show that legibly. Instead this generates
// ONE slide per person who has direct reports, showing just that person + one
// row of their direct reports (standard "cascading org chart deck" pattern) -
// a slide never has more boxes than fit in one clean row, however big the whole
// subtree is, and PowerPoint's own slide navigator becomes the drill-down UI.
// ============================================================================

import pptxgenjs from 'pptxgenjs';
import { getDisplayLabels } from './orgUtils';

const SLIDE_WIDTH_IN = 13.33;
const SLIDE_HEIGHT_IN = 7.5;

const BOX_W = 1.9;
const BOX_H = 0.85;
const COL_GAP = 0.3;
const HEADER_Y = 0.7;
const CHILD_ROW_Y = 3.6;
const BUS_Y = HEADER_Y + BOX_H + 0.55; // horizontal "bus" line between header and children
const MAX_COLS_PER_ROW = 6; // one clean row per slide - keeps the classic look instead of a busy multi-row grid

// One uniform box style for every level (header included) - deliberately NOT a
// different color per depth. A traditional org-chart/SmartArt Hierarchy diagram
// reads its levels from POSITION and the connector lines, not from re-coloring
// every generation - that's what keeps a 5-level cascade visually consistent
// slide to slide instead of introducing an arbitrary color ramp.
const BOX_FILL = 'FFFFFF';
const BOX_LINE = '4F46E5';
const LINE_COLOR = '8B90A8';
const TITLE_COLOR = '1F2937';
const MUTED_COLOR = '6B7280';

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Walks `rootNode` BFS and groups it into the same "one manager + one row of
 * their direct reports" slide units used both by the native-shapes PPT export
 * below AND by exportSmartArtMacroData.js's VBA-macro data file - ONE shared
 * traversal instead of two independently-written copies, since this project
 * has already hit real bugs from exactly that kind of drift (see
 * computeCollapseStateFromRoot's comment in orgUtils.js for the earlier case).
 * A manager with more direct reports than MAX_COLS_PER_ROW becomes multiple
 * consecutive specs (pageLabel "1 of 3", "2 of 3", ...) rather than one
 * overcrowded slide/diagram.
 */
export function buildCascadingSlideSpecs(rootNode, opts = {}) {
  const specs = [];
  const queue = [rootNode];
  const SAFETY_SLIDE_CAP = 500; // guards against ever generating a runaway deck
  let count = 0;

  while (queue.length > 0 && count < SAFETY_SLIDE_CAP) {
    const node = queue.shift();
    const kids = node.children || [];
    if (kids.length === 0) continue;

    const managerLabels = getDisplayLabels(node, opts);
    const pages = chunk(kids, MAX_COLS_PER_ROW);
    pages.forEach((pageKids, pageIdx) => {
      specs.push({
        title: `${managerLabels.primary} - Direct Reports${pages.length > 1 ? ` (${pageIdx + 1} of ${pages.length})` : ''}`,
        manager: managerLabels,
        reports: pageKids.map((k) => getDisplayLabels(k, opts))
      });
      count += 1;
    });

    kids.forEach((k) => queue.push(k));
  }

  return specs;
}

function drawBox(slide, labels, x, y, { isHeader = false } = {}) {
  const { primary, secondary } = labels;

  slide.addShape('roundRect', {
    x, y, w: BOX_W, h: BOX_H,
    rectRadius: 0.05,
    fill: { color: BOX_FILL },
    line: { color: BOX_LINE, width: isHeader ? 1.75 : 1 }
  });

  slide.addText(
    [
      { text: primary, options: { bold: true, fontSize: isHeader ? 12.5 : 11, color: TITLE_COLOR, breakLine: true } },
      ...(secondary ? [{ text: secondary, options: { fontSize: 9, color: MUTED_COLOR } }] : [])
    ],
    {
      x: x + 0.06, y: y + 0.05, w: BOX_W - 0.12, h: BOX_H - 0.1,
      align: 'center', valign: 'middle', fontFace: 'Calibri', shrinkText: true
    }
  );
}

function hLine(slide, x1, x2, y) {
  slide.addShape('line', {
    x: Math.min(x1, x2), y, w: Math.max(Math.abs(x2 - x1), 0.01), h: 0,
    line: { color: LINE_COLOR, width: 1.25 }
  });
}

function vLine(slide, x, y1, y2) {
  slide.addShape('line', {
    x, y: Math.min(y1, y2), w: 0, h: Math.max(Math.abs(y2 - y1), 0.01),
    line: { color: LINE_COLOR, width: 1.25 }
  });
}

// Classic "trunk -> bus -> drop" elbow connector: one line straight down from
// the header, a horizontal bus spanning the children row (skipped entirely
// when there's only one child - a single line down is enough), then one drop
// straight down into each child. This is the traditional org-chart connector
// style - the same shape SmartArt's own Hierarchy layout draws - versus a
// diagonal line straight from parent to each child.
function drawElbowConnectors(slide, headerCenterX, headerBottomY, childCenterXs, childTopY) {
  vLine(slide, headerCenterX, headerBottomY, BUS_Y);

  if (childCenterXs.length === 1) {
    vLine(slide, headerCenterX, BUS_Y, childTopY);
    return;
  }

  const minX = Math.min(...childCenterXs);
  const maxX = Math.max(...childCenterXs);
  hLine(slide, minX, maxX, BUS_Y);
  childCenterXs.forEach((cx) => vLine(slide, cx, BUS_Y, childTopY));
}

// One slide for one buildCascadingSlideSpecs() entry: the manager at the top
// plus their (up to MAX_COLS_PER_ROW) direct reports in a row below, connected
// with elbow connectors.
function addTeamSlide(pptx, spec) {
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };

  slide.addText(spec.title, {
    x: 0.4, y: 0.15, w: SLIDE_WIDTH_IN - 0.8, h: 0.4,
    fontSize: 15, bold: true, color: TITLE_COLOR, fontFace: 'Calibri'
  });

  const headerX = (SLIDE_WIDTH_IN - BOX_W) / 2;
  drawBox(slide, spec.manager, headerX, HEADER_Y, { isHeader: true });

  const reportsRow = spec.reports;
  const rowWidth = reportsRow.length * BOX_W + (reportsRow.length - 1) * COL_GAP;
  const startX = (SLIDE_WIDTH_IN - rowWidth) / 2;
  const childCenterXs = reportsRow.map((_, i) => startX + i * (BOX_W + COL_GAP) + BOX_W / 2);

  drawElbowConnectors(slide, headerX + BOX_W / 2, HEADER_Y + BOX_H, childCenterXs, CHILD_ROW_Y);

  reportsRow.forEach((labels, i) => {
    drawBox(slide, labels, startX + i * (BOX_W + COL_GAP), CHILD_ROW_Y);
  });
}

function countAll(node) {
  if (!node) return 0;
  let count = 1;
  (node.children || []).forEach((c) => { count += countAll(c); });
  return count;
}

/**
 * Generates and downloads a .pptx: a title slide, then one slide per manager (BFS
 * over the whole subtree) showing that manager plus one row of their direct
 * reports as real, editable PowerPoint boxes with traditional elbow connectors -
 * not a picture of the on-screen tree, and not real SmartArt (see this file's
 * header comment for why neither of those is the right building block here).
 * `rootNode` is a node from buildOrgTree/buildFocusTree's memberMap (has
 * .children, .id, etc.).
 *
 * opts: { displayField, hideNames, title, fileName } - displayField/hideNames use
 * the exact same getDisplayLabels rule the on-screen card uses (OrgNode.jsx), so
 * the deck always matches what was on screen when it was generated.
 */
export async function exportOrgChartToPpt(rootNode, opts = {}) {
  if (!rootNode) throw new Error('Nothing to export - no employee is selected.');

  const pptx = new pptxgenjs();
  pptx.defineLayout({ name: 'ORGPULSE_WIDE', width: SLIDE_WIDTH_IN, height: SLIDE_HEIGHT_IN });
  pptx.layout = 'ORGPULSE_WIDE';

  const { primary: rootLabel } = getDisplayLabels(rootNode, opts);
  const totalHeadcount = countAll(rootNode);

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: 'F8FAFC' };
  titleSlide.addText(opts.title || `${rootLabel} - Org Structure`, {
    x: 0.6, y: 2.6, w: SLIDE_WIDTH_IN - 1.2, h: 1.0,
    fontSize: 30, bold: true, color: TITLE_COLOR, align: 'center', fontFace: 'Calibri'
  });
  titleSlide.addText(
    `Starting from ${rootLabel}  •  ${totalHeadcount} total (including this person)`,
    {
      x: 0.6, y: 3.6, w: SLIDE_WIDTH_IN - 1.2, h: 0.5,
      fontSize: 14, color: MUTED_COLOR, align: 'center', fontFace: 'Calibri'
    }
  );

  // Cascading slides: one per manager-with-reports (see buildCascadingSlideSpecs),
  // BFS order so the deck reads top-down the same way the tree does.
  const specs = buildCascadingSlideSpecs(rootNode, opts);
  specs.forEach((spec) => addTeamSlide(pptx, spec));

  const fileName = opts.fileName || 'org-chart.pptx';
  await pptx.writeFile({ fileName });
  return { slideCount: specs.length + 1, fileName };
}
