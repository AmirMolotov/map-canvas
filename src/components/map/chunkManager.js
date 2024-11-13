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

    // Calculate the width and height of the viewport in grid coordinates
    const viewportWidth = Math.abs(topRight.x - topLeft.x);
    const viewportHeight = Math.abs(bottomLeft.y - topLeft.y);

    // Calculate the number of chunks needed to cover the viewport
    const chunksX = Math.ceil(viewportWidth / CHUNK_SIZE) + 2; // Add 2 for padding
    const chunksY = Math.ceil(viewportHeight / CHUNK_SIZE) + 2; // Add 2 for padding

    // Calculate the center chunk
    const centerChunkX = Math.floor((topLeft.x + topRight.x) / 2 / CHUNK_SIZE);
    const centerChunkY = Math.floor(
      (topLeft.y + bottomLeft.y) / 2 / CHUNK_SIZE
    );

    // Add visible chunks
    const visibleChunks = new Set();
    for (
      let x = centerChunkX - Math.floor(chunksX / 2);
      x <= centerChunkX + Math.floor(chunksX / 2);
      x++
    ) {
      for (
        let y = centerChunkY - Math.floor(chunksY / 2);
        y <= centerChunkY + Math.floor(chunksY / 2);
        y++
      ) {
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
