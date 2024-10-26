import React, { useEffect, useRef, useState, useCallback } from "react";
import { generateMockLocations } from "../mockData";
import emptyBlockImage from "../assets/empty-block.png";
import tonBlockImage from "../assets/ton-block-lines.png";
import lockBlockImage from "../assets/block-lock.svg";

const MapCanvas = () => {
  const canvasRef = useRef(null);
  const emptyImageRef = useRef(null);
  const tonImageRef = useRef(null);
  const lockImageRef = useRef(null);
  const [scale, setScale] = useState(10);
  const [offset, setOffset] = useState({ x: 0, y: -200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const tempOffsetRef = useRef({ x: 0, y: -200 });
  const [imagesLoaded, setImagesLoaded] = useState(0);

  // Generate points once and store them, mapping them to our 100x100 grid
  const points = useRef(
    generateMockLocations(0, 99, 0, 99).map((loc) => ({
      x: loc.latitude,
      y: loc.longitude,
      type: loc.type === 1 ? "A" : loc.type === 2 ? "B" : "C",
    }))
  );

  // Load all images
  useEffect(() => {
    const loadImage = (src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        // For SVGs, we want to ensure they maintain their crisp edges
        if (src.endsWith(".svg")) {
          img.style.imageRendering = "optimizeQuality";
        }
        img.onload = () => resolve(img);
      });
    };

    Promise.all([
      loadImage(emptyBlockImage),
      loadImage(tonBlockImage),
      loadImage(lockBlockImage),
    ]).then(([emptyImg, tonImg, lockImg]) => {
      emptyImageRef.current = emptyImg;
      tonImageRef.current = tonImg;
      lockImageRef.current = lockImg;
      setImagesLoaded(3);
    });
  }, []);

  // Get the appropriate image for a point type
  const getPointImage = (type) => {
    switch (type) {
      case "A":
      case "B":
        return tonImageRef.current;
      case "C":
        return lockImageRef.current;
      default:
        return emptyImageRef.current;
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
    if (!canvasRef.current || imagesLoaded < 3) return;

    const ctx = canvasRef.current.getContext("2d");
    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Fill the canvas with black background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

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
          // Save the current context state
          ctx.save();

          // Move to the center of where we want to draw
          ctx.translate(screenX, screenY);

          const pointType = pointMap.get(`${x},${y}`);
          const image = getPointImage(pointType);

          // Draw the appropriate image for the cell
          ctx.drawImage(
            image,
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
  }, [scale, offset, isDragging, isoToScreen, imagesLoaded]);

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

  // Handle zooming
  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();

      // Calculate zoom factor
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(scale * zoomFactor, 1), 20); // Limit scale between 1 and 20

      // Calculate the scale change
      const scaleDiff = newScale / scale;

      // Calculate new offset to maintain the center point
      const newOffset = {
        x: offset.x * scaleDiff,
        y: offset.y * scaleDiff,
      };

      setScale(newScale);
      setOffset(newOffset);
    },
    [scale, offset]
  );

  return (
    <canvas
      ref={canvasRef}
      style={{
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
        backgroundColor: "#000000", // Set black background in CSS as well
        display: "block", // Prevent any unwanted margins
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    />
  );
};

export default MapCanvas;
