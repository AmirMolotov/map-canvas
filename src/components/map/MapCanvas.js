import React, { useEffect, useRef, useState, useCallback } from "react";
import emptyBlockImage from "../../assets/empty-block.png";
import tonBlockImage from "../../assets/ton-block-lines.png";
import lockBlockImage from "../../assets/lock-block.png";
import userBlockImage from "../../assets/user-block.png";
import MapModal from "./MapModal";
import { useCellData } from "../../context/CellContext";

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
  const {
    setClickedUserData,
    setClickedLockData,
    setClickedMineData,
    setClickedEmptyCell,
  } = useCellData();
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
  const dragThreshold = useRef(5);
  const mouseDownPos = useRef(null);
  const touchStartPos = useRef(null);
  const touchStartTime = useRef(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  const chunkManager = useRef(
    new ChunkManager(
      setClickedUserData,
      setClickedLockData,
      setClickedMineData,
      setClickedEmptyCell
    )
  );
  const imageLoader = useRef(new ImageLoader());
  const canvasRenderer = useRef(null);

  const isClickWithinCell = useCallback(
    (x, y, cellX, cellY) => {
      const tileWidth = 402 * scale;
      const tileHeight = 285 * scale;

      // Get screen coordinates of the cell
      const { x: screenX, y: screenY } = isoToScreen(
        cellX,
        cellY,
        isDragging ? tempOffsetRef.current : offset,
        scale,
        canvasRef.current.width,
        canvasRef.current.height
      );

      // Define the clickable area (rhombus shape)
      // Using 0.15 as a factor to make the clickable area match the blue rhombus outline exactly
      const halfWidth = tileWidth * 0.3;
      const halfHeight = tileHeight * 0.3;

      // Translate click coordinates relative to cell center
      const relX = x - screenX;
      const relY = y - screenY;

      // Check if point is within rhombus shape using a more precise diamond equation
      // Using absolute values to create a diamond shape
      return Math.abs(relX / halfWidth) + Math.abs(relY / halfHeight) <= 1;
    },
    [scale, offset, isDragging]
  );

  const getCellFromEvent = useCallback(
    (clientX, clientY) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const pixelRatio = window.devicePixelRatio || 1;

      const currentOffset = isDragging ? tempOffsetRef.current : offset;
      const cell = screenToIso(
        x * pixelRatio,
        y * pixelRatio,
        currentOffset,
        scale,
        canvasRef.current.width,
        canvasRef.current.height
      );

      // Only return the cell if the click is within its bounds
      if (isClickWithinCell(x * pixelRatio, y * pixelRatio, cell.x, cell.y)) {
        return cell;
      }
      return null;
    },
    [isDragging, offset, scale, isClickWithinCell]
  );

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

        const tileWidth = 402 * scale;
        const tileHeight = 285 * scale;

        if (
          screenX > -tileWidth &&
          screenX < canvas.width + tileWidth &&
          screenY > -tileHeight &&
          screenY < canvas.height + tileHeight
        ) {
          const pointType = pointMap.get(`${x},${y}`);
          const image = imageLoader.current.getPointImage(pointType);
          renderer.drawCell(screenX, screenY, image, scale);
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
  }, [scale, offset, isDragging, hoveredCell, isLoadingChunk]);

  const openModal = (cell) => {
    if (!isDragging && cell) {
      chunkManager.current.handlePointClick(cell.x, cell.y);
      setSelectedCell(cell);
      setTimeout(() => {
        setIsModalOpen(true);
      }, 100);
    }
  };

  const handleMouseDown = useCallback(
    (e) => {
      if (isMobileDevice) return;

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

      const cell = getCellFromEvent(e.clientX, e.clientY);
      if (cell) {
        setHoveredCell(cell);
      }

      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      tempOffsetRef.current = offset;
    },
    [offset, scale, isMobileDevice, getCellFromEvent]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (isMobileDevice) return;

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

      const newCell = getCellFromEvent(e.clientX, e.clientY);

      const lastCell = lastHoveredCellRef.current;
      if (
        !lastCell ||
        (newCell && (lastCell.x !== newCell.x || lastCell.y !== newCell.y))
      ) {
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
    [
      isDragging,
      dragStart,
      drawGrid,
      offset,
      scale,
      isMobileDevice,
      getCellFromEvent,
    ]
  );

  const handleMouseUp = useCallback(
    (e) => {
      if (isMobileDevice) return;

      if (!isDragging && mouseDownPos.current) {
        const deltaX = Math.abs(e.clientX - mouseDownPos.current.x);
        const deltaY = Math.abs(e.clientY - mouseDownPos.current.y);
        if (deltaX < dragThreshold.current && deltaY < dragThreshold.current) {
          const cell = getCellFromEvent(e.clientX, e.clientY);
          openModal(cell);
        }
      }

      if (isDragging) {
        setOffset(tempOffsetRef.current);
      }

      setIsDragging(false);
      mouseDownPos.current = null;
    },
    [isDragging, isMobileDevice, getCellFromEvent]
  );

  const handleMouseLeave = useCallback(() => {
    if (isMobileDevice) return;

    setHoveredCell(null);
    setLastMousePos(null);
    lastHoveredCellRef.current = null;
    setIsDragging(false);
    mouseDownPos.current = null;
  }, [isMobileDevice]);

  const handleWheel = useCallback(
    (e) => {
      if (isMobileDevice) return;

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
      if (!isMobileDevice) return;

      const touch = e.touches[0];
      const rect = canvasRef.current.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      touchStartTime.current = Date.now();

      const cell = getCellFromEvent(touch.clientX, touch.clientY);
      if (cell) {
        setHoveredCell(cell);
      }

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
    [offset, scale, isDragging, isMobileDevice, getCellFromEvent]
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (!isMobileDevice) return;

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
      if (!isMobileDevice) return;

      if (!isDragging && touchStartPos.current) {
        const touchEndTime = Date.now();
        const touchDuration = touchEndTime - touchStartTime.current;

        if (touchDuration < 200) {
          const cell = hoveredCell;
          openModal(cell);
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
    [isDragging, isMobileDevice, hoveredCell]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const pixelRatio = window.devicePixelRatio || 1;

    // Set the canvas size in actual pixels
    canvas.width = window.innerWidth * pixelRatio;
    canvas.height = window.innerHeight * pixelRatio;

    // Set the canvas display size
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    drawGrid();

    const handleResize = () => {
      // Update canvas size with pixel ratio on resize
      canvas.width = window.innerWidth * pixelRatio;
      canvas.height = window.innerHeight * pixelRatio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
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
          width: "100%",
          height: "100%",
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
      <MapModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default MapCanvas;
