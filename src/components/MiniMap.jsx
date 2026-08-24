import React, { useState, useEffect, useRef } from 'react';
import { Map, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';
import { DEPARTMENTS } from '../data/initialData';

const MAP_WIDTH = 240;
const MAP_HEIGHT = 150;

export default function MiniMap({
  treeRoot,
  layoutMode,
  zoom,
  pan,
  onPanChange,
  containerRef,
  viewportRef,
  onResetPan
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [nodesBounds, setNodesBounds] = useState([]);
  const [treeBounds, setTreeBounds] = useState({
    minX: 0,
    maxX: 1000,
    minY: 0,
    maxY: 1000,
    width: 1000,
    height: 1000
  });

  const svgRef = useRef(null);

  // Scan and calculate all node locations in unscaled viewport space
  useEffect(() => {
    if (!viewportRef?.current) return;

    const scanNodes = () => {
      const viewportElem = viewportRef.current;
      const cards = viewportElem.querySelectorAll('.org-node-card');

      const cardData = [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      cards.forEach(card => {
        const nodeId = card.getAttribute('data-node-id');
        const dept = card.getAttribute('data-department');

        const left = card.offsetLeft;
        const top = card.offsetTop;
        const width = card.offsetWidth;
        const height = card.offsetHeight;

        const right = left + width;
        const bottom = top + height;

        if (left < minX) minX = left;
        if (top < minY) minY = top;
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;

        cardData.push({
          id: nodeId,
          department: dept,
          x: left,
          y: top,
          w: width,
          h: height
        });
      });

      if (cardData.length > 0) {
        const padding = 100;
        const bounds = {
          minX: minX - padding,
          maxX: maxX + padding,
          minY: minY - padding,
          maxY: maxY + padding,
          width: Math.max(maxX - minX + padding * 2, 400),
          height: Math.max(maxY - minY + padding * 2, 300)
        };
        setTreeBounds(bounds);
        setNodesBounds(cardData);
      }
    };

    scanNodes();
    const animationTimer = setTimeout(scanNodes, 350); // Re-scan after expand/collapse CSS animations
    return () => clearTimeout(animationTimer);
  }, [treeRoot, layoutMode, zoom, pan, viewportRef]);

  // Scale factors for MiniMap
  const scaleX = MAP_WIDTH / treeBounds.width;
  const scaleY = MAP_HEIGHT / treeBounds.height;
  const mapScale = Math.min(scaleX, scaleY);

  const offsetX = (MAP_WIDTH - treeBounds.width * mapScale) / 2;
  const offsetY = (MAP_HEIGHT - treeBounds.height * mapScale) / 2;

  const toMapX = (wx) => (wx - treeBounds.minX) * mapScale + offsetX;
  const toMapY = (wy) => (wy - treeBounds.minY) * mapScale + offsetY;

  // Viewport container dimensions
  const containerW = containerRef?.current?.offsetWidth || 1000;
  const containerH = containerRef?.current?.offsetHeight || 700;

  // View-finder Box calculations
  const visibleWorldX = -pan.x / zoom;
  const visibleWorldY = -pan.y / zoom;
  const visibleWorldW = containerW / zoom;
  const visibleWorldH = containerH / zoom;

  const vfX = toMapX(visibleWorldX);
  const vfY = toMapY(visibleWorldY);
  const vfW = Math.max(visibleWorldW * mapScale, 16);
  const vfH = Math.max(visibleWorldH * mapScale, 12);

  // Handle click or drag on MiniMap SVG
  const handlePointerAction = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clickMapX = Math.max(0, Math.min(MAP_WIDTH, e.clientX - rect.left));
    const clickMapY = Math.max(0, Math.min(MAP_HEIGHT, e.clientY - rect.top));

    // Convert map coordinates back to world coordinates
    const targetWorldX = treeBounds.minX + (clickMapX - offsetX) / mapScale;
    const targetWorldY = treeBounds.minY + (clickMapY - offsetY) / mapScale;

    // Center main viewport on this world coordinate
    const newPanX = containerW / 2 - targetWorldX * zoom;
    const newPanY = containerH / 2 - targetWorldY * zoom;

    onPanChange({ x: newPanX, y: newPanY });
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    handlePointerAction(e);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    handlePointerAction(e);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className={`minimap-widget ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Widget Top Header */}
      <div className="minimap-header">
        <div className="minimap-title">
          <Map size={14} className="minimap-icon" />
          <span>Navigation Mini-Map</span>
        </div>

        <div className="minimap-controls">
          <button
            className="minimap-btn"
            onClick={onResetPan}
            title="Recenter Camera View"
          >
            <Maximize2 size={13} />
          </button>
          <button
            className="minimap-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand Mini-Map' : 'Collapse Mini-Map'}
          >
            {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* MiniMap Interactive Viewport Body */}
      {!isCollapsed && (
        <div
          className="minimap-body"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            ref={svgRef}
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            className="minimap-svg"
          >
            {/* Background Grid Accent */}
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="transparent" />

            {/* Render Miniature Outline Cards for all tree nodes */}
            {nodesBounds.map(node => {
              const mx = toMapX(node.x);
              const my = toMapY(node.y);
              const mw = Math.max(node.w * mapScale, 6);
              const mh = Math.max(node.h * mapScale, 4);
              const deptColor = DEPARTMENTS[node.department]?.color || '#6366f1';

              return (
                <g key={node.id}>
                  <rect
                    x={mx}
                    y={my}
                    width={mw}
                    height={mh}
                    rx={2}
                    fill={deptColor}
                    opacity={0.7}
                    stroke="rgba(255, 255, 255, 0.4)"
                    strokeWidth={0.5}
                  />
                </g>
              );
            })}

            {/* View-Finder Box Overlay */}
            <rect
              x={vfX}
              y={vfY}
              width={vfW}
              height={vfH}
              rx={4}
              className="viewfinder-box"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
