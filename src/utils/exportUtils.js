import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Resolves once every <img> inside `container` has either finished loading or
// definitively failed - never left "in flight". html2canvas snapshots whatever is on
// screen the instant it's called; a photo that's still mid-request (or a broken one
// that's mid-retry) gets captured as the browser's tiny broken-image glyph, which then
// gets scaled up by the 2x export resolution into a blurry/pixelated square. Most
// avatars fall back to a local, no-network initials badge now (see OrgNode.jsx) so this
// mainly matters for members who DO have a real photo URL - this makes sure that photo
// is actually decoded and on screen before the capture, instead of racing it. Bounded
// per image so one slow/unreachable host can't hang the whole export.
async function waitForImages(container, perImageTimeoutMs = 4000) {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(images.map((img) => {
    if (img.complete) {
      // Already finished (loaded or errored) - `decode()` still confirms the bitmap is
      // actually ready to paint, not just that the network request resolved.
      return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    }
    return new Promise((resolve) => {
      const done = () => {
        img.removeEventListener('load', done);
        img.removeEventListener('error', done);
        resolve();
      };
      img.addEventListener('load', done);
      img.addEventListener('error', done);
      setTimeout(done, perImageTimeoutMs);
    });
  }));
}

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

  // Make sure every avatar photo is actually loaded (or has given up) before the
  // snapshot - see waitForImages above.
  await waitForImages(viewportElem);

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
      // Safety net on top of waitForImages() above: if some image still hasn't settled
      // (a slow host, not just a broken one), don't let it block the capture forever -
      // html2canvas gives up on that one image after this many ms and proceeds.
      imageTimeout: 8000,
      onclone: (clonedDoc) => {
        const clonedViewport = clonedDoc.querySelector('.tree-viewport');
        if (clonedViewport) {
          clonedViewport.style.transform = 'none';
          clonedViewport.style.transition = 'none';
        }

        // `backdrop-filter` (the glass/blur effect behind every card) isn't part of
        // html2canvas's supported CSS - it silently ignores it, so the export was
        // already never showing the real frosted-glass look. Left alone, the card's
        // background color underneath is a translucent rgba() meant to be paired with
        // that blur; without it, it just shows through to whatever's behind, which can
        // look inconsistently hazy across a large chart. Forcing a plain opaque
        // background on cards for the export only fixes that mismatch instead of
        // leaving it to accident.
        clonedDoc.querySelectorAll('.org-node-card').forEach((card) => {
          card.style.backdropFilter = 'none';
          card.style.background = theme === 'light' ? '#ffffff' : '#111827';
        });
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
