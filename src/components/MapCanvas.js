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
  // Center on row 50, col 50
  const initialOffset = { x: 0, y: -1500 * 10 }; // y = -(50 + 50) * 15 * scale
  const [offset, setOffset] = useState(initialOffset);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const tempOffsetRef = useRef(initialOffset);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const [hoveredCell, setHoveredCell] = useState(null);

  // Generate points for 10x10 grid in the center (45-55)
  const points = useRef(
    generateMockLocations(45, 55, 45, 55).map((loc) => ({
      x: loc.latitude,
      y: loc.longitude,
      type: loc.type === 1 ? "A" : loc.type === 2 ? "B" : "C",
    }))
  );

  // Convert screen coordinates to isometric grid coordinates
  const screenToIso = useCallback(
    (screenX, screenY, currentOffset, currentScale) => {
      // Adjust for canvas center and offset
      const x = screenX - currentOffset.x - canvasRef.current.width / 2;
      const y = screenY - currentOffset.y - canvasRef.current.height / 4;

      // Convert to grid coordinates
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

    const pointMap = new Map(
      points.current.map((p) => [`${p.x},${p.y}`, p.type])
    );

    for (let x = 0; x < 100; x++) {
      for (let y = 0; y < 100; y++) {
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
  }, [scale, offset, isDragging, isoToScreen, imagesLoaded, hoveredCell]);

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

      // Update hovered cell
      const currentOffset = isDragging ? tempOffsetRef.current : offset;
      const cell = screenToIso(mouseX, mouseY, currentOffset, scale);

      // Only show coordinates for cells within the 100x100 grid
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
