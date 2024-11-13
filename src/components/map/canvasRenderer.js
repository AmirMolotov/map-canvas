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

  drawCell(x, y, image, scale, isHovered = false) {
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

    // If cell is hovered, draw a semi-transparent blue overlay
    if (isHovered) {
      this.ctx.fillStyle = "rgba(0, 100, 255, 0.3)";
      this.ctx.beginPath();
      this.ctx.moveTo(0, -tileHeight * 0.3); // Top point
      this.ctx.lineTo(tileWidth * 0.3, 0); // Right point
      this.ctx.lineTo(0, tileHeight * 0.3); // Bottom point
      this.ctx.lineTo(-tileWidth * 0.3, 0); // Left point
      this.ctx.closePath();
      this.ctx.fill();
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

  drawZoomButton(x, y, width, height, symbol, enabled) {
    this.ctx.save();

    // Button background
    this.ctx.fillStyle = enabled
      ? "rgba(20, 20, 20, 0.8)"
      : "rgba(40, 40, 40, 0.5)";
    this.ctx.fillRect(x, y, width, height);

    // Button border
    this.ctx.strokeStyle = enabled
      ? "rgba(0, 200, 255, 0.7)"
      : "rgba(60, 60, 60, 0.5)";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, width, height);

    // Glow effect for enabled buttons
    if (enabled) {
      this.ctx.shadowColor = "rgba(0, 200, 255, 0.5)";
      this.ctx.shadowBlur = 5;
      this.ctx.strokeRect(x, y, width, height);
      this.ctx.shadowBlur = 0;
    }

    // Button symbol
    this.ctx.fillStyle = enabled
      ? "rgba(0, 200, 255, 0.9)"
      : "rgba(100, 100, 100, 0.5)";
    this.ctx.font = "20px Arial";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(symbol, x + width / 2, y + height / 2);

    this.ctx.restore();
  }
}
