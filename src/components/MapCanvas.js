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
  const initialOffset = { x: 0, y: -1500 * 10 };
  const [offset, setOffset] = useState(initialOffset);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const tempOffsetRef = useRef(initialOffset);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const [hoveredCell, setHoveredCell] = useState(null);

  // Track loaded chunks (10x10 areas)
  const loadedChunks = useRef(new Set());
  // Store all points
  const points = useRef([]);

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
    (chunkX, chunkY) => {
      const chunkKey = getChunkKey(chunkX, chunkY);

      // Skip if chunk already loaded
      if (loadedChunks.current.has(chunkKey)) {
        return;
      }

      // Calculate grid coordinates for this chunk
      const startX = chunkX * 10;
      const startY = chunkY * 10;
      const endX = startX + 9;
      const endY = startY + 9;

      // Generate new data for this chunk
      const newPoints = generateMockLocations(startX, endX, startY, endY).map(
        (loc) => ({
          x: loc.latitude,
          y: loc.longitude,
          type: loc.type === 1 ? "A" : loc.type === 2 ? "B" : "C",
        })
      );

      // Append new points
      points.current = [...points.current, ...newPoints];

      // Mark chunk as loaded
      loadedChunks.current.add(chunkKey);
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

    // Add only chunks that are within the viewport and the 100x100 grid
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (x >= 0 && x < 10 && y >= 0 && y < 10) {
          // Stay within 100x100 grid
          visibleChunks.add(getChunkKey(x, y));
        }
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

    for (let x = 0; x < 100; x++) {
      for (let y = 0; y < 100; y++) {
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

    // Draw loaded chunks info
    ctx.save();
    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.fillText(
      `Loaded chunks: ${loadedChunks.current.size}, Visible chunks: ${visibleChunks.length}`,
      10,
      60
    );
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
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      tempOffsetRef.current = offset;
    },
    [offset]
  );

  const handleMouseMove = useCallback(
    (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const currentOffset = isDragging ? tempOffsetRef.current : offset;
      const cell = screenToIso(mouseX, mouseY, currentOffset, scale);

      if (cell.x >= 0 && cell.x < 100 && cell.y >= 0 && cell.y < 100) {
        setHoveredCell(cell);
      } else {
        setHoveredCell(null);
      }

      if (isDragging) {
        tempOffsetRef.current = {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        };
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
    handleMouseUp();
  }, [handleMouseUp]);

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = (mouseX - offset.x - canvasRef.current.width / 2) / scale;
      const worldY = (mouseY - offset.y - canvasRef.current.height / 4) / scale;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(scale * zoomFactor, 1), 20);

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
    />
  );
};

export default MapCanvas;
