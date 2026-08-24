import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Captures the entire org tree canvas at high resolution,
 * without UI overlays, background cutoffs, or zoom scale artifacts.
 */
export async function captureChartCanvas(viewportElem, theme = 'dark') {
  if (!viewportElem) return null;

  // Store original transform & transition
  const originalTransform = viewportElem.style.transform;
  const originalTransition = viewportElem.style.transition;

  // Temporarily reset transform for unscaled 1:1 render capture
  viewportElem.style.transform = 'none';
  viewportElem.style.transition = 'none';

  // Measure full tree container dimensions
  const nodeCards = viewportElem.querySelectorAll('.org-node-card');
  if (nodeCards.length === 0) {
    viewportElem.style.transform = originalTransform;
    viewportElem.style.transition = originalTransition;
    return null;
  }

  const viewportRect = viewportElem.getBoundingClientRect();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  nodeCards.forEach(card => {
    const rect = card.getBoundingClientRect();
    const left = rect.left - viewportRect.left;
    const top = rect.top - viewportRect.top;
    const right = left + rect.width;
    const bottom = top + rect.height;

    if (left < minX) minX = left;
    if (top < minY) minY = top;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  });

  const padding = 60;
  const contentWidth = Math.ceil(maxX - minX + padding * 2);
  const contentHeight = Math.ceil(maxY - minY + padding * 2);

  const exportWidth = Math.max(viewportElem.scrollWidth + padding, contentWidth);
  const exportHeight = Math.max(viewportElem.scrollHeight + padding, contentHeight);

  const bgColor = theme === 'light' ? '#f1f5f9' : '#0b0f19';

  try {
    const canvas = await html2canvas(viewportElem, {
      scale: 2, // High DPI resolution output
      useCORS: true,
      allowTaint: true,
      backgroundColor: bgColor,
      logging: false,
      width: exportWidth,
      height: exportHeight,
      windowWidth: exportWidth,
      windowHeight: exportHeight,
      onclone: (clonedDoc) => {
        const clonedViewport = clonedDoc.querySelector('.tree-viewport');
        if (clonedViewport) {
          clonedViewport.style.transform = 'none';
          clonedViewport.style.transition = 'none';
        }
      }
    });

    return canvas;
  } finally {
    // Always restore original styles
    viewportElem.style.transform = originalTransform;
    viewportElem.style.transition = originalTransition;
  }
}

/**
 * Downloads high-res PNG file: org-chart-[timestamp].png
 */
export async function exportToPNG(viewportElem, theme = 'dark') {
  const canvas = await captureChartCanvas(viewportElem, theme);
  if (!canvas) return;

  const timestamp = getFormattedTimestamp();
  const image = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `org-chart-${timestamp}.png`;
  link.href = image;
  link.click();
}

/**
 * Downloads high-res PDF file: org-chart-[timestamp].pdf
 */
export async function exportToPDF(viewportElem, theme = 'dark') {
  const canvas = await captureChartCanvas(viewportElem, theme);
  if (!canvas) return;

  const imgData = canvas.toDataURL('image/png');
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  const orientation = canvasWidth > canvasHeight ? 'landscape' : 'portrait';

  const pdf = new jsPDF({
    orientation: orientation,
    unit: 'px',
    format: [canvasWidth / 2, canvasHeight / 2]
  });

  pdf.addImage(imgData, 'PNG', 0, 0, canvasWidth / 2, canvasHeight / 2);
  const timestamp = getFormattedTimestamp();
  pdf.save(`org-chart-${timestamp}.pdf`);
}

function getFormattedTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
