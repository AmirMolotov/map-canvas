import axios from "axios";
import { CHUNK_SIZE, MAX_RANGE } from "./constants";

export class ChunkManager {
  constructor(
    setClickedUserData,
    setClickedLockData,
    setClickedMineData,
    setClickedEmptyCell
  ) {
    this.loadedChunks = new Set();
    this.loadingChunks = new Set();
    this.points = [];
    this.usersData = new Map();
    this.locksData = new Map();
    this.minesData = new Map();
    this.setClickedUserData = setClickedUserData;
    this.setClickedLockData = setClickedLockData;
    this.setClickedMineData = setClickedMineData;
    this.setClickedEmptyCell = setClickedEmptyCell;
    this.chunksCache = new Map();
  }

  getChunkKey(chunkX, chunkY) {
    return `${chunkX},${chunkY}`;
  }

  processChunkData(data, chunkX, chunkY) {
    const processedPoints = [];

    if (data[1]?.users) {
      data[1].users.forEach((user) => {
        const point = {
          x: user.x_location,
          y: user.y_location,
          type: "user",
          userData: user,
        };
        processedPoints.push(point);
        this.usersData.set(`${user.x_location},${user.y_location}`, user);
      });
    }

    if (data[2]?.mines) {
      data[2].mines.forEach((mine) => {
        const point = {
          x: mine.x_location,
          y: mine.y_location,
          type: "mine",
        };
        processedPoints.push(point);
        this.minesData.set(`${mine.x_location},${mine.y_location}`, {
          id: mine.id,
          x: mine.x_location,
          y: mine.y_location,
        });
      });
    }

    if (data[3]?.locks) {
      data[3].locks.forEach((lock) => {
        const point = {
          x: lock.x_location,
          y: lock.y_location,
          type: "lock",
        };
        processedPoints.push(point);
        this.locksData.set(`${lock.x_location},${lock.y_location}`, {
          id: lock.id,
          x: lock.x_location,
          y: lock.y_location,
        });
      });
    }

    // Remove any existing points in this chunk before adding new ones
    const startX = chunkX * CHUNK_SIZE;
    const startY = chunkY * CHUNK_SIZE;
    const endX = startX + CHUNK_SIZE;
    const endY = startY + CHUNK_SIZE;

    this.points = this.points.filter((point) => {
      const isInChunk =
        point.x >= startX &&
        point.x < endX &&
        point.y >= startY &&
        point.y < endY;
      return !isInChunk;
    });

    // Add the new points
    this.points = [...this.points, ...processedPoints];
  }

