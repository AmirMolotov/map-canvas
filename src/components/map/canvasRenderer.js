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
    isBorderCell = false
  ) {
    const tileWidth = 402 * scale;
    const tileHeight = 285 * scale;

    this.ctx.save();
    this.ctx.translate(x, y);

    if (!isReachable && !isBorderCell) {
      // Draw solid black for disabled cells (except border cells)
      this.ctx.fillStyle = "#000000";
      this.ctx.beginPath();
      this.ctx.moveTo(0, -tileHeight * 0.3); // Top point
      this.ctx.lineTo(tileWidth * 0.3, 0); // Right point
      this.ctx.lineTo(0, tileHeight * 0.3); // Bottom point
      this.ctx.lineTo(-tileWidth * 0.3, 0); // Left point
      this.ctx.closePath();
      this.ctx.fill();
    } else {
      // Draw the base image for reachable cells and border cells
      this.ctx.drawImage(
        image,
        -tileWidth / 2,
        -tileHeight / 2,
        tileWidth,
        tileHeight
      );

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
