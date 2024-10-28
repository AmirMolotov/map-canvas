// Convert screen coordinates to isometric grid coordinates
export const screenToIso = (
  screenX,
  screenY,
  currentOffset,
  currentScale,
  canvasWidth,
  canvasHeight
) => {
  // Adjust coordinates relative to canvas center and offset
  const x = screenX - currentOffset.x - canvasWidth / 2;
  const y = screenY - currentOffset.y - canvasHeight / 4;

  const tileWidth = 30 * currentScale;
  const tileHeight = 15 * currentScale;

  // Convert to isometric coordinates
  const isoX = (x / tileWidth + y / tileHeight) / 2;
  const isoY = (y / tileHeight - x / tileWidth) / 2;

  // Round to nearest integer to ensure consistent cell coordinates
  return {
    x: Math.round(isoX),
    y: Math.round(isoY),
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

// Helper function to check if a point is inside a cell's bounds
export const isPointInCell = (
  pointX,
  pointY,
  cellX,
  cellY,
  scale,
  canvasWidth,
  canvasHeight
) => {
  const { x: screenX, y: screenY } = isoToScreen(
    cellX,
    cellY,
    { x: 0, y: 0 },
    scale,
    canvasWidth,
    canvasHeight
  );

  const tileWidth = 30 * scale;
  const tileHeight = 15 * scale;

  // Convert point to local cell coordinates
  const localX = pointX - screenX;
  const localY = pointY - screenY;

  // Check if point is inside diamond shape
  return (
    Math.abs(localX / (tileWidth / 2)) + Math.abs(localY / (tileHeight / 2)) <=
    1
  );
};
