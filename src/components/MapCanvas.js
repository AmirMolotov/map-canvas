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
  const [scale, setScale] = useState(8);
  const initialOffset = { x: 0, y: -1500 * 10 };
  const [offset, setOffset] = useState(initialOffset);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const tempOffsetRef = useRef(initialOffset);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [isLoadingChunk, setIsLoadingChunk] = useState(false);
  const lastTouchDistance = useRef(null);
  const lastTouchMoveTime = useRef(0);
  const [lastMousePos, setLastMousePos] = useState(null);

  // Track loaded chunks (10x10 areas)
  const loadedChunks = useRef(new Set());
  // Store all points
  const points = useRef([]);
  // Track chunks being loading
  const loadingChunks = useRef(new Set());

  // Define allowed zoom levels
  const allowedZoomLevels = [8, 6, 4];

  // Helper function to get next allowed zoom level
  const getNextZoomLevel = (currentScale, zoomIn) => {
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

  // Convert screen coordinates to isometric grid coordinates
  const screenToIso = useCallback(
    (screenX, screenY, currentOffset, currentScale) => {
      const x = screenX - currentOffset.x - canvasRef.current.width / 2;
      const y = screenY - currentOffset.y - canvasRef.current.height / 4;

      const tileWidth = 30 * currentScale;
      const tileHeight = 15 * currentScale;

      const isoX = (x / tileWidth + y / tileHeight) / 2;
      const isoY = (y / tileHeight - x / tileWidth) / 2;

      return {
        x: Math.floor(isoX),
        y: Math.floor(isoY),
      };
    },
    []
  );

  // Convert chunk coordinates to chunk key
  const getChunkKey = useCallback(
    (chunkX, chunkY) => `${chunkX},${chunkY}`,
    []
  );

  // Load data for a specific chunk
  const loadChunkData = useCallback(
    async (chunkX, chunkY) => {
      const chunkKey = getChunkKey(chunkX, chunkY);

      // Skip if chunk already loaded or is currently loading
      if (
        loadedChunks.current.has(chunkKey) ||
        loadingChunks.current.has(chunkKey)
      ) {
        return;
      }

      // Mark chunk as being loaded
      loadingChunks.current.add(chunkKey);
      setIsLoadingChunk(true);

      try {
        // Calculate grid coordinates for this chunk
        const startX = chunkX * 10;
        const startY = chunkY * 10;
        const endX = startX + 9;
        const endY = startY + 9;

        // Generate new data for this chunk
        const newPoints = await generateMockLocations(
          startX,
          endX,
          startY,
          endY
        );
        const mappedPoints = newPoints.map((loc) => ({
          x: loc.latitude,
          y: loc.longitude,
          type: loc.type === 1 ? "A" : loc.type === 2 ? "B" : "C",
        }));

        // Append new points
        points.current = [...points.current, ...mappedPoints];

        // Mark chunk as loaded
        loadedChunks.current.add(chunkKey);
      } finally {
        // Remove chunk from loading set
        loadingChunks.current.delete(chunkKey);
        if (loadingChunks.current.size === 0) {
          setIsLoadingChunk(false);
        }
      }
    },
    [getChunkKey]
  );

  // Calculate visible chunks based on screen coordinates
  const getVisibleChunks = useCallback(() => {
    if (!canvasRef.current) return [];

    const canvas = canvasRef.current;
    const currentOffset = isDragging ? tempOffsetRef.current : offset;
    const visibleChunks = new Set();

    // Calculate grid coordinates for each corner of the viewport
    const corners = [
      screenToIso(0, 0, currentOffset, scale),
      screenToIso(canvas.width, 0, currentOffset, scale),
      screenToIso(0, canvas.height, currentOffset, scale),
      screenToIso(canvas.width, canvas.height, currentOffset, scale),
    ];

    // Find min/max coordinates
    const minX = Math.floor(Math.min(...corners.map((c) => c.x)) / 10);
    const maxX = Math.ceil(Math.max(...corners.map((c) => c.x)) / 10);
    const minY = Math.floor(Math.min(...corners.map((c) => c.y)) / 10);
    const maxY = Math.ceil(Math.max(...corners.map((c) => c.y)) / 10);

    // Add chunks within the viewport with expanded boundaries
    for (let x = minX - 1; x <= maxX + 1; x++) {
      for (let y = minY - 1; y <= maxY + 1; y++) {
        visibleChunks.add(getChunkKey(x, y));
      }
    }

    return Array.from(visibleChunks);
  }, [isDragging, offset, scale, screenToIso, getChunkKey]);

  // Load initial chunk (centered on 50,50)
  useEffect(() => {
    const centerChunkX = Math.floor(50 / 10);
    const centerChunkY = Math.floor(50 / 10);
    loadChunkData(centerChunkX, centerChunkY);
  }, [loadChunkData]);

  // Check and load visible chunks
  const checkAndLoadChunks = useCallback(() => {
    const visibleChunks = getVisibleChunks();

    visibleChunks.forEach((chunkKey) => {
      const [chunkX, chunkY] = chunkKey.split(",").map(Number);
      loadChunkData(chunkX, chunkY);
    });
  }, [getVisibleChunks, loadChunkData]);

  // Load all images
  useEffect(() => {
    const loadImage = (src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = src;
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

  const isoToScreen = useCallback((x, y, currentOffset, currentScale) => {
    const screenX = (x - y) * 30 * currentScale;
    const screenY = (x + y) * 15 * currentScale;
    return {
      x: screenX + currentOffset.x + canvasRef.current.width / 2,
      y: screenY + currentOffset.y + canvasRef.current.height / 4,
    };
  }, []);

  const drawGrid = useCallback(() => {
    if (!canvasRef.current || imagesLoaded < 3) return;

    const ctx = canvasRef.current.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    const currentOffset = isDragging ? tempOffsetRef.current : offset;

    // Create point lookup map
    const pointMap = new Map(
      points.current.map((p) => [`${p.x},${p.y}`, p.type])
    );

    // Check and load new chunks before drawing
    checkAndLoadChunks();

    // Get visible chunks for rendering
    const visibleChunks = getVisibleChunks();
    const visibleChunksSet = new Set(visibleChunks);

    // Calculate visible area in grid coordinates
    const corners = [
      screenToIso(0, 0, currentOffset, scale),
      screenToIso(canvasRef.current.width, 0, currentOffset, scale),
      screenToIso(0, canvasRef.current.height, currentOffset, scale),
      screenToIso(
        canvasRef.current.width,
        canvasRef.current.height,
        currentOffset,
        scale
      ),
    ];

    const minX = Math.floor(Math.min(...corners.map((c) => c.x))) - 2;
    const maxX = Math.ceil(Math.max(...corners.map((c) => c.x))) + 2;
    const minY = Math.floor(Math.min(...corners.map((c) => c.y))) - 2;
    const maxY = Math.ceil(Math.max(...corners.map((c) => c.y))) + 2;

    // Render visible cells
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        // Check if this cell's chunk is visible
        const chunkX = Math.floor(x / 10);
        const chunkY = Math.floor(y / 10);
        const chunkKey = getChunkKey(chunkX, chunkY);

        if (!visibleChunksSet.has(chunkKey)) {
          continue; // Skip rendering cells in non-visible chunks
        }

        const { x: screenX, y: screenY } = isoToScreen(
          x,
          y,
          currentOffset,
          scale
        );

        const tileWidth = 60 * scale;
        const tileHeight = 30 * scale;

        if (
          screenX > -tileWidth &&
          screenX < canvasRef.current.width + tileWidth &&
          screenY > -tileHeight &&
          screenY < canvasRef.current.height + tileHeight
        ) {
          ctx.save();
          ctx.translate(screenX, screenY);

          const pointType = pointMap.get(`${x},${y}`);
          const image = getPointImage(pointType);

          ctx.drawImage(
            image,
            -tileWidth / 2,
            -tileHeight / 2,
            tileWidth,
            tileHeight
          );

          ctx.restore();
        }
      }
    }

    // Draw hover coordinates
    if (hoveredCell) {
      ctx.save();
      ctx.fillStyle = "white";
      ctx.font = "16px Arial";
      ctx.fillText(`Row: ${hoveredCell.x}, Col: ${hoveredCell.y}`, 10, 30);
      ctx.restore();
    }

    // Draw loaded chunks info and loading indicator
    ctx.save();
    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.fillText(
      `Loaded chunks: ${loadedChunks.current.size}, Visible chunks: ${
        visibleChunks.length
      }${isLoadingChunk ? " (Loading...)" : ""}`,
      10,
      60
    );
    ctx.restore();

    // Draw zoom controls
    ctx.save();

    // Check if zoom levels are at min/max
    const canZoomIn = scale < Math.max(...allowedZoomLevels);
    const canZoomOut = scale > Math.min(...allowedZoomLevels);

    // Draw zoom in button
    ctx.fillStyle = canZoomIn
      ? "rgba(20, 20, 20, 0.8)"
      : "rgba(40, 40, 40, 0.5)";
    ctx.fillRect(10, 100, 30, 30);
    ctx.strokeStyle = canZoomIn
      ? "rgba(0, 200, 255, 0.7)"
      : "rgba(60, 60, 60, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 100, 30, 30);
    if (canZoomIn) {
      ctx.shadowColor = "rgba(0, 200, 255, 0.5)";
      ctx.shadowBlur = 5;
      ctx.strokeRect(10, 100, 30, 30);
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = canZoomIn
      ? "rgba(0, 200, 255, 0.9)"
      : "rgba(100, 100, 100, 0.5)";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+", 25, 115);

    // Draw zoom out button
    ctx.fillStyle = canZoomOut
      ? "rgba(20, 20, 20, 0.8)"
      : "rgba(40, 40, 40, 0.5)";
    ctx.fillRect(10, 140, 30, 30);
    ctx.strokeStyle = canZoomOut
      ? "rgba(0, 200, 255, 0.7)"
      : "rgba(60, 60, 60, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 140, 30, 30);
    if (canZoomOut) {
      ctx.shadowColor = "rgba(0, 200, 255, 0.5)";
      ctx.shadowBlur = 5;
      ctx.strokeRect(10, 140, 30, 30);
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = canZoomOut
      ? "rgba(0, 200, 255, 0.9)"
      : "rgba(100, 100, 100, 0.5)";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("−", 25, 155);

    ctx.restore();
  }, [
    scale,
    offset,
    isDragging,
    isoToScreen,
    imagesLoaded,
    hoveredCell,
    checkAndLoadChunks,
    getVisibleChunks,
    getChunkKey,
    isLoadingChunk,
    screenToIso,
    lastMousePos,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawGrid();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawGrid();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawGrid]);

  const handleMouseDown = useCallback(
    (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if click is on zoom buttons
      if (x >= 10 && x <= 40) {
        if (y >= 100 && y <= 130) {
          // Zoom in from center
          const newScale = getNextZoomLevel(scale, true);
          if (newScale !== scale) {
            const canvas = canvasRef.current;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            const worldX = (centerX - offset.x - canvas.width / 2) / scale;
            const worldY = (centerY - offset.y - canvas.height / 4) / scale;

            const newScreenX = worldX * newScale + offset.x + canvas.width / 2;
            const newScreenY = worldY * newScale + offset.y + canvas.height / 4;

            setScale(newScale);
            setOffset({
              x: offset.x + (centerX - newScreenX),
              y: offset.y + (centerY - newScreenY),
            });
          }
          return;
        } else if (y >= 140 && y <= 170) {
          // Zoom out from center
          const newScale = getNextZoomLevel(scale, false);
          if (newScale !== scale) {
            const canvas = canvasRef.current;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            const worldX = (centerX - offset.x - canvas.width / 2) / scale;
            const worldY = (centerY - offset.y - canvas.height / 4) / scale;

            const newScreenX = worldX * newScale + offset.x + canvas.width / 2;
            const newScreenY = worldY * newScale + offset.y + canvas.height / 4;

            setScale(newScale);
            setOffset({
              x: offset.x + (centerX - newScreenX),
              y: offset.y + (centerY - newScreenY),
            });
          }
          return;
        }
      }

      // Regular drag handling
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      tempOffsetRef.current = offset;
    },
    [offset, scale]
  );

  const handleMouseMove = useCallback(
    (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Update last mouse position for hover effects
      setLastMousePos({ x: mouseX, y: mouseY });

      const currentOffset = isDragging ? tempOffsetRef.current : offset;
      const cell = screenToIso(mouseX, mouseY, currentOffset, scale);
      setHoveredCell(cell);

      if (isDragging) {
        tempOffsetRef.current = {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        };
        drawGrid();
      } else {
        // Redraw for hover effects even when not dragging
        drawGrid();
      }
    },
    [isDragging, dragStart, drawGrid, offset, scale, screenToIso]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setOffset(tempOffsetRef.current);
      setIsDragging(false);
    }
  }, [isDragging]);

  const handleMouseLeave = useCallback(() => {
    setHoveredCell(null);
    setLastMousePos(null);
    handleMouseUp();
  }, [handleMouseUp]);

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault(); // Prevent default wheel behavior
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = (mouseX - offset.x - canvasRef.current.width / 2) / scale;
      const worldY = (mouseY - offset.y - canvasRef.current.height / 4) / scale;

      const newScale = getNextZoomLevel(scale, e.deltaY < 0);
      if (newScale === scale) return;

      const newScreenX =
        worldX * newScale + offset.x + canvasRef.current.width / 2;
      const newScreenY =
        worldY * newScale + offset.y + canvasRef.current.height / 4;

      const newOffset = {
        x: offset.x + (mouseX - newScreenX),
        y: offset.y + (mouseY - newScreenY),
      };

      setScale(newScale);
      setOffset(newOffset);
    },
    [scale, offset]
  );

  const handleTouchStart = useCallback(
    (e) => {
      const touch = e.touches[0];
      const rect = canvasRef.current.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      // Check if touch is on zoom buttons
      if (x >= 10 && x <= 40) {
        if (y >= 100 && y <= 130) {
          // Zoom in from center
          const newScale = getNextZoomLevel(scale, true);
          if (newScale !== scale) {
            const canvas = canvasRef.current;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            const worldX = (centerX - offset.x - canvas.width / 2) / scale;
            const worldY = (centerY - offset.y - canvas.height / 4) / scale;

            const newScreenX = worldX * newScale + offset.x + canvas.width / 2;
            const newScreenY = worldY * newScale + offset.y + canvas.height / 4;

            setScale(newScale);
            setOffset({
              x: offset.x + (centerX - newScreenX),
              y: offset.y + (centerY - newScreenY),
            });
          }
          return;
        } else if (y >= 140 && y <= 170) {
          // Zoom out from center
          const newScale = getNextZoomLevel(scale, false);
          if (newScale !== scale) {
            const canvas = canvasRef.current;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            const worldX = (centerX - offset.x - canvas.width / 2) / scale;
            const worldY = (centerY - offset.y - canvas.height / 4) / scale;

            const newScreenX = worldX * newScale + offset.x + canvas.width / 2;
            const newScreenY = worldY * newScale + offset.y + canvas.height / 4;

            setScale(newScale);
            setOffset({
              x: offset.x + (centerX - newScreenX),
              y: offset.y + (centerY - newScreenY),
            });
          }
          return;
        }
      }

      setIsDragging(true);
      setDragStart({
        x: touch.clientX - offset.x,
        y: touch.clientY - offset.y,
      });
      tempOffsetRef.current = offset;

      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        lastTouchDistance.current = distance;
      }
    },
    [offset, scale]
  );

  const handleTouchMove = useCallback(
    (e) => {
      // Throttle touch move updates to every 16ms (approximately 60fps)
      const now = Date.now();
      if (now - lastTouchMoveTime.current < 16) {
        return;
      }
      lastTouchMoveTime.current = now;

      if (e.touches.length === 2) {
        // Disable pinch zoom
        e.preventDefault();
      } else if (e.touches.length === 1 && isDragging) {
        const touch = e.touches[0];
        tempOffsetRef.current = {
          x: touch.clientX - dragStart.x,
          y: touch.clientY - dragStart.y,
        };
        requestAnimationFrame(drawGrid);
      }
    },
    [isDragging, dragStart, drawGrid]
  );

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      setOffset(tempOffsetRef.current);
      setIsDragging(false);
    }
    lastTouchDistance.current = null;
  }, [isDragging]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
        backgroundColor: "#000000",
        display: "block",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
};

export default MapCanvas;
