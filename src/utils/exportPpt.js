// ============================================================================
// PPT export - native, editable PowerPoint shapes (rectangles + connector lines),
// NOT a screenshot of the on-screen tree.
//
// Why not a screenshot: this project already tried a screenshot-based Export
// PNG/PDF (html2canvas) once - see the "Remove non-functional Export PNG/PDF"
// commit - and it was pulled out for being unreliable. Re-attempting the same
// approach for PPT would risk the same failure mode, plus a screenshot dropped
// onto a slide isn't editable in PowerPoint afterwards anyway. Building the boxes
// directly in PPT coordinates via pptxgenjs sidesteps both problems: it's
// independent of whatever CSS/DOM layout the on-screen tree happens to be using,
// and every box lands as a real, separately-editable PowerPoint shape.
//
// Why cascading (one slide per manager), not one giant slide: a subtree from a
// senior leader down to individual contributors can be hundreds or thousands of
// people - no single slide can show that legibly. Instead this generates ONE
// slide per person who has direct reports, showing just that person + their
// direct reports (standard "cascading org chart deck" pattern) - a slide never
// has more boxes than one manager's own span of control, however big the whole
// subtree is, and PowerPoint's own slide navigator effectively becomes the
// drill-down UI.
// ============================================================================

import pptxgenjs from 'pptxgenjs';
import { getDisplayLabels } from './orgUtils';

const SLIDE_WIDTH_IN = 13.33;
const SLIDE_HEIGHT_IN = 7.5;

const BOX_W = 2.35;
const BOX_H = 0.9;
const COL_GAP = 0.35;
const ROW_GAP = 0.75;
const HEADER_Y = 0.55;
const FIRST_CHILD_ROW_Y = 2.4;
const MAX_COLS_PER_ROW = 5; // keeps boxes readable at this slide width/box size
const MAX_ROWS_PER_SLIDE = 3; // beyond this, split into "(2 of N)" continuation slides

const HEADER_FILL = '4F46E5';
const CHILD_FILL = 'FFFFFF';
const CHILD_LINE = 'C7C9D9';
const LINE_COLOR = '9CA3AF';
const TITLE_COLOR = '1F2937';
const MUTED_COLOR = '6B7280';

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function drawBox(slide, node, x, y, opts, { isHeader = false } = {}) {
  const { primary, secondary } = getDisplayLabels(node, opts);

  slide.addShape('roundRect', {
    x, y, w: BOX_W, h: BOX_H,
    rectRadius: 0.06,
    fill: { color: isHeader ? HEADER_FILL : CHILD_FILL },
    line: { color: isHeader ? HEADER_FILL : CHILD_LINE, width: 1 }
  });

  slide.addText(
    [
      { text: primary, options: { bold: true, fontSize: isHeader ? 13 : 11.5, color: isHeader ? 'FFFFFF' : TITLE_COLOR, breakLine: true } },
      ...(secondary ? [{ text: secondary, options: { fontSize: 9.5, color: isHeader ? 'E0E7FF' : MUTED_COLOR } }] : [])
    ],
    {
      x: x + 0.08, y: y + 0.06, w: BOX_W - 0.16, h: BOX_H - 0.12,
      align: 'center', valign: 'middle', fontFace: 'Calibri', shrinkText: true
    }
  );
}

function drawConnector(slide, fromX, fromY, toX, toY) {
  slide.addShape('line', {
    x: Math.min(fromX, toX),
    y: fromY,
    w: Math.abs(toX - fromX) || 0.01,
    h: Math.max(toY - fromY, 0.01),
    line: { color: LINE_COLOR, width: 1.25 },
    flipV: toX < fromX
  });
}

// One slide showing `managerNode` at the top plus one "page" of its direct reports
// below it. `pageLabel` (e.g. "2 of 3") is only added to the title when a manager's
// own report count needed more than one continuation slide (see MAX_ROWS_PER_SLIDE).
function addTeamSlide(pptx, managerNode, reportsPage, opts, pageLabel) {
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };

  const { primary: managerLabel } = getDisplayLabels(managerNode, opts);
  const titleText = `${managerLabel} - Direct Reports${pageLabel ? ` (${pageLabel})` : ''}`;
  slide.addText(titleText, {
    x: 0.4, y: 0.15, w: SLIDE_WIDTH_IN - 0.8, h: 0.4,
    fontSize: 15, bold: true, color: TITLE_COLOR, fontFace: 'Calibri'
  });

  const headerX = (SLIDE_WIDTH_IN - BOX_W) / 2;
  drawBox(slide, managerNode, headerX, HEADER_Y, opts, { isHeader: true });

  const rows = chunk(reportsPage, MAX_COLS_PER_ROW);
  const headerBottomX = headerX + BOX_W / 2;
  const headerBottomY = HEADER_Y + BOX_H;

  rows.forEach((rowNodes, rowIdx) => {
    const rowY = FIRST_CHILD_ROW_Y + rowIdx * (BOX_H + ROW_GAP);
    const rowWidth = rowNodes.length * BOX_W + (rowNodes.length - 1) * COL_GAP;
    const startX = (SLIDE_WIDTH_IN - rowWidth) / 2;

    rowNodes.forEach((child, colIdx) => {
      const x = startX + colIdx * (BOX_W + COL_GAP);
      drawBox(slide, child, x, rowY, opts);
      drawConnector(slide, headerBottomX, headerBottomY, x + BOX_W / 2, rowY);
    });
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
 * over the whole subtree) showing that manager plus their direct reports as real,
 * editable PowerPoint boxes - not a picture of the on-screen tree. `rootNode` is a
 * node from buildOrgTree/buildFocusTree's memberMap (has .children, .id, etc.).
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

  // Cascading slides: one per manager-with-reports, BFS order (so the deck reads
  // top-down the same way the tree does), auto-paginated when a manager's own
  // direct-report count doesn't fit in MAX_ROWS_PER_SLIDE rows of MAX_COLS_PER_ROW.
  const queue = [rootNode];
  let slideCount = 0;
  const SAFETY_SLIDE_CAP = 500; // guards against ever generating a runaway deck

  while (queue.length > 0 && slideCount < SAFETY_SLIDE_CAP) {
    const node = queue.shift();
    const kids = node.children || [];
    if (kids.length === 0) continue;

    const perSlideCapacity = MAX_COLS_PER_ROW * MAX_ROWS_PER_SLIDE;
    const pages = chunk(kids, perSlideCapacity);
    pages.forEach((pageKids, pageIdx) => {
      addTeamSlide(pptx, node, pageKids, opts, pages.length > 1 ? `${pageIdx + 1} of ${pages.length}` : null);
      slideCount += 1;
    });

    kids.forEach((k) => queue.push(k));
  }

  const fileName = opts.fileName || 'org-chart.pptx';
  await pptx.writeFile({ fileName });
  return { slideCount: slideCount + 1, fileName };
}
