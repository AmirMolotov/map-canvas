export class CanvasRenderer {
  constructor(canvas, imageLoader) {
    this.canvas = canvas;
    this.imageLoader = imageLoader;

    // Get the device pixel ratio
    this.pixelRatio = window.devicePixelRatio || 1;

    // Set up high DPI canvas
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * this.pixelRatio;
    canvas.height = rect.height * this.pixelRatio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    this.ctx = canvas.getContext("2d");
    // Scale all drawing operations by the pixel ratio
    this.ctx.scale(this.pixelRatio, this.pixelRatio);
  }

  drawBackground() {
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(
      0,
      0,
      this.canvas.width / this.pixelRatio,
      this.canvas.height / this.pixelRatio
    );
  }

  drawCell(
    x,
    y,
    image,
    scale,
    isHovered = false,
    isReachable = true,
    cellX,
    cellY
  ) {
    const tileWidth = 402 * scale;
    const tileHeight = 285 * scale;

    this.ctx.save();
    this.ctx.translate(x, y);

    // Draw the base image first
    this.ctx.drawImage(
      image,
      -tileWidth / 2,
      -tileHeight / 2,
      tileWidth,
      tileHeight
    );

    // Draw borders only for positive cells (x≥0, y≥0)
    if (
      cellX !== undefined &&
      cellY !== undefined &&
      cellX >= 0 &&
      cellY >= 0
    ) {
      this.ctx.strokeStyle = "blue";
      this.ctx.lineWidth = 6;

      const extension = 0.5; // Full cell boundary size

      if (cellX === 0) {
        // Draw left border for cells at x=0 (following the isometric grid)
        this.ctx.beginPath();
        this.ctx.moveTo(-tileWidth * extension, 0); // Left point
        this.ctx.lineTo(0, -tileHeight * extension); // Top point
        this.ctx.stroke();
      }

      if (cellY === 0) {
        // Draw right border for cells at y=0 (following the isometric grid)
        this.ctx.beginPath();
        this.ctx.moveTo(0, -tileHeight * extension); // Top point
        this.ctx.lineTo(tileWidth * extension, 0); // Right point
        this.ctx.stroke();
      }
    }

    // Draw hover effect if cell is hovered
    if (isHovered) {
      this.ctx.fillStyle = "rgba(254, 92, 92, 0.3)";
      this.ctx.beginPath();
      this.ctx.moveTo(0, -tileHeight * 0.3); // Top point
      this.ctx.lineTo(tileWidth * 0.3, 0); // Right point
      this.ctx.lineTo(0, tileHeight * 0.3); // Bottom point
      this.ctx.lineTo(-tileWidth * 0.3, 0); // Left point
      this.ctx.closePath();
      this.ctx.fill();
    }

    // Draw dark overlay for unreachable areas
    if (!isReachable) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      this.ctx.beginPath();
      this.ctx.moveTo(0, -tileHeight * 0.3); // Top point
      this.ctx.lineTo(tileWidth * 0.3, 0); // Right point
      this.ctx.lineTo(0, tileHeight * 0.3); // Bottom point
      this.ctx.lineTo(-tileWidth * 0.3, 0); // Left point
      this.ctx.closePath();
      this.ctx.fill();

      // Draw connecting red lines to neighbor edge centers
      this.ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
      this.ctx.lineWidth = 2;

      // Calculate midpoints between center and corners
      const edgeX = tileWidth * 0.15; // Half of 0.3
      const edgeY = tileHeight * 0.15; // Half of 0.3

      // Top-right connection
      this.ctx.beginPath();
      this.ctx.moveTo(edgeX, -edgeY);
      this.ctx.lineTo(tileWidth * 0.35, -tileHeight * 0.35);
      this.ctx.stroke();

      // Top-left connection
      this.ctx.beginPath();
      this.ctx.moveTo(-edgeX, -edgeY);
      this.ctx.lineTo(-tileWidth * 0.35, -tileHeight * 0.35);
      this.ctx.stroke();

      // Bottom-left connection
      this.ctx.beginPath();
      this.ctx.moveTo(-edgeX, edgeY);
      this.ctx.lineTo(-tileWidth * 0.35, tileHeight * 0.35);
      this.ctx.stroke();

      // Bottom-right connection
      this.ctx.beginPath();
      this.ctx.moveTo(edgeX, edgeY);
      this.ctx.lineTo(tileWidth * 0.35, tileHeight * 0.35);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawRedRhombus(x, y, scale) {
    const tileWidth = 402 * scale;
    const tileHeight = 285 * scale;

    this.ctx.save();
    this.ctx.translate(x, y);

    // Draw rhombus
    this.ctx.beginPath();
    this.ctx.moveTo(0, -tileHeight * 0.3); // Top point
    this.ctx.lineTo(tileWidth * 0.3, 0); // Right point
    this.ctx.lineTo(0, tileHeight * 0.3); // Bottom point
    this.ctx.lineTo(-tileWidth * 0.3, 0); // Left point
    this.ctx.closePath();

    // Set rhombus style
    this.ctx.strokeStyle = "red";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawHoverCoordinates(hoveredCell) {
    if (hoveredCell) {
      this.ctx.save();
      this.ctx.fillStyle = "white";
      this.ctx.font = "16px Arial";
      this.ctx.fillText(`Row: ${hoveredCell.x}, Col: ${hoveredCell.y}`, 10, 30);
      this.ctx.restore();
    }
  }

  drawBounds(bounds) {
    this.ctx.save();
    this.ctx.fillStyle = "white";
    this.ctx.font = "16px Arial";
    this.ctx.fillText(
      `Bounds: X(${bounds.minX} to ${bounds.maxX}), Y(${bounds.minY} to ${bounds.maxY})`,
      10,
      90
    );
    this.ctx.restore();
  }

  drawChunkInfo(loadedChunks, visibleChunks, isLoading) {
    this.ctx.save();
    this.ctx.fillStyle = "white";
    this.ctx.font = "14px Arial";
    this.ctx.fillText(
      `Loaded chunks: ${loadedChunks}, Visible chunks: ${visibleChunks}${
        isLoading ? " (Loading...)" : ""
      }`,
      10,
      60
    );
    this.ctx.restore();
  }
}
