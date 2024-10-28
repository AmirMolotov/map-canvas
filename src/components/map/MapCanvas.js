import React, { useEffect, useRef, useState, useCallback } from "react";
import emptyBlockImage from "../../assets/empty-block.png";
import tonBlockImage from "../../assets/ton-block-lines.png";
import lockBlockImage from "../../assets/lock-block.png";
import userBlockImage from "../../assets/user-block.png";
import MapModal from "./MapModal";

import {
  INITIAL_OFFSET,
  INITIAL_SCALE,
  ALLOWED_ZOOM_LEVELS,
  CHUNK_SIZE,
} from "./constants";
import {
  screenToIso,
  isoToScreen,
  getNextZoomLevel,
  calculateZoom,
} from "./gridUtils";
import { ChunkManager } from "./chunkManager";
import { CanvasRenderer } from "./canvasRenderer";
import { ImageLoader } from "./imageLoader";

const MapCanvas = () => {
  const canvasRef = useRef(null);
  const [scale, setScale] = useState(INITIAL_SCALE);
  const [offset, setOffset] = useState(INITIAL_OFFSET);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const tempOffsetRef = useRef(INITIAL_OFFSET);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [isLoadingChunk, setIsLoadingChunk] = useState(false);
  const lastTouchDistance = useRef(null);
  const lastTouchMoveTime = useRef(0);
  const [lastMousePos, setLastMousePos] = useState(null);
  const lastHoveredCellRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [mapStyle, setMapStyle] = useState("standard");
  const dragThreshold = useRef(5);
  const mouseDownPos = useRef(null);
  const touchStartPos = useRef(null);
  const touchStartTime = useRef(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  const chunkManager = useRef(new ChunkManager());
  const imageLoader = useRef(new ImageLoader());
  const canvasRenderer = useRef(null);

  // Add device detection
  useEffect(() => {
    const checkMobile = () => {
      const mediaQuery = window.matchMedia("(max-width: 1024px)");
      setIsMobileDevice(mediaQuery.matches);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    imageLoader.current.loadImages({
      empty: emptyBlockImage,
      ton: tonBlockImage,
      lock: lockBlockImage,
      user: userBlockImage,
    });
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      canvasRenderer.current = new CanvasRenderer(
        canvasRef.current,
        imageLoader.current
      );
    }
  }, []);

  useEffect(() => {
    const centerChunkX = Math.floor(50 / CHUNK_SIZE);
    const centerChunkY = Math.floor(50 / CHUNK_SIZE);
    chunkManager.current.loadChunkData(
      centerChunkX,
      centerChunkY,
      setIsLoadingChunk
    );
  }, []);

  const getCellColor = (x, y) => {
    switch (mapStyle) {
      case "satellite":
        return `hsl(${Math.abs(x * 20 + y * 20) % 360}, 70%, 40%)`;
      case "terrain":
        return `hsl(120, ${30 + (Math.abs(x + y) % 40)}%, ${
          40 + (Math.abs(x - y) % 30)
        }%)`;
      case "standard":
      default:
        const sum = Math.abs(x + y);
        if (sum % 3 === 0) return "#FF0000";
        if (sum % 3 === 1) return "#00FF00";
        return "#0000FF";
    }
  };

  const handleStyleSelect = (style) => {
    setMapStyle(style);
    setIsModalOpen(false);
    drawGrid();
  };

  const drawGrid = useCallback(() => {
    if (!canvasRef.current || !imageLoader.current.isLoaded()) return;

    const canvas = canvasRef.current;
    const currentOffset = isDragging ? tempOffsetRef.current : offset;
    const renderer = canvasRenderer.current;

    renderer.drawBackground();

    const visibleChunks = chunkManager.current.getVisibleChunks(
      screenToIso,
      currentOffset,
      scale,
      canvas
    );
    chunkManager.current.clearNonVisibleChunks(visibleChunks);

    visibleChunks.forEach((chunkKey) => {
      const [chunkX, chunkY] = chunkKey.split(",").map(Number);
      chunkManager.current.loadChunkData(chunkX, chunkY, setIsLoadingChunk);
    });

    const points = chunkManager.current.getPoints();
    const pointMap = new Map(points.map((p) => [`${p.x},${p.y}`, p.type]));

    const corners = [
      screenToIso(0, 0, currentOffset, scale, canvas.width, canvas.height),
      screenToIso(
        canvas.width,
        0,
        currentOffset,
        scale,
        canvas.width,
        canvas.height
      ),
      screenToIso(
        0,
        canvas.height,
        currentOffset,
        scale,
        canvas.width,
        canvas.height
      ),
      screenToIso(
        canvas.width,
        canvas.height,
        currentOffset,
        scale,
        canvas.width,
        canvas.height
      ),
    ];

    const bounds = {
      minX: Math.floor(Math.min(...corners.map((c) => c.x))),
      maxX: Math.ceil(Math.max(...corners.map((c) => c.x))),
      minY: Math.floor(Math.min(...corners.map((c) => c.y))),
      maxY: Math.ceil(Math.max(...corners.map((c) => c.y))),
    };

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        const { x: screenX, y: screenY } = isoToScreen(
          x,
          y,
          currentOffset,
          scale,
          canvas.width,
          canvas.height
        );

        const tileWidth = 60 * scale;
        const tileHeight = 30 * scale;

        if (
          screenX > -tileWidth &&
          screenX < canvas.width + tileWidth &&
          screenY > -tileHeight &&
          screenY < canvas.height + tileHeight
        ) {
          const pointType = pointMap.get(`${x},${y}`);
          const image = imageLoader.current.getPointImage(pointType);
          const color = getCellColor(x, y);
          renderer.drawCell(screenX, screenY, image, scale, color);
        }
      }
    }

    renderer.drawHoverCoordinates(hoveredCell);
    renderer.drawBounds(bounds);
    renderer.drawChunkInfo(
      chunkManager.current.getLoadedChunksCount(),
      visibleChunks.length,
      isLoadingChunk
    );
    renderer.drawZoomControls(scale, ALLOWED_ZOOM_LEVELS);
  }, [scale, offset, isDragging, hoveredCell, isLoadingChunk, mapStyle]);

  const openModal = () => {
    if (!isDragging) {
      setSelectedCell(hoveredCell);
      setTimeout(() => {
        setIsModalOpen(true);
      }, 100);
    }
  };

  const handleMouseDown = useCallback(
    (e) => {
      if (isMobileDevice) return; // Skip if mobile device

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseDownPos.current = { x: e.clientX, y: e.clientY };

      if (x >= 10 && x <= 40) {
        if ((y >= 120 && y <= 150) || (y >= 160 && y <= 190)) {
          const zoomIn = y < 160;
          const newScale = getNextZoomLevel(scale, zoomIn, ALLOWED_ZOOM_LEVELS);
          setIsModalOpen(false);
          if (newScale !== scale) {
            const newOffset = calculateZoom(
              canvasRef.current.width / 2,
              canvasRef.current.height / 2,
              offset,
              scale,
              newScale,
              canvasRef.current.width,
              canvasRef.current.height
            );
            setScale(newScale);
            setOffset(newOffset);
          }
          return;
        }
      }

      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      tempOffsetRef.current = offset;
    },
    [offset, scale, isMobileDevice]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (isMobileDevice) return; // Skip if mobile device

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setLastMousePos({ x: mouseX, y: mouseY });

      if (mouseDownPos.current) {
        const deltaX = Math.abs(e.clientX - mouseDownPos.current.x);
        const deltaY = Math.abs(e.clientY - mouseDownPos.current.y);
        if (deltaX > dragThreshold.current || deltaY > dragThreshold.current) {
          setIsDragging(true);
        }
      }

      const currentOffset = isDragging ? tempOffsetRef.current : offset;
      const newCell = screenToIso(
        mouseX,
        mouseY,
        currentOffset,
        scale,
        canvasRef.current.width,
        canvasRef.current.height
      );

      const lastCell = lastHoveredCellRef.current;
      if (!lastCell || lastCell.x !== newCell.x || lastCell.y !== newCell.y) {
        lastHoveredCellRef.current = newCell;
        setHoveredCell(newCell);
      }

      if (isDragging) {
        tempOffsetRef.current = {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        };
        drawGrid();
      } else {
        drawGrid();
      }
    },
    [isDragging, dragStart, drawGrid, offset, scale, isMobileDevice]
  );

  const handleMouseUp = useCallback(
    (e) => {
      if (isMobileDevice) return; // Skip if mobile device

      if (!isDragging && mouseDownPos.current) {
        const deltaX = Math.abs(e.clientX - mouseDownPos.current.x);
        const deltaY = Math.abs(e.clientY - mouseDownPos.current.y);
        if (deltaX < dragThreshold.current && deltaY < dragThreshold.current) {
          openModal();
        }
      }

      if (isDragging) {
        setOffset(tempOffsetRef.current);
      }

      setIsDragging(false);
      mouseDownPos.current = null;
    },
    [isDragging, isMobileDevice]
  );

  const handleMouseLeave = useCallback(() => {
    if (isMobileDevice) return; // Skip if mobile device

    setHoveredCell(null);
    setLastMousePos(null);
    lastHoveredCellRef.current = null;
    setIsDragging(false);
    mouseDownPos.current = null;
  }, [isMobileDevice]);

  const handleWheel = useCallback(
    (e) => {
      if (isMobileDevice) return; // Skip if mobile device

      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newScale = getNextZoomLevel(
        scale,
        e.deltaY < 0,
        ALLOWED_ZOOM_LEVELS
      );
      if (newScale === scale) return;

      const newOffset = calculateZoom(
        mouseX,
        mouseY,
        offset,
        scale,
        newScale,
        canvasRef.current.width,
        canvasRef.current.height
      );

      setScale(newScale);
      setOffset(newOffset);
    },
    [scale, offset, isMobileDevice]
  );

  const handleTouchStart = useCallback(
    (e) => {
      if (!isMobileDevice) return; // Skip if not mobile device

      const touch = e.touches[0];
      const rect = canvasRef.current.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      touchStartTime.current = Date.now();

      // Update hovered cell for touch
      const currentOffset = isDragging ? tempOffsetRef.current : offset;
      const newCell = screenToIso(
        x,
        y,
        currentOffset,
        scale,
        canvasRef.current.width,
        canvasRef.current.height
      );
      setHoveredCell(newCell);

      if (x >= 10 && x <= 40) {
        if ((y >= 120 && y <= 150) || (y >= 160 && y <= 190)) {
          const zoomIn = y < 160;
          const newScale = getNextZoomLevel(scale, zoomIn, ALLOWED_ZOOM_LEVELS);
          if (newScale !== scale) {
            const newOffset = calculateZoom(
              canvasRef.current.width / 2,
              canvasRef.current.height / 2,
              offset,
              scale,
              newScale,
              canvasRef.current.width,
              canvasRef.current.height
            );
            setScale(newScale);
            setOffset(newOffset);
          }
          return;
        }
      }

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
    [offset, scale, isDragging, isMobileDevice]
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (!isMobileDevice) return; // Skip if not mobile device

      const now = Date.now();
      if (now - lastTouchMoveTime.current < 16) {
        return;
      }
      lastTouchMoveTime.current = now;

      if (touchStartPos.current) {
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
        if (deltaX > dragThreshold.current || deltaY > dragThreshold.current) {
          setIsDragging(true);
        }
      }

      if (e.touches.length === 2) {
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
    [isDragging, dragStart, drawGrid, isMobileDevice]
  );

  const handleTouchEnd = useCallback(
    (e) => {
      if (!isMobileDevice) return; // Skip if not mobile device

      if (!isDragging && touchStartPos.current) {
        const touchEndTime = Date.now();
        const touchDuration = touchEndTime - touchStartTime.current;

        // Only open modal for short taps (less than 200ms)
        if (touchDuration < 200) {
          openModal();
        }
      }

      if (isDragging) {
        setOffset(tempOffsetRef.current);
      }

      setIsDragging(false);
      touchStartPos.current = null;
      touchStartTime.current = null;
      lastTouchDistance.current = null;
    },
    [isDragging, isMobileDevice]
  );

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

  return (
    <>
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
      <MapModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onStyleSelect={handleStyleSelect}
      />
    </>
  );
};

export default MapCanvas;