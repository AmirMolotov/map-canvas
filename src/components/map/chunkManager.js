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
  }

  getChunkKey(chunkX, chunkY) {
    return `${chunkX},${chunkY}`;
  }

  async loadChunkData(chunkX, chunkY, onLoadingStateChange) {
    const chunkKey = this.getChunkKey(chunkX, chunkY);

    // Skip if chunk already loaded or is currently loading
    if (this.loadedChunks.has(chunkKey) || this.loadingChunks.has(chunkKey)) {
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
          "query_id=AAEjkvwGAAAAACOS_AYyDS2l&user=%7B%22id%22%3A117215779%2C%22first_name%22%3A%22Ali%22%2C%22last_name%22%3A%22Manouchehri%22%2C%22username%22%3A%22manouchehri1990%22%2C%22language_code%22%3A%22en%22%2C%22allows_write_to_pm%22%3Atrue%7D&auth_date=1729849891&hash=b2690a8b4b2233b20656f544d9384ed2c4daf9e2f68666d74425b09df23abde2",
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
        url: "https://m0vj9xw1-8000.euw.devtunnels.ms/api/map_range/",
        data: body,
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.data) {
        const processedPoints = [];

        if (response.data[1]?.users) {
          response.data[1].users.forEach((user) => {
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

        if (response.data[2]?.mines) {
          response.data[2].mines.forEach((mine) => {
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

        if (response.data[3]?.locks) {
          response.data[3].locks.forEach((lock) => {
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

        this.points = [...this.points, ...processedPoints];
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
    const visibleChunks = new Set();

    // Calculate the number of cells that fit in the viewport at current zoom level
    const tileWidth = 30 * scale;
    const tileHeight = 15 * scale;

    // Calculate how many cells fit in the viewport
    const viewportCellsX = Math.ceil(canvas.width / tileWidth) * 2;
    const viewportCellsY = Math.ceil(canvas.height / tileHeight) * 2;

    // Get the center point of the viewport in grid coordinates
    const centerPoint = screenToIso(
      canvas.width / 2,
      canvas.height / 2,
      currentOffset,
      scale,
      canvas.width,
      canvas.height
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
        visibleChunks.add(this.getChunkKey(x, y));
      }
    }

    return Array.from(visibleChunks);
  }

  clearNonVisibleChunks(visibleChunks) {
    const visibleChunksSet = new Set(visibleChunks);

    // Clear points for chunks that are no longer visible
    this.points = this.points.filter((point) => {
      const pointChunkX = Math.floor(point.x / CHUNK_SIZE);
      const pointChunkY = Math.floor(point.y / CHUNK_SIZE);
      const isVisible = visibleChunksSet.has(
        this.getChunkKey(pointChunkX, pointChunkY)
      );

      // Clear data if point is not visible
      if (!isVisible) {
        const key = `${point.x},${point.y}`;
        if (point.type === "user") {
          this.usersData.delete(key);
        } else if (point.type === "lock") {
          this.locksData.delete(key);
        } else if (point.type === "mine") {
          this.minesData.delete(key);
        }
      }

      return isVisible;
    });

    // Clear loaded chunks that are no longer visible
    this.loadedChunks = new Set(
      Array.from(this.loadedChunks).filter((chunkKey) =>
        visibleChunksSet.has(chunkKey)
      )
    );
  }

  getPoints() {
    return this.points;
  }

  getLoadedChunksCount() {
    return this.loadedChunks.size;
  }
}
