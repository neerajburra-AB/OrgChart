import React, { useRef, useState, useEffect } from 'react';
import OrgNode from './OrgNode';
import MiniMap from './MiniMap';

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
          <div key={childNode.id} className="wrap-sibling-item">
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
  cardMode,
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
