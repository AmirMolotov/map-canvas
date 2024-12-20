import React, { useEffect, useRef, useState, useCallback } from "react";
import emptyBlockImage from "../../assets/empty.png";
import tonBlockImage from "../../assets/mine.png";
import lockBlockImage from "../../assets/lock-block.png";
import userBlockImage from "../../assets/user-block.png";
import MapModal from "./MapModal";
import { useCellData } from "../../context/CellContext";

import {
  INITIAL_OFFSET,
  INITIAL_SCALE,
  MOBILE_INITIAL_SCALE,
  ALLOWED_ZOOM_LEVELS,
  MOBILE_ZOOM_LEVELS,
  MOBILE_PAN_SPEED_MULTIPLIER,
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

// Define the maximum map dimensions
const MAX_MAP_SIZE = {
  width: 100,
  height: 100,
};

const MapCanvas = () => {
  const {
    setClickedUserData,
    setClickedLockData,
    setClickedMineData,
    setClickedEmptyCell,
  } = useCellData();
  const canvasRef = useRef(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [scale, setScale] = useState(INITIAL_SCALE);
  const [offset, setOffset] = useState(INITIAL_OFFSET);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const tempOffsetRef = useRef(INITIAL_OFFSET);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [isLoadingChunk, setIsLoadingChunk] = useState(false);
  const lastTouchDistance = useRef(null);
  const lastTouchCenter = useRef(null);
  const lastTouchMoveTime = useRef(0);
  const [lastMousePos, setLastMousePos] = useState(null);
  const lastHoveredCellRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const dragThreshold = useRef(5);
  const mouseDownPos = useRef(null);
  const touchStartPos = useRef(null);
  const touchStartTime = useRef(null);
  const isMultiTouch = useRef(false);

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

  // Function to check if a cell is within the valid map bounds
  const isValidCell = useCallback((x, y) => {
    return (
      x >= 0 && y >= 0 && x < MAX_MAP_SIZE.width && y < MAX_MAP_SIZE.height
    );
  }, []);

  // Function to correct offset to prevent panning to negative areas
  const correctOffset = useCallback(
    (currentOffset) => {
      const canvas = canvasRef.current;
      if (!canvas) return currentOffset;

      // Get the corners of the current view
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

      // Calculate the center of the view
      const centerX =
        (Math.min(...corners.map((c) => c.x)) +
          Math.max(...corners.map((c) => c.x))) /
        2;
      const centerY =
        (Math.min(...corners.map((c) => c.y)) +
          Math.max(...corners.map((c) => c.y))) /
        2;

      let newOffset = { ...currentOffset };

      // Prevent panning to negative coordinates
      if (centerX < 0) {
        const { x: screenX } = isoToScreen(
          0,
          centerY,
          currentOffset,
          scale,
          canvas.width,
          canvas.height
        );
        newOffset.x += canvas.width / 2 - screenX;
      }
      // Handle X coordinates beyond max width
      else if (centerX >= MAX_MAP_SIZE.width) {
        const { x: screenX } = isoToScreen(
          MAX_MAP_SIZE.width - 1,
          centerY,
          currentOffset,
          scale,
          canvas.width,
          canvas.height
        );
        newOffset.x += canvas.width / 2 - screenX;
      }

      // Prevent panning to negative coordinates
      if (centerY < 0) {
        const { y: screenY } = isoToScreen(
          centerX,
          0,
          currentOffset,
          scale,
          canvas.width,
          canvas.height
        );
        newOffset.y += canvas.height / 2 - screenY;
      }
      // Handle Y coordinates beyond max height
      else if (centerY >= MAX_MAP_SIZE.height) {
        const { y: screenY } = isoToScreen(
          centerX,
          MAX_MAP_SIZE.height - 1,
          currentOffset,
          scale,
          canvas.width,
          canvas.height
        );
        newOffset.y += canvas.height / 2 - screenY;
      }

      return newOffset;
    },
    [scale]
  );

  const isClickWithinCell = useCallback(
    (x, y, cellX, cellY) => {
      const tileWidth = 402 * scale;
      const tileHeight = 285 * scale;

      const { x: screenX, y: screenY } = isoToScreen(
        cellX,
        cellY,
        isDragging ? tempOffsetRef.current : offset,
        scale,
        canvasRef.current.width,
        canvasRef.current.height
      );

      const halfWidth = tileWidth * 0.3;
      const halfHeight = tileHeight * 0.3;

      const relX = x - screenX;
      const relY = y - screenY;

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

      if (isClickWithinCell(x * pixelRatio, y * pixelRatio, cell.x, cell.y)) {
        return cell;
      }
      return null;
    },
    [isDragging, offset, scale, isClickWithinCell]
  );

  const openModal = useCallback(
    (cell) => {
      if (!isDragging && cell && isValidCell(cell.x, cell.y)) {
        chunkManager.current.handlePointClick(cell.x, cell.y);
        setSelectedCell(cell);
        setTimeout(() => {
          setIsModalOpen(true);
        }, 100);
      }
    },
    [isDragging, isValidCell]
  );

  useEffect(() => {
    const checkMobile = () => {
      const mediaQuery = window.matchMedia("(max-width: 1024px)");
      const isMobile = mediaQuery.matches;
      setIsMobileDevice(isMobile);
      setScale(isMobile ? MOBILE_INITIAL_SCALE : INITIAL_SCALE);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const getCurrentZoomLevels = useCallback(() => {
    return isMobileDevice ? MOBILE_ZOOM_LEVELS : ALLOWED_ZOOM_LEVELS;
  }, [isMobileDevice]);

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

    // Filter out chunks with negative coordinates
    const validChunks = visibleChunks.filter((chunkKey) => {
      const [chunkX, chunkY] = chunkKey.split(",").map(Number);
      return chunkX >= 0 && chunkY >= 0;
    });

    chunkManager.current.clearNonVisibleChunks(validChunks);

    validChunks.forEach((chunkKey) => {
      const [chunkX, chunkY] = chunkKey.split(",").map(Number);
      chunkManager.current.loadChunkData(chunkX, chunkY, setIsLoadingChunk);
    });

    const points = chunkManager.current.getPoints();
    const pointMap = new Map(points.map((p) => [`${p.x},${p.y}`, p.type]));

    // Calculate view corners
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

    // Calculate bounds
    const bounds = {
      minX: Math.floor(Math.min(...corners.map((c) => c.x))),
      maxX: Math.min(
        MAX_MAP_SIZE.width - 1,
        Math.ceil(Math.max(...corners.map((c) => c.x)))
      ),
      minY: Math.floor(Math.min(...corners.map((c) => c.y))),
      maxY: Math.min(
        MAX_MAP_SIZE.height - 1,
        Math.ceil(Math.max(...corners.map((c) => c.y)))
      ),
    };

    // Render all visible cells
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
          const isHovered =
            hoveredCell && hoveredCell.x === x && hoveredCell.y === y;
          const isReachable = x >= 0 && y >= 0; // Cells with negative coordinates are not reachable
          renderer.drawCell(
            screenX,
            screenY,
            image,
            scale,
            isHovered,
            isReachable
          );
        }
      }
    }

    renderer.drawHoverCoordinates(hoveredCell);
    renderer.drawBounds(bounds);
    renderer.drawChunkInfo(
      chunkManager.current.getLoadedChunksCount(),
      validChunks.length,
      isLoadingChunk
    );
  }, [scale, offset, isDragging, hoveredCell, isLoadingChunk]);

  const handleMouseDown = useCallback(
    (e) => {
      if (isMobileDevice) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const cell = getCellFromEvent(e.clientX, e.clientY);
      if (cell && isValidCell(cell.x, cell.y)) {
        setHoveredCell(cell);
      }

      mouseDownPos.current = { x: e.clientX, y: e.clientY };
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      tempOffsetRef.current = offset;
    },
    [offset, isMobileDevice, getCellFromEvent, isValidCell]
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
        if (newCell && isValidCell(newCell.x, newCell.y)) {
          setHoveredCell(newCell);
        } else {
          setHoveredCell(null);
        }
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
      isValidCell,
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
          if (cell && isValidCell(cell.x, cell.y)) {
            openModal(cell);
          }
        }
      }

      if (isDragging) {
        const correctedOffset = correctOffset(tempOffsetRef.current);
        setOffset(correctedOffset);
        tempOffsetRef.current = correctedOffset;
      }

      setIsDragging(false);
      mouseDownPos.current = null;
    },
    [
      isDragging,
      isMobileDevice,
      getCellFromEvent,
      isValidCell,
      correctOffset,
      openModal,
    ]
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
        getCurrentZoomLevels()
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
      setOffset(correctOffset(newOffset));
    },
    [scale, offset, isMobileDevice, getCurrentZoomLevels, correctOffset]
  );

  const handleTouchStart = useCallback(
    (e) => {
      if (!isMobileDevice) return;

      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      touchStartTime.current = Date.now();

      if (e.touches.length === 2) {
        isMultiTouch.current = true;
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        lastTouchDistance.current = distance;

        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        lastTouchCenter.current = { x: centerX, y: centerY };
      } else {
        isMultiTouch.current = false;
        const cell = getCellFromEvent(touch.clientX, touch.clientY);
        if (cell && isValidCell(cell.x, cell.y)) {
          setHoveredCell(cell);
        }

        setDragStart({
          x: touch.clientX - offset.x,
          y: touch.clientY - offset.y,
        });
        tempOffsetRef.current = offset;
      }
    },
    [offset, isDragging, isMobileDevice, getCellFromEvent, isValidCell]
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (!isMobileDevice) return;

      const now = Date.now();
      if (now - lastTouchMoveTime.current < 16) {
        return;
      }
      lastTouchMoveTime.current = now;

      if (e.touches.length === 2) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        const rect = canvasRef.current.getBoundingClientRect();
        const pinchCenterX = (centerX - rect.left) * window.devicePixelRatio;
        const pinchCenterY = (centerY - rect.top) * window.devicePixelRatio;

        const newDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        if (lastTouchDistance.current && lastTouchCenter.current) {
          const distanceChange = newDistance / lastTouchDistance.current;

          const zoomingIn = distanceChange > 1;
          const newScale = getNextZoomLevel(
            scale,
            zoomingIn,
            getCurrentZoomLevels()
          );

          if (newScale !== scale) {
            const newOffset = calculateZoom(
              pinchCenterX,
              pinchCenterY,
              offset,
              scale,
              newScale,
              canvasRef.current.width,
              canvasRef.current.height
            );

            setScale(newScale);
            const correctedOffset = correctOffset(newOffset);
            setOffset(correctedOffset);
          }
        }

        lastTouchDistance.current = newDistance;
        lastTouchCenter.current = { x: centerX, y: centerY };
      } else if (e.touches.length === 1 && touchStartPos.current) {
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);

        if (deltaX > dragThreshold.current || deltaY > dragThreshold.current) {
          setIsDragging(true);
        }

        if (isDragging) {
          const movementX =
            (touch.clientX - touchStartPos.current.x) *
            MOBILE_PAN_SPEED_MULTIPLIER;
          const movementY =
            (touch.clientY - touchStartPos.current.y) *
            MOBILE_PAN_SPEED_MULTIPLIER;

          tempOffsetRef.current = {
            x: tempOffsetRef.current.x + movementX,
            y: tempOffsetRef.current.y + movementY,
          };

          touchStartPos.current = { x: touch.clientX, y: touch.clientY };
          requestAnimationFrame(drawGrid);
        }
      }
    },
    [
      isDragging,
      dragStart,
      drawGrid,
      isMobileDevice,
      scale,
      offset,
      getCurrentZoomLevels,
      correctOffset,
    ]
  );

  const handleTouchEnd = useCallback(
    (e) => {
      if (!isMobileDevice) return;

      if (!isMultiTouch.current && !isDragging && touchStartPos.current) {
        const touchEndTime = Date.now();
        const touchDuration = touchEndTime - touchStartTime.current;

        if (touchDuration < 200) {
          const cell = hoveredCell;
          if (cell && isValidCell(cell.x, cell.y)) {
            openModal(cell);
          }
        }
      }

      if (isDragging) {
        const correctedOffset = correctOffset(tempOffsetRef.current);
        setOffset(correctedOffset);
        tempOffsetRef.current = correctedOffset;
      }

      setIsDragging(false);
      touchStartPos.current = null;
      touchStartTime.current = null;
      lastTouchDistance.current = null;
      lastTouchCenter.current = null;
      isMultiTouch.current = false;
    },
    [
      isDragging,
      isMobileDevice,
      hoveredCell,
      isValidCell,
      correctOffset,
      openModal,
    ]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = window.innerWidth * pixelRatio;
    canvas.height = window.innerHeight * pixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    drawGrid();

    const handleResize = () => {
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