  async loadChunkData(
    chunkX,
    chunkY,
    onLoadingStateChange,
    forceRefetch = false
  ) {
    // Skip invalid chunks
    if (chunkX < 0 || chunkY < 0) return;

    const chunkKey = this.getChunkKey(chunkX, chunkY);

    // Skip if chunk is currently loading
    if (this.loadingChunks.has(chunkKey)) {
      return;
    }

    // Check if chunk data exists in cache and we're not forcing a refetch
    if (!forceRefetch && this.chunksCache.has(chunkKey)) {
      const cachedData = this.chunksCache.get(chunkKey);
      this.processChunkData(cachedData, chunkX, chunkY);
      this.loadedChunks.add(chunkKey);
      return;
    }

    // Mark chunk as being loaded
    this.loadingChunks.add(chunkKey);
    onLoadingStateChange(true);

    try {
      // Calculate grid coordinates for this chunk
      const startX = chunkX * CHUNK_SIZE;
      const startY = chunkY * CHUNK_SIZE;
      const endX = startX + (MAX_RANGE - 1);
      const endY = startY + (MAX_RANGE - 1);

      const body = {
        init_data:
          "user=%7B%22id%22%3A38071982%2C%22first_name%22%3A%22Amir%22%2C%22last_name%22%3A%22Sepehri%22%2C%22username%22%3A%22Amir_MLTV%22%2C%22language_code%22%3A%22en%22%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2Fyri5s8WHK6TgqPrSuQhvksEGEWW0IXzUpYeE3DWsneU.svg%22%7D&chat_instance=-4294228547133164376&chat_type=private&start_param=ref1104870100&auth_date=1731522327&hash=7b1f9d6d5b5acd242511021703a36e97572ace4a8d9b69f7d19383d9c19702e8",
        map_info: {
          planet_id: 1,
          x_loc_min: startX,
          x_loc_max: endX,
          y_loc_min: startY,
          y_loc_max: endY,
        },
      };

      const response = await axios({
        method: "post",
        url: "https://api.ticktom.com/api/map_range/",
        data: body,
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.data) {
        // Store the chunk data in cache
        this.chunksCache.set(chunkKey, response.data);

        // Process the chunk data
        this.processChunkData(response.data, chunkX, chunkY);
        this.loadedChunks.add(chunkKey);
      }
    } catch (error) {
      console.error("Error loading chunk data:", error);
    } finally {
      this.loadingChunks.delete(chunkKey);
      if (this.loadingChunks.size === 0) {
        onLoadingStateChange(false);
      }
    }
  }

  refetchVisibleChunks(visibleChunks, onLoadingStateChange) {
    // Clear cache and data for visible chunks
    visibleChunks.forEach((chunkKey) => {
      const [chunkX, chunkY] = chunkKey.split(",").map(Number);
      const startX = chunkX * CHUNK_SIZE;
      const startY = chunkY * CHUNK_SIZE;
      const endX = startX + CHUNK_SIZE;
      const endY = startY + CHUNK_SIZE;

      // Remove points in this chunk
      this.points = this.points.filter((point) => {
        const isInChunk =
          point.x >= startX &&
          point.x < endX &&
          point.y >= startY &&
          point.y < endY;
        if (isInChunk) {
          // Also remove from respective data maps
          const key = `${point.x},${point.y}`;
          if (point.type === "user") {
            this.usersData.delete(key);
          } else if (point.type === "lock") {
            this.locksData.delete(key);
          } else if (point.type === "mine") {
            this.minesData.delete(key);
          }
        }
        return !isInChunk;
      });

      // Remove chunk from cache and loaded chunks
      this.chunksCache.delete(chunkKey);
      this.loadedChunks.delete(chunkKey);
    });

    // Reload chunks with fresh data
    visibleChunks.forEach((chunkKey) => {
      const [chunkX, chunkY] = chunkKey.split(",").map(Number);
      this.loadChunkData(chunkX, chunkY, onLoadingStateChange, true);
    });
  }

  handlePointClick(x, y) {
    const key = `${x},${y}`;
    const userData = this.usersData.get(key);
    const lockData = this.locksData.get(key);
    const mineData = this.minesData.get(key);

    if (userData && this.setClickedUserData) {
      this.setClickedUserData(userData);
    } else if (lockData && this.setClickedLockData) {
      this.setClickedLockData(lockData);
    } else if (mineData && this.setClickedMineData) {
      this.setClickedMineData(mineData);
    } else if (this.setClickedEmptyCell) {
      this.setClickedEmptyCell(x, y);
    }
  }

  getVisibleChunks(screenToIso, currentOffset, scale, canvas) {
    // Get the corners of the viewport in grid coordinates
    const topLeft = screenToIso(
      0,
      0,
      currentOffset,
      scale,
      canvas.width,
      canvas.height
    );
    const topRight = screenToIso(
      canvas.width,
      0,
      currentOffset,
      scale,
      canvas.width,
      canvas.height
    );
    const bottomLeft = screenToIso(
      0,
      canvas.height,
      currentOffset,
      scale,
      canvas.width,
      canvas.height
    );
    const bottomRight = screenToIso(
      canvas.width,
      canvas.height,
      currentOffset,
      scale,
      canvas.width,
      canvas.height
    );

    // Find the min and max chunk coordinates that are actually visible
    const minChunkX = Math.floor(
      Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x) / CHUNK_SIZE
    );
    const maxChunkX = Math.floor(
      Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x) / CHUNK_SIZE
    );
    const minChunkY = Math.floor(
      Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) / CHUNK_SIZE
    );
    const maxChunkY = Math.floor(
      Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) / CHUNK_SIZE
    );

    // Add only the chunks that are actually visible and valid (non-negative)
    const visibleChunks = new Set();
    for (let x = Math.max(0, minChunkX); x <= maxChunkX; x++) {
      for (let y = Math.max(0, minChunkY); y <= maxChunkY; y++) {
        visibleChunks.add(this.getChunkKey(x, y));
      }
    }

    return Array.from(visibleChunks);
  }

  clearNonVisibleChunks(visibleChunks) {
    const visibleChunksSet = new Set(visibleChunks);

    // Only clear points for non-visible chunks, keep the cache intact
    this.points = this.points.filter((point) => {
      const pointChunkX = Math.floor(point.x / CHUNK_SIZE);
      const pointChunkY = Math.floor(point.y / CHUNK_SIZE);
      return visibleChunksSet.has(this.getChunkKey(pointChunkX, pointChunkY));
    });

    // Update loadedChunks to match visible chunks
    this.loadedChunks = new Set(visibleChunks);
  }

  getPoints() {
    return this.points;
  }

  getLoadedChunksCount() {
    return this.loadedChunks.size;
  }
}
