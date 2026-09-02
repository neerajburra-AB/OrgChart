import React, { useRef, useState, useEffect } from 'react';
import OrgNode from './OrgNode';
import MiniMap from './MiniMap';

export default function OrgCanvas({
  treeRoot,
  allMembers,
  selectedMember,
  searchMatches,
  focusedNodeId,
  zoom,
  layoutMode = 'waterfall', // 'waterfall' | 'classic' | 'horizontal'
  cardMode,
  showMatrixLines,
  onSelectMember,
  onToggleCollapse,
  onRegisterViewportRef,
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

  // Expose viewportRef to parent (for PNG/PDF export)
  useEffect(() => {
    if (onRegisterViewportRef && viewportRef.current) {
      onRegisterViewportRef(viewportRef.current);
    }
  }, [onRegisterViewportRef]);

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
        {/* Waterfall or Classic Spanning Tree layout */}
        {layoutMode === 'waterfall' ? (
          <WaterfallTreeGroup
            node={treeRoot}
            cardMode={cardMode}
            selectedId={selectedMember?.id}
            searchMatchIds={searchMatches}
            focusedNodeId={focusedNodeId}
            onSelect={onSelectMember}
            onToggleCollapse={onToggleCollapse}
          />
        ) : (
          <ClassicTreeNodeGroup
            node={treeRoot}
            layoutMode={layoutMode}
            cardMode={cardMode}
            selectedId={selectedMember?.id}
            searchMatchIds={searchMatches}
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
// each one once there are a lot of them). Past this count we switch to a fixed
// WRAP_COLUMNS-wide grid of just the cards instead - nothing is hidden behind a button,
// the grid just grows to as many rows as it needs to hold all of them.
//
// If one of those cards gets expanded to show ITS OWN children, those children do NOT
// nest inside that card's grid cell - a cell that suddenly grows much taller than its
// neighbours because one branch got expanded is exactly the "expanded node overlapping
// another" problem we were asked to avoid. Instead, expanding a card pushes its subtree
// into a brand new column to the right of the whole grid - matching the reference tool
// (2 columns of direct reports, a 3rd column for whichever one gets expanded, a 4th if
// something inside THAT gets expanded, and so on, recursively). Flexbox siblings never
// overlap each other, so this also structurally guarantees no overlap - each column owns
// its own horizontal slot and grows independently in height; see `.wrap-board-row` in
// index.css.
const WRAP_THRESHOLD = 8;
const WRAP_COLUMNS = 2;

// Row-based layout (used by the horizontal children container: waterfall's non-leaf
// case, and classic/horizontal layout modes). `renderChild(node, mode)` - see
// WaterfallTreeGroup/ClassicTreeNodeGroup's `mode` prop for what 'cardOnly' and
// 'childrenOnly' do.
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

  // Any card in the grid that's currently expanded gets a dedicated column of its own,
  // in the order it appears, instead of growing its own grid cell.
  const expandedChildren = childNodes.filter(
    (c) => c.children && c.children.length > 0 && !c.isCollapsed
  );

  return (
    <div className="wrap-board-row">
      <div className="siblings-wrap-grid-wrapper">
        <div className="overflow-connector-stem" />
        <div
          className="siblings-wrap-grid"
          style={{ gridTemplateColumns: `repeat(${WRAP_COLUMNS}, 260px)` }}
        >
          {childNodes.map((childNode) => (
            <div key={childNode.id} className="wrap-sibling-item">
              {renderChild(childNode, 'cardOnly')}
            </div>
          ))}
        </div>
      </div>

      {expandedChildren.map((childNode) => (
        <div key={`col-${childNode.id}`} className="wrap-expansion-column">
          <div className="wrap-expansion-label">{childNode.name}&rsquo;s reports</div>
          {renderChild(childNode, 'childrenOnly')}
        </div>
      ))}
    </div>
  );
}

// Column-based layout (used by the waterfall vertical leaf-stack). This only ever
// receives leaf children (see isWaterfallVerticalStack below), so there's never a
// grandchild to push into a 3rd column - just a fixed WRAP_COLUMNS-wide grid.
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

  return (
    <div className="siblings-wrap-grid-wrapper stack-variant">
      <div
        className="siblings-wrap-grid"
        style={{ gridTemplateColumns: `repeat(${WRAP_COLUMNS}, 260px)` }}
      >
        {childNodes.map((childNode) => (
          <div key={childNode.id} className="wrap-sibling-item">
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
  // 'full' (default): render the card + its children below/beside it, as always.
  // 'cardOnly': render JUST the card - used for a cell inside a wrap grid, so an
  //   expanded card's children don't grow that grid cell (see RowChildren).
  // 'childrenOnly': render JUST this node's children subtree, skipping the card (it was
  //   already rendered by a 'cardOnly' call elsewhere) - used for a wrap grid's
  //   expansion column.
  mode = 'full',
  cardMode,
  selectedId,
  searchMatchIds,
  focusedNodeId,
  onSelect,
  onToggleCollapse
}) {
  const hasChildren = node.children && node.children.length > 0;
  const showChildren = hasChildren && !node.isCollapsed;
  const isSelected = selectedId === node.id;
  const isSearchMatch = searchMatchIds ? searchMatchIds.has(node.id) : false;

  const allChildrenAreLeaves = hasChildren && node.children.every(c => !c.children || c.children.length === 0);
  const isWaterfallVerticalStack = depth >= 1 && allChildrenAreLeaves;

  const cardElement = (
    <OrgNode
      node={node}
      isSelected={isSelected}
      isSearchMatch={isSearchMatch}
      focusedNodeId={focusedNodeId}
      cardMode={cardMode}
      onSelect={onSelect}
      onToggleCollapse={onToggleCollapse}
    />
  );

  const renderGrandchild = (childNode, childMode) => (
    <WaterfallTreeGroup
      node={childNode}
      depth={depth + 1}
      mode={childMode}
      cardMode={cardMode}
      selectedId={selectedId}
      searchMatchIds={searchMatchIds}
      focusedNodeId={focusedNodeId}
      onSelect={onSelect}
      onToggleCollapse={onToggleCollapse}
    />
  );

  if (mode === 'cardOnly') {
    return cardElement;
  }

  if (mode === 'childrenOnly') {
    if (!showChildren) return null;
    if (isWaterfallVerticalStack) {
      return <StackChildren childNodes={node.children} renderChild={renderGrandchild} />;
    }
    return <RowChildren childNodes={node.children} renderChild={renderGrandchild} />;
  }

  if (isWaterfallVerticalStack) {
    return (
      <div className="waterfall-node-group">
        {cardElement}

        {showChildren && (
          <StackChildren childNodes={node.children} renderChild={renderGrandchild} />
        )}
      </div>
    );
  }

  return (
    <div className="node-tree-group">
      {cardElement}

      {showChildren && <div className="tree-parent-stem" />}

      {showChildren && (
        <RowChildren childNodes={node.children} renderChild={renderGrandchild} />
      )}
    </div>
  );
}

function ClassicTreeNodeGroup({
  node,
  layoutMode,
  // See WaterfallTreeGroup's `mode` prop for what 'cardOnly'/'childrenOnly' do - used
  // the same way here for classic/horizontal layout's own wrap grid expansion columns.
  mode = 'full',
  cardMode,
  selectedId,
  searchMatchIds,
  focusedNodeId,
  onSelect,
  onToggleCollapse
}) {
  const isHorizontal = layoutMode === 'horizontal';
  const hasChildren = node.children && node.children.length > 0;
  const showChildren = hasChildren && !node.isCollapsed;

  const isSelected = selectedId === node.id;
  const isSearchMatch = searchMatchIds ? searchMatchIds.has(node.id) : false;

  const cardElement = (
    <OrgNode
      node={node}
      isSelected={isSelected}
      isSearchMatch={isSearchMatch}
      focusedNodeId={focusedNodeId}
      cardMode={cardMode}
      onSelect={onSelect}
      onToggleCollapse={onToggleCollapse}
    />
  );

  const renderGrandchild = (childNode, childMode) => (
    <ClassicTreeNodeGroup
      node={childNode}
      layoutMode={layoutMode}
      mode={childMode}
      cardMode={cardMode}
      selectedId={selectedId}
      searchMatchIds={searchMatchIds}
      focusedNodeId={focusedNodeId}
      onSelect={onSelect}
      onToggleCollapse={onToggleCollapse}
    />
  );

  if (mode === 'cardOnly') {
    return cardElement;
  }

  if (mode === 'childrenOnly') {
    if (!showChildren) return null;
    return <RowChildren childNodes={node.children} renderChild={renderGrandchild} />;
  }

  return (
    <div className={`node-tree-group ${isHorizontal ? 'horizontal' : ''}`}>
      {cardElement}

      {!isHorizontal && showChildren && <div className="tree-parent-stem" />}

      {showChildren && (
        <RowChildren childNodes={node.children} renderChild={renderGrandchild} />
      )}
    </div>
  );
}
