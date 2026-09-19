import React, { useRef, useState, useEffect, useMemo } from 'react';
import OrgNode from './OrgNode';
import MiniMap from './MiniMap';
import { toIdArray } from '../utils/orgUtils';

// Unique-enough id for the arrowhead marker def - only one OrgCanvas is ever mounted at
// a time (App.jsx's activeView switches between Tree/Focus View, never both at once),
// so a plain static id is fine; still namespaced to avoid ever colliding with anything
// else that defines SVG markers on the page.
const MATRIX_ARROW_MARKER_ID = 'orgpulse-matrix-line-arrowhead';

export default function OrgCanvas({
  treeRoot,
  allMembers,
  selectedMember,
  searchMatches,
  searchPathIds,
  focusedNodeId,
  zoom,
  layoutMode = 'waterfall', // 'waterfall' | 'classic' | 'horizontal'
  cardMode,
  displayField = 'name',
  hideNames = false,
  onSelectMember,
  onToggleCollapse,
  onZoomChange,
  onRegisterFitToScreen
}) {
  const containerRef = useRef(null);
  const viewportRef = useRef(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const hasInitializedRef = useRef(false);
  const prevLayoutModeRef = useRef(layoutMode);

  // Full id -> member lookup, built from allMembers - the WHOLE company, not just
  // whatever subset is in the currently-rendered tree (Focus View's `allMembers` is
  // still the full list - see FocusView.jsx). Needed so a dotted-line/matrix-manager
  // badge can show a real name even when that manager isn't the current tree/subtree at
  // all (see OrgNode.jsx's matrix badge, and the line-drawing effect below).
  const membersById = useMemo(
    () => new Map((allMembers || []).map((m) => [m.id, m])),
    [allMembers]
  );

  // Dotted-line connectors for matrix-manager relationships (see MemberModal.jsx's
  // "Also Reports To" field). Recomputed by directly measuring the two cards' actual
  // DOM positions rather than tracked through the layout algorithm itself - the tree
  // layout (WaterfallTreeGroup/ClassicTreeNodeGroup below) has no concept of "some other,
  // unrelated node elsewhere in the tree" at all, so teaching it one would mean threading
  // a second, cross-cutting layout concern through every recursive call. Measuring after
  // the fact is simpler and, since it only draws a line when BOTH endpoints are already
  // on screen, it's never wrong - it just doesn't draw anything for a pair where one side
  // is currently collapsed away (the card badge covers that case instead, see OrgNode.jsx).
  const [matrixLines, setMatrixLines] = useState([]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) { setMatrixLines([]); return; }

    const viewportRect = viewport.getBoundingClientRect();
    const scale = zoom || 1;

    // Converts a card's on-screen rect into the SAME local, unscaled coordinate space
    // as every other child of .tree-viewport - dividing by the current zoom undoes the
    // scale() half of `.tree-viewport`'s transform, and subtracting viewportRect cancels
    // out translate()/pan (both sides of the subtraction shift together). The resulting
    // point is what an SVG that's ALSO a child of .tree-viewport should use as its own
    // coordinate, so the browser's own transform inheritance keeps the line visually
    // aligned automatically - no need to recompute this on every pan/zoom change, only
    // when the rendered tree itself changes (see the dependency array below).
    const toLocalCenter = (rect) => ({
      x: (rect.left - viewportRect.left) / scale + rect.width / (2 * scale),
      y: (rect.top - viewportRect.top) / scale + rect.height / (2 * scale)
    });

    const lines = [];
    const seenPairs = new Set();

    membersById.forEach((member) => {
      const matrixIds = toIdArray(member.matrixManagerId);
      if (matrixIds.length === 0) return;

      const fromEl = viewport.querySelector(`[data-node-id="${member.id}"]`);
      if (!fromEl) return; // this employee isn't currently rendered (collapsed elsewhere)

      matrixIds.forEach((managerId) => {
        if (!managerId || managerId === member.id) return;
        const toEl = viewport.querySelector(`[data-node-id="${managerId}"]`);
        if (!toEl) return; // matrix manager not currently on screen - nothing to connect to

        const pairKey = [member.id, managerId].sort().join('::');
        if (seenPairs.has(pairKey)) return;
        seenPairs.add(pairKey);

        const p1 = toLocalCenter(fromEl.getBoundingClientRect());
        const p2 = toLocalCenter(toEl.getBoundingClientRect());
        lines.push({ key: pairKey, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      });
    });

    setMatrixLines(lines);
    // zoom/pan deliberately excluded - see toLocalCenter's division by scale above, which
    // makes these local coordinates invariant to both. treeRoot changes whenever the
    // rendered set of cards could change (expand/collapse, switching Focus employee,
    // search force-expand, a data reload).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeRoot, membersById]);

  // Center tree on initial load or layout mode change
  useEffect(() => {
    if (containerRef.current) {
      if (!hasInitializedRef.current || layoutMode !== prevLayoutModeRef.current) {
        hasInitializedRef.current = true;
        prevLayoutModeRef.current = layoutMode;
        const rect = containerRef.current.getBoundingClientRect();
        setPan({
          x: rect.width / 2 - 140,
          y: 60
        });
      }
    }
  }, [layoutMode]);

  // Smoothly center viewport on focused target node when searched/selected
  useEffect(() => {
    if (!focusedNodeId || !containerRef.current) return;

    const timer = setTimeout(() => {
      const container = containerRef.current;
      const targetElem = container.querySelector(`[data-node-id="${focusedNodeId}"]`);

      if (targetElem) {
        const containerRect = container.getBoundingClientRect();
        const nodeRect = targetElem.getBoundingClientRect();

        const nodeCenterX = nodeRect.left + nodeRect.width / 2;
        const nodeCenterY = nodeRect.top + nodeRect.height / 2;

        const containerCenterX = containerRect.left + containerRect.width / 2;
        const containerCenterY = containerRect.top + containerRect.height / 2;

        const deltaX = containerCenterX - nodeCenterX;
        const deltaY = containerCenterY - nodeCenterY;

        setPan(prev => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }));
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [focusedNodeId]);

  // Mouse pan handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetPan = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPan({
        x: rect.width / 2 - 140,
        y: 60
      });
    }
  };

  // "Fit to Screen" - inspired directly by the reference Power BI org-chart tool the
  // user pointed us at: instead of hiding a manager's reports behind a cap, it lets you
  // zoom/pan freely and offers one button that auto-scales + centers the WHOLE currently
  // expanded tree into view. We keep our own "+N more" cap for the default case (it's
  // still the right call for a 1000+ row dataset with everything expanded), but this
  // button covers the same "I expanded a big branch and now it's off-screen" problem
  // the reference tool solves - no scrolling hunt required.
  //
  // `.tree-viewport` is `position: absolute` with `transform-origin: 0 0`, so its own
  // offsetWidth/offsetHeight are the tree's natural, unscaled size (the scale() transform
  // doesn't affect an element's own layout box) - exactly the number we need here.
  const handleFitToScreen = () => {
    if (!containerRef.current || !viewportRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const contentWidth = viewportRef.current.offsetWidth;
    const contentHeight = viewportRef.current.offsetHeight;
    if (!contentWidth || !contentHeight) return;

    const padding = 64; // breathing room so cards don't touch the viewport edge
    const availableWidth = Math.max(containerRect.width - padding * 2, 50);
    const availableHeight = Math.max(containerRect.height - padding * 2, 50);

    const rawScale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
    // Deliberately not clamped to the manual +/- button's 0.4-2.0 range: "fit to screen"
    // is a one-off action whose whole point is reaching scales the step buttons can't -
    // a huge expanded branch needs to zoom out further than 40%, and a tiny one should be
    // allowed to zoom in past 200% too. A hard floor still guards against a zero/negative
    // scale if something renders with a near-0 size.
    const newZoom = Math.max(0.05, rawScale);

    if (onZoomChange) onZoomChange(newZoom);

    setPan({
      x: (containerRect.width - contentWidth * newZoom) / 2,
      y: padding
    });
  };

  useEffect(() => {
    if (onRegisterFitToScreen) {
      onRegisterFitToScreen(handleFitToScreen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterFitToScreen]);

  if (!treeRoot) {
    return (
      <div className="tree-canvas-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No Root Employee Found</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Add a top-level CEO/Leader to generate your Org Chart.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`tree-canvas-container ${isDragging ? 'is-dragging' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        ref={viewportRef}
        className="tree-viewport"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
        }}
      >
        {/* Dotted-line connectors for matrix-manager relationships - rendered as the
            FIRST child so normal DOM stacking paints the actual tree cards on top of it
            (a line passing "under" a card should disappear behind it, not draw over its
            text). Sized to exactly cover .tree-viewport's own natural (unscaled) content
            box, which is why it inherits the same transform as everything else in here
            and needs no zoom/pan math of its own - see the matrixLines effect above. */}
        {matrixLines.length > 0 && (
          <svg className="matrix-lines-overlay" style={{ pointerEvents: 'none' }}>
            <defs>
              <marker
                id={MATRIX_ARROW_MARKER_ID}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill="#ec4899" />
              </marker>
            </defs>
            {matrixLines.map((line) => (
              <line
                key={line.key}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#ec4899"
                strokeWidth={1.75}
                strokeDasharray="6 5"
                strokeOpacity={0.75}
                markerEnd={`url(#${MATRIX_ARROW_MARKER_ID})`}
              />
            ))}
          </svg>
        )}

        {/* Waterfall or Classic Spanning Tree layout */}
        {layoutMode === 'waterfall' ? (
          <WaterfallTreeGroup
            node={treeRoot}
            cardMode={cardMode}
            displayField={displayField}
            hideNames={hideNames}
            membersById={membersById}
            selectedId={selectedMember?.id}
            searchMatchIds={searchMatches}
            searchPathIds={searchPathIds}
            focusedNodeId={focusedNodeId}
            onSelect={onSelectMember}
            onToggleCollapse={onToggleCollapse}
          />
        ) : (
          <ClassicTreeNodeGroup
            node={treeRoot}
            layoutMode={layoutMode}
            cardMode={cardMode}
            displayField={displayField}
            hideNames={hideNames}
            membersById={membersById}
            selectedId={selectedMember?.id}
            searchMatchIds={searchMatches}
            searchPathIds={searchPathIds}
            focusedNodeId={focusedNodeId}
            onSelect={onSelectMember}
            onToggleCollapse={onToggleCollapse}
          />
        )}
      </div>

      {/* Interactive Mini-Map Navigation Widget */}
      <MiniMap
        treeRoot={treeRoot}
        layoutMode={layoutMode}
        zoom={zoom}
        pan={pan}
        onPanChange={setPan}
        containerRef={containerRef}
        viewportRef={viewportRef}
        onResetPan={handleResetPan}
      />
    </div>
  );
}

// Beyond this many direct reports, individual per-child connector lines stop being
// readable (the reference Power BI org-chart tool we were asked to match has the same
// cutover - it never hides a report, but it stops drawing an individual branch line to
// each one once there are a lot of them). Past this count we switch to rendering EVERY
// child inside one wrapped grid instead - nothing is hidden behind a button, the grid
// just grows to as many rows as it needs to hold all of them. Column count is picked per
// group (roughly square: ceil(sqrt(N))) so a group of 15 doesn't render as one 15-wide
// strip or one 15-tall column - it comes out close to a 4x4 block, which is what actually
// stops the "endless scroll" problem. Getting the whole block into view from there is
// what the zoom / pan / Fit-to-Screen controls are for (see OrgCanvas's handleFitToScreen).
const WRAP_THRESHOLD = 8;

function gridColumnCount(total) {
  return Math.max(2, Math.ceil(Math.sqrt(total)));
}

// A wrap-grid cell is a flat `minmax(260px, max-content)` track, and that `max-content`
// sizing is supposed to let a column grow to fit an expanded child's subtree (see the long
// comment on `.siblings-wrap-grid` in index.css). It doesn't reliably do that when the
// expanded child's OWN children also exceed WRAP_THRESHOLD and need their own nested
// wrap-grid: that inner grid sits inside a `flex-direction:column;align-items:center`
// wrapper with a `margin-left` offset (the "stack-variant" indent), and that combination
// doesn't propagate its true intrinsic width back up through the outer grid's own
// max-content track sizing - confirmed live (2026-09-08): a manager with 25 reports whose
// own report in turn had 23 reports ended up with the outer grid computing a flat 260px
// column for that cell while the nested sub-grid actually rendered ~1400px wide, centered
// UNDER that narrow cell and spilling ~500px into neighboring columns. Visually that read
// as "overlapping cards"; functionally it was worse - `document.elementFromPoint()` on the
// spilled-over cards returned an unrelated, invisible wrapper div from a totally different
// branch of the tree that happened to occupy that same screen position, which is why hover
// (and clicks) on those specific cards silently did nothing while every normal card responded
// fine. Rather than fight CSS Grid intrinsic sizing through multiple nested formatting
// contexts, a child that will itself need the wrap-grid treatment is pulled out of the
// normal per-column flow entirely and spans the full grid row width - it then has all the
// room it needs without depending on max-content propagating correctly through its parent.
function needsFullRowWidth(node) {
  return !!(node.children && node.children.length > WRAP_THRESHOLD && !node.isCollapsed);
}

// Row-based layout (used by the horizontal children container: waterfall's non-leaf
// case, and classic/horizontal layout modes).
function RowChildren({ childNodes, renderChild }) {
  const total = childNodes.length;

  if (total <= WRAP_THRESHOLD) {
    return (
      <div className="tree-children-container">
        {childNodes.map((childNode, index) => (
          <SiblingChildWrapper key={childNode.id} index={index} totalChildren={total}>
            {renderChild(childNode)}
          </SiblingChildWrapper>
        ))}
      </div>
    );
  }

  const columns = gridColumnCount(total);
  return (
    <div className="siblings-wrap-grid-wrapper">
      <div className="overflow-connector-stem" />
      <div
        className="siblings-wrap-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(260px, max-content))` }}
      >
        {childNodes.map((childNode) => (
          <div
            key={childNode.id}
            className="wrap-sibling-item"
            style={needsFullRowWidth(childNode) ? { gridColumn: '1 / -1' } : undefined}
          >
            {renderChild(childNode)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Column-based layout (used by the waterfall vertical leaf-stack).
function StackChildren({ childNodes, renderChild }) {
  const total = childNodes.length;

  if (total <= WRAP_THRESHOLD) {
    return (
      <div className="waterfall-vertical-stack">
        {childNodes.map((childNode) => (
          <div key={childNode.id} className="waterfall-stack-item">
            {renderChild(childNode)}
          </div>
        ))}
      </div>
    );
  }

  const columns = gridColumnCount(total);
  return (
    <div className="siblings-wrap-grid-wrapper stack-variant">
      <div
        className="siblings-wrap-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(260px, max-content))` }}
      >
        {childNodes.map((childNode) => (
          <div
            key={childNode.id}
            className="wrap-sibling-item"
            style={needsFullRowWidth(childNode) ? { gridColumn: '1 / -1' } : undefined}
          >
            {renderChild(childNode)}
          </div>
        ))}
      </div>
    </div>
  );
}

function SiblingChildWrapper({ index, totalChildren, children }) {
  const isOnlyChild = totalChildren === 1;
  const isFirstChild = index === 0;
  const isLastChild = index === totalChildren - 1;

  let lineStyle = {};
  if (isOnlyChild) {
    lineStyle = { display: 'none' };
  } else if (isFirstChild) {
    lineStyle = { left: '50%', width: '50%' };
  } else if (isLastChild) {
    lineStyle = { left: '0', width: '50%' };
  } else {
    lineStyle = { left: '0', width: '100%' };
  }

  return (
    <div className="tree-child-node-wrapper">
      {!isOnlyChild && (
        <div className="tree-child-horizontal-line" style={lineStyle} />
      )}
      <div className="tree-child-vertical-line" />
      {children}
    </div>
  );
}

function WaterfallTreeGroup({
  node,
  depth = 0,
  cardMode,
  displayField,
  hideNames,
  membersById,
  selectedId,
  searchMatchIds,
  searchPathIds,
  focusedNodeId,
  onSelect,
  onToggleCollapse
}) {
  const hasChildren = node.children && node.children.length > 0;
  const showChildren = hasChildren && !node.isCollapsed;
  const isSelected = selectedId === node.id;
  const isSearchMatch = searchMatchIds ? searchMatchIds.has(node.id) : false;
  // A search/filter is active (searchPathIds is non-null) and this node isn't part of
  // its path (match or ancestor) - still fully rendered (nothing is hidden), just faded
  // so the actual path is easy to follow instead of getting lost among siblings that
  // only appear because their parent had to open to reveal the path.
  const isDimmed = !!searchPathIds && !searchPathIds.has(node.id);

  const allChildrenAreLeaves = hasChildren && node.children.every(c => !c.children || c.children.length === 0);
  const isWaterfallVerticalStack = depth >= 1 && allChildrenAreLeaves;

  if (isWaterfallVerticalStack) {
    return (
      <div className="waterfall-node-group">
        <OrgNode
          node={node}
          isSelected={isSelected}
          isSearchMatch={isSearchMatch}
          isDimmed={isDimmed}
          focusedNodeId={focusedNodeId}
          cardMode={cardMode}
          displayField={displayField}
          hideNames={hideNames}
          membersById={membersById}
          onSelect={onSelect}
          onToggleCollapse={onToggleCollapse}
        />

        {showChildren && (
          <StackChildren
            childNodes={node.children}
            renderChild={(childNode) => (
              <WaterfallTreeGroup
                node={childNode}
                depth={depth + 1}
                cardMode={cardMode}
                displayField={displayField}
                hideNames={hideNames}
                membersById={membersById}
                selectedId={selectedId}
                searchMatchIds={searchMatchIds}
                searchPathIds={searchPathIds}
                focusedNodeId={focusedNodeId}
                onSelect={onSelect}
                onToggleCollapse={onToggleCollapse}
              />
            )}
          />
        )}
      </div>
    );
  }

  return (
    <div className="node-tree-group">
      <OrgNode
        node={node}
        isSelected={isSelected}
        isSearchMatch={isSearchMatch}
        isDimmed={isDimmed}
        focusedNodeId={focusedNodeId}
        cardMode={cardMode}
        displayField={displayField}
        hideNames={hideNames}
        membersById={membersById}
        onSelect={onSelect}
        onToggleCollapse={onToggleCollapse}
      />

      {showChildren && <div className="tree-parent-stem" />}

      {showChildren && (
        <RowChildren
          childNodes={node.children}
          renderChild={(childNode) => (
            <WaterfallTreeGroup
              node={childNode}
              depth={depth + 1}
              cardMode={cardMode}
              displayField={displayField}
              hideNames={hideNames}
              membersById={membersById}
              selectedId={selectedId}
              searchMatchIds={searchMatchIds}
              searchPathIds={searchPathIds}
              focusedNodeId={focusedNodeId}
              onSelect={onSelect}
              onToggleCollapse={onToggleCollapse}
            />
          )}
        />
      )}
    </div>
  );
}

function ClassicTreeNodeGroup({
  node,
  layoutMode,
  cardMode,
  displayField,
  hideNames,
  membersById,
  selectedId,
  searchMatchIds,
  searchPathIds,
  focusedNodeId,
  onSelect,
  onToggleCollapse
}) {
  const isHorizontal = layoutMode === 'horizontal';
  const hasChildren = node.children && node.children.length > 0;
  const showChildren = hasChildren && !node.isCollapsed;

  const isSelected = selectedId === node.id;
  const isSearchMatch = searchMatchIds ? searchMatchIds.has(node.id) : false;
  const isDimmed = !!searchPathIds && !searchPathIds.has(node.id);

  return (
    <div className={`node-tree-group ${isHorizontal ? 'horizontal' : ''}`}>
      <OrgNode
        node={node}
        isSelected={isSelected}
        isSearchMatch={isSearchMatch}
        isDimmed={isDimmed}
        focusedNodeId={focusedNodeId}
        cardMode={cardMode}
        displayField={displayField}
        hideNames={hideNames}
        membersById={membersById}
        onSelect={onSelect}
        onToggleCollapse={onToggleCollapse}
      />

      {!isHorizontal && showChildren && <div className="tree-parent-stem" />}

      {showChildren && (
        <RowChildren
          childNodes={node.children}
          renderChild={(childNode) => (
            <ClassicTreeNodeGroup
              node={childNode}
              layoutMode={layoutMode}
              cardMode={cardMode}
              displayField={displayField}
              hideNames={hideNames}
              membersById={membersById}
              selectedId={selectedId}
              searchMatchIds={searchMatchIds}
              searchPathIds={searchPathIds}
              focusedNodeId={focusedNodeId}
              onSelect={onSelect}
              onToggleCollapse={onToggleCollapse}
            />
          )}
        />
      )}
    </div>
  );
}
