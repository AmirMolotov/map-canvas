// Convert screen coordinates to isometric grid coordinates
export const screenToIso = (
  screenX,
  screenY,
  currentOffset,
  currentScale,
  canvasWidth,
  canvasHeight
) => {
  const x = screenX - currentOffset.x - canvasWidth / 2;
  const y = screenY - currentOffset.y - canvasHeight / 4;

  const tileWidth = 30 * currentScale;
  const tileHeight = 15 * currentScale;

  const isoX = (x / tileWidth + y / tileHeight) / 2;
  const isoY = (y / tileHeight - x / tileWidth) / 2;

  return {
    x: Math.floor(isoX),
    y: Math.floor(isoY),
  };
};

// Convert isometric coordinates to screen coordinates
export const isoToScreen = (
  x,
  y,
  currentOffset,
  currentScale,
  canvasWidth,
  canvasHeight
) => {
  const screenX = (x - y) * 30 * currentScale;
  const screenY = (x + y) * 15 * currentScale;
  return {
    x: screenX + currentOffset.x + canvasWidth / 2,
    y: screenY + currentOffset.y + canvasHeight / 4,
  };
};

// Get next allowed zoom level
export const getNextZoomLevel = (currentScale, zoomIn, allowedZoomLevels) => {
  const sortedLevels = [...allowedZoomLevels].sort((a, b) => a - b);
  if (zoomIn) {
    return sortedLevels.find((level) => level > currentScale) || currentScale;
  } else {
    return (
      sortedLevels.reverse().find((level) => level < currentScale) ||
      currentScale
    );
  }
};

// Calculate new offset and scale for zooming
export const calculateZoom = (
  mouseX,
  mouseY,
  offset,
  scale,
  newScale,
  canvasWidth,
  canvasHeight
) => {
  const worldX = (mouseX - offset.x - canvasWidth / 2) / scale;
  const worldY = (mouseY - offset.y - canvasHeight / 4) / scale;

  const newScreenX = worldX * newScale + offset.x + canvasWidth / 2;
  const newScreenY = worldY * newScale + offset.y + canvasHeight / 4;

  return {
    x: offset.x + (mouseX - newScreenX),
    y: offset.y + (mouseY - newScreenY),
  };
};
