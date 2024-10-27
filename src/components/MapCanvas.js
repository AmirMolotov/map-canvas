import React, { useEffect, useRef, useState, useCallback } from "react";
import emptyBlockImage from "../assets/empty-block.png";
import tonBlockImage from "../assets/ton-block-lines.png";
import lockBlockImage from "../assets/lock-block.png";
import userBlockImage from "../assets/user-block.png";
import axios from "axios";

const MapCanvas = () => {
  const canvasRef = useRef(null);
  const emptyImageRef = useRef(null);
  const tonImageRef = useRef(null);
  const lockImageRef = useRef(null);
  const userImageRef = useRef(null);
  const [scale, setScale] = useState(6);
  const initialOffset = { x: 0, y: 0 };
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

  // Constants for chunk size
  const CHUNK_SIZE = 20; // Maximum range for a chunk
  const MAX_RANGE = 20; // Maximum allowed range for API requests

  // Track loaded chunks
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
        const startX = chunkX * CHUNK_SIZE;
        const startY = chunkY * CHUNK_SIZE;
        // Ensure we don't exceed the maximum range
        const endX = startX + (MAX_RANGE - 1);
        const endY = startY + (MAX_RANGE - 1);

        const body = {
          init_data:
            "query_id=AAEjkvwGAAAAACOS_AYyDS2l&user=%7B%22id%22%3A117215779%2C%22first_name%22%3A%22Ali%22%2C%22last_name%22%3A%22Manouchehri%22%2C%22username%22%3A%22manouchehri1990%22%2C%22language_code%22%3A%22en%22%2C%22allows_write_to_pm%22%3Atrue%7D&auth_date=1729849891&hash=b2690a8b4b2233b20656f544d9384ed2c4daf9e2f68666d74425b09df23abde2",
          map_info: {
            planet_id: 1,
            x_loc_min: startX,
            x_loc_max: endX,
            y_loc_min: startY,
            y_loc_max: endY,
          },
        };

        // Make API request with data in body
        const response = await axios({
          method: "post",
          url: "https://m0vj9xw1-8000.euw.devtunnels.ms/api/map_range/",
          data: body,
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.data) {
          // Process each location in the response
          const processedPoints = [];

          // Process range
          if (response.data[0]?.range) {
            // Handle range data if needed
          }

          // Process users
          if (response.data[1]?.users) {
            response.data[1].users.forEach((user) => {
              processedPoints.push({
                x: user.x_location,
                y: user.y_location,
                type: "user",
              });
            });
          }

          // Process mines
          if (response.data[2]?.mines) {
            response.data[2].mines.forEach((mine) => {
              processedPoints.push({
                x: mine.x_location,
                y: mine.y_location,
                type: "mine",
              });
            });
          }

          // Process locks
          if (response.data[3]?.locks) {
            response.data[3].locks.forEach((lock) => {
              processedPoints.push({
                x: lock.x_location,
                y: lock.y_location,
                type: "lock",
              });
            });
          }

          // Update points
          points.current = [...points.current, ...processedPoints];

          // Mark chunk as loaded
          loadedChunks.current.add(chunkKey);
        }
      } catch (error) {
        console.error("Error loading chunk data:", error);
        if (error.response) {
          console.error(
            "Response error:",
            error.response.status,
            error.response.data
          );
        }
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

  // Calculate visible chunks based on screen coordinates and zoom level
  const getVisibleChunks = useCallback(() => {
    if (!canvasRef.current) return [];

    const canvas = canvasRef.current;
    const currentOffset = isDragging ? tempOffsetRef.current : offset;
    const visibleChunks = new Set();

    // Calculate the number of cells that fit in the viewport at current zoom level
    const tileWidth = 30 * scale;
    const tileHeight = 15 * scale;

    // Calculate how many cells fit in the viewport
    const viewportCellsX = Math.ceil(canvas.width / tileWidth) * 2; // *2 because isometric tiles overlap
    const viewportCellsY = Math.ceil(canvas.height / tileHeight) * 2;

    // Get the center point of the viewport in grid coordinates
    const centerPoint = screenToIso(
      canvas.width / 2,
      canvas.height / 2,
      currentOffset,
      scale
    );

    // Calculate the range of cells to check based on viewport size and zoom
    const halfViewportX = Math.ceil(viewportCellsX / 2);
    const halfViewportY = Math.ceil(viewportCellsY / 2);

    // Calculate the visible range in grid coordinates
    const minX = centerPoint.x - halfViewportX;
    const maxX = centerPoint.x + halfViewportX;
    const minY = centerPoint.y - halfViewportY;
    const maxY = centerPoint.y + halfViewportY;

    // Convert grid coordinates to chunk coordinates
    const minChunkX = Math.floor(minX / CHUNK_SIZE);
    const maxChunkX = Math.ceil(maxX / CHUNK_SIZE);
    const minChunkY = Math.floor(minY / CHUNK_SIZE);
    const maxChunkY = Math.ceil(maxY / CHUNK_SIZE);

    // Add visible chunks
    for (let x = minChunkX; x <= maxChunkX; x++) {
      for (let y = minChunkY; y <= maxChunkY; y++) {
        visibleChunks.add(getChunkKey(x, y));
      }
    }

    return Array.from(visibleChunks);
  }, [isDragging, offset, scale, screenToIso, getChunkKey]);

  // Load initial chunk (centered on 50,50)
  useEffect(() => {
    const centerChunkX = Math.floor(50 / CHUNK_SIZE);
    const centerChunkY = Math.floor(50 / CHUNK_SIZE);
    loadChunkData(centerChunkX, centerChunkY);
  }, [loadChunkData]);

  // Check and load visible chunks
  const checkAndLoadChunks = useCallback(() => {
    const visibleChunks = getVisibleChunks();

    // Clear points for chunks that are no longer visible
    const visibleChunksSet = new Set(visibleChunks);
    points.current = points.current.filter((point) => {
      const pointChunkX = Math.floor(point.x / CHUNK_SIZE);
      const pointChunkY = Math.floor(point.y / CHUNK_SIZE);
      return visibleChunksSet.has(getChunkKey(pointChunkX, pointChunkY));
    });

    // Clear loaded chunks that are no longer visible
    loadedChunks.current = new Set(
      Array.from(loadedChunks.current).filter((chunkKey) =>
        visibleChunksSet.has(chunkKey)
      )
    );

    // Load new visible chunks
    visibleChunks.forEach((chunkKey) => {
      const [chunkX, chunkY] = chunkKey.split(",").map(Number);
      loadChunkData(chunkX, chunkY);
    });
  }, [getVisibleChunks, loadChunkData, getChunkKey]);

  // Load all images
  useEffect(() => {
    const loadImage = (src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
      });
    };

    Promise.all([
      loadImage(emptyBlockImage),
      loadImage(tonBlockImage),
      loadImage(lockBlockImage),
      loadImage(userBlockImage),
    ]).then(([emptyImg, tonImg, lockImg, userImg]) => {
      emptyImageRef.current = emptyImg;
      tonImageRef.current = tonImg;
      lockImageRef.current = lockImg;
      userImageRef.current = userImg;
      setImagesLoaded(4);
    });
  }, []);

  const getPointImage = (type) => {
    switch (type) {
      case "user":
        return userImageRef.current;
      case "mine":
        return tonImageRef.current;
      case "lock":
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
    if (!canvasRef.current || imagesLoaded < 4) return;

    const ctx = canvasRef.current.getContext("2d");
    // ctx.imageSmoothingEnabled = true;
    // ctx.imageSmoothingQuality = "high";

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

    const minX = Math.floor(Math.min(...corners.map((c) => c.x)));
    const maxX = Math.ceil(Math.max(...corners.map((c) => c.x)));
    const minY = Math.floor(Math.min(...corners.map((c) => c.y)));
    const maxY = Math.ceil(Math.max(...corners.map((c) => c.y)));

    // Render visible cells
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        // Check if this cell's chunk is visible
        const chunkX = Math.floor(x / CHUNK_SIZE);
        const chunkY = Math.floor(y / CHUNK_SIZE);
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

    // Draw visible bounds
    ctx.save();
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText(
      `Bounds: X(${minX} to ${maxX}), Y(${minY} to ${maxY})`,
      10,
      90
    );
    ctx.restore();

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
    ctx.fillRect(10, 120, 30, 30);
    ctx.strokeStyle = canZoomIn
      ? "rgba(0, 200, 255, 0.7)"
      : "rgba(60, 60, 60, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 120, 30, 30);
    if (canZoomIn) {
      ctx.shadowColor = "rgba(0, 200, 255, 0.5)";
      ctx.shadowBlur = 5;
      ctx.strokeRect(10, 120, 30, 30);
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = canZoomIn
      ? "rgba(0, 200, 255, 0.9)"
      : "rgba(100, 100, 100, 0.5)";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+", 25, 135);

    // Draw zoom out button
    ctx.fillStyle = canZoomOut
      ? "rgba(20, 20, 20, 0.8)"
      : "rgba(40, 40, 40, 0.5)";
    ctx.fillRect(10, 160, 30, 30);
    ctx.strokeStyle = canZoomOut
      ? "rgba(0, 200, 255, 0.7)"
      : "rgba(60, 60, 60, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 160, 30, 30);
    if (canZoomOut) {
      ctx.shadowColor = "rgba(0, 200, 255, 0.5)";
      ctx.shadowBlur = 5;
      ctx.strokeRect(10, 160, 30, 30);
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = canZoomOut
      ? "rgba(0, 200, 255, 0.9)"
      : "rgba(100, 100, 100, 0.5)";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("−", 25, 175);

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
        if (y >= 120 && y <= 150) {
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
        } else if (y >= 160 && y <= 190) {
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
        if (y >= 120 && y <= 150) {
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
        } else if (y >= 160 && y <= 190) {
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
