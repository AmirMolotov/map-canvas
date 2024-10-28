import { ZOOM_BUTTON_DIMENSIONS } from "./constants";

export class CanvasRenderer {
  constructor(canvas, imageLoader) {
    this.canvas = canvas;
    this.imageLoader = imageLoader;
    this.ctx = canvas.getContext("2d");
  }

  drawBackground() {
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawCell(x, y, image, scale, color = null) {
    const tileWidth = 60 * scale;
    const tileHeight = 30 * scale;

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

    // If a color is provided, draw a semi-transparent rectangle over the cell
    if (color) {
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = 0.3; // Set transparency
      this.ctx.beginPath();
      // Draw diamond shape
      this.ctx.moveTo(0, -tileHeight / 2);
      this.ctx.lineTo(tileWidth / 2, 0);
      this.ctx.lineTo(0, tileHeight / 2);
      this.ctx.lineTo(-tileWidth / 2, 0);
      this.ctx.closePath();
      this.ctx.fill();
    }

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

  drawZoomControls(scale, allowedZoomLevels) {
    const canZoomIn = scale < Math.max(...allowedZoomLevels);
    const canZoomOut = scale > Math.min(...allowedZoomLevels);
    const { x, y1, y2, width, height } = ZOOM_BUTTON_DIMENSIONS;

    // Draw zoom in button
    this.drawZoomButton(x, y1, width, height, "+", canZoomIn);

    // Draw zoom out button
    this.drawZoomButton(x, y2, width, height, "−", canZoomOut);
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
