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
  onRegisterViewportRef
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

// Beyond this many direct reports under one manager, the extra ones collapse into a
// "+N more" button instead of stretching the row/column indefinitely - that unbounded
// growth was forcing a very long scroll (horizontal in row layouts, vertical in the
// waterfall leaf-stack) for any manager with a large team. Clicking it reveals the rest
// in a wrapped grid (bounded width, multiple rows) instead of one more single strip, so
// growth stays bounded in both directions no matter how many direct reports there are.
const MAX_VISIBLE_SIBLINGS = 8;

// Row-based overflow (used by the horizontal children container: waterfall's non-leaf
// case, and classic/horizontal layout modes).
function RowChildren({ childNodes, renderChild }) {
  const [showAll, setShowAll] = useState(false);
  const total = childNodes.length;
  const overflowing = total > MAX_VISIBLE_SIBLINGS;
  // The main row always caps at MAX_VISIBLE_SIBLINGS, whether or not the overflow
  // section below is expanded - only the overflow grid's own visibility toggles.
  // (Using `!showAll` here too was a bug: it let ALL children re-render in the main
  // row once expanded, duplicating the overflow ones a second time in the grid below.)
  const visibleNodes = overflowing ? childNodes.slice(0, MAX_VISIBLE_SIBLINGS) : childNodes;
  const hiddenNodes = overflowing ? childNodes.slice(MAX_VISIBLE_SIBLINGS) : [];

  return (
    <>
      <div className="tree-children-container">
        {visibleNodes.map((childNode, index) => (
          <SiblingChildWrapper key={childNode.id} index={index} totalChildren={visibleNodes.length}>
            {renderChild(childNode)}
          </SiblingChildWrapper>
        ))}
      </div>

      {overflowing && !showAll && (
        <div className="siblings-overflow-toggle-wrapper">
          <div className="overflow-connector-stem" />
          <button className="show-more-siblings-btn" onClick={() => setShowAll(true)}>
            +{hiddenNodes.length} more direct report{hiddenNodes.length === 1 ? '' : 's'}
          </button>
        </div>
      )}

      {overflowing && showAll && (
        <div className="siblings-overflow-grid-wrapper">
          <div className="overflow-connector-stem" />
          <div className="siblings-overflow-grid">
            {hiddenNodes.map((childNode) => (
              <div key={childNode.id} className="overflow-sibling-item">
                {renderChild(childNode)}
              </div>
            ))}
          </div>
          <button className="show-less-siblings-btn" onClick={() => setShowAll(false)}>
            Show fewer
          </button>
        </div>
      )}
    </>
  );
}

// Column-based overflow (used by the waterfall vertical leaf-stack).
function StackChildren({ childNodes, renderChild }) {
  const [showAll, setShowAll] = useState(false);
  const total = childNodes.length;
  const overflowing = total > MAX_VISIBLE_SIBLINGS;
  // Same fix as RowChildren above: the main stack always caps at MAX_VISIBLE_SIBLINGS
  // regardless of showAll, so the overflow grid never duplicates what's already shown.
  const visibleNodes = overflowing ? childNodes.slice(0, MAX_VISIBLE_SIBLINGS) : childNodes;
  const hiddenNodes = overflowing ? childNodes.slice(MAX_VISIBLE_SIBLINGS) : [];

  return (
    <div className="waterfall-vertical-stack">
      {visibleNodes.map((childNode) => (
        <div key={childNode.id} className="waterfall-stack-item">
          {renderChild(childNode)}
        </div>
      ))}

      {overflowing && !showAll && (
        <button className="show-more-siblings-btn stack-variant" onClick={() => setShowAll(true)}>
          +{hiddenNodes.length} more direct report{hiddenNodes.length === 1 ? '' : 's'}
        </button>
      )}

      {overflowing && showAll && (
        <div className="siblings-overflow-grid-wrapper stack-variant">
          <div className="siblings-overflow-grid">
            {hiddenNodes.map((childNode) => (
              <div key={childNode.id} className="overflow-sibling-item">
                {renderChild(childNode)}
              </div>
            ))}
          </div>
          <button className="show-less-siblings-btn" onClick={() => setShowAll(false)}>
            Show fewer
          </button>
        </div>
      )}
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

  if (isWaterfallVerticalStack) {
    return (
      <div className="waterfall-node-group">
        <OrgNode
          node={node}
          isSelected={isSelected}
          isSearchMatch={isSearchMatch}
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
  focusedNodeId,
  onSelect,
  onToggleCollapse
}) {
  const isHorizontal = layoutMode === 'horizontal';
  const hasChildren = node.children && node.children.length > 0;
  const showChildren = hasChildren && !node.isCollapsed;

  const isSelected = selectedId === node.id;
  const isSearchMatch = searchMatchIds ? searchMatchIds.has(node.id) : false;

  return (
    <div className={`node-tree-group ${isHorizontal ? 'horizontal' : ''}`}>
      <OrgNode
        node={node}
        isSelected={isSelected}
        isSearchMatch={isSearchMatch}
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
