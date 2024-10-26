import React, { useEffect, useRef, useState, useCallback } from "react";
import { generateMockLocations } from "../mockData";
import emptyBlockImage from "../assets/empty-block.png";

const MapCanvas = () => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  // Fixed scale of 10
  const scale = 10;
  // Set initial position to (0,-200)
  const [offset, setOffset] = useState({ x: 0, y: -200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const tempOffsetRef = useRef({ x: 0, y: -200 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // Generate points once and store them, mapping them to our 100x100 grid
  const points = useRef(
    generateMockLocations(0, 99, 0, 99).map((loc) => ({
      x: loc.latitude,
      y: loc.longitude,
      type: loc.type === 1 ? "A" : loc.type === 2 ? "B" : "C",
    }))
  );

  // Load the empty block image
  useEffect(() => {
    const img = new Image();
    img.src = emptyBlockImage;
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
  }, []);

  // Color mapping for different point types
  const getPointColor = (type) => {
    switch (type) {
      case "A":
        return "#ff0000"; // Red
      case "B":
        return "#00ff00"; // Green
      case "C":
        return "#0000ff"; // Blue
      default:
        return "#f0f0f0"; // Default light gray
    }
  };

  // Convert isometric coordinates to screen coordinates
  const isoToScreen = useCallback((x, y, currentOffset, currentScale) => {
    const screenX = (x - y) * 30 * currentScale;
    const screenY = (x + y) * 15 * currentScale;
    return {
      x: screenX + currentOffset.x + canvasRef.current.width / 2,
      y: screenY + currentOffset.y + canvasRef.current.height / 4,
    };
  }, []);

  // Draw the isometric grid
  const drawGrid = useCallback(() => {
    if (!canvasRef.current || !imageRef.current || !imageLoaded) return;

    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    const currentOffset = isDragging ? tempOffsetRef.current : offset;

    // Create a map for quick point lookup
    const pointMap = new Map(
      points.current.map((p) => [`${p.x},${p.y}`, p.type])
    );

    // Draw 100x100 grid
    for (let x = 0; x < 100; x++) {
      for (let y = 0; y < 100; y++) {
        const { x: screenX, y: screenY } = isoToScreen(
          x,
          y,
          currentOffset,
          scale
        );

        // Calculate tile dimensions
        const tileWidth = 60 * scale; // 2 * 30 (from isoToScreen calculation)
        const tileHeight = 30 * scale; // 2 * 15 (from isoToScreen calculation)

        // Only draw if within canvas bounds (with padding)
        if (
          screenX > -tileWidth &&
          screenX < canvasRef.current.width + tileWidth &&
          screenY > -tileHeight &&
          screenY < canvasRef.current.height + tileHeight
        ) {
          const pointType = pointMap.get(`${x},${y}`);

          if (pointType) {
            // Draw colored tile for points
            ctx.beginPath();
            ctx.moveTo(screenX, screenY - tileHeight / 2);
            ctx.lineTo(screenX + tileWidth / 2, screenY);
            ctx.lineTo(screenX, screenY + tileHeight / 2);
            ctx.lineTo(screenX - tileWidth / 2, screenY);
            ctx.closePath();
            ctx.fillStyle = getPointColor(pointType);
            ctx.fill();
            ctx.strokeStyle = "#ccc";
            ctx.stroke();
          } else {
            // Save the current context state
            ctx.save();

            // Move to the center of where we want to draw
            ctx.translate(screenX, screenY);

            // Draw empty block image for empty cells
            // The image is drawn centered on the tile position
            ctx.drawImage(
              imageRef.current,
              -tileWidth / 2, // Center the image horizontally
              -tileHeight / 2, // Center the image vertically
              tileWidth, // Match the tile width
              tileHeight // Match the tile height
            );

            // Restore the context state
            ctx.restore();
          }
        }
      }
    }
  }, [offset, isDragging, isoToScreen, imageLoaded]);

  useEffect(() => {
    const canvas = canvasRef.current;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Initial draw
    drawGrid();

    // Handle window resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawGrid();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawGrid]);

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (e) => {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      tempOffsetRef.current = offset;
    },
    [offset]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (isDragging) {
        tempOffsetRef.current = {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        };
        drawGrid();
      }
    },
    [isDragging, dragStart, drawGrid]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setOffset(tempOffsetRef.current);
      setIsDragging(false);
    }
  }, [isDragging]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
};

export default MapCanvas;
