import React, { useState, useMemo } from "react";
import { useGesture } from "@use-gesture/react";
import { Isometric, IsometricContainer, IsometricPlane } from "isometric-react";
import emptyImg from "../assets/empty-block.svg";
import blockMine from "../assets/ton-block.png";
import blockLock from "../assets/lock-block.png";
import { generateMockLocations } from "../mockData";

const GRID_SIZE = 10;
const INITIAL_ZOOM = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

// Function to determine which image to use based on type
const getImageByType = (type) => {
  switch (type) {
    case 1:
      return blockMine;
    case 2:
      return blockLock;
    default:
      return emptyImg;
  }
};

// Function to determine cell type based on location data
const getCellType = (row, col, locations) => {
  const location = locations.find(
    (loc) => loc.latitude === row && loc.longitude === col
  );
  if (!location) return "empty";

  switch (location.type) {
    case 1:
      return "mine";
    case 2:
      return "lock";
    default:
      return "empty";
  }
};

// Function to get cell-specific styles
const getCellStyles = (cellType) => {
  switch (cellType) {
    case "mine":
      return {
        transform:
          "rotateZ(-45deg) rotateY(0deg) rotateX(0deg) translate(24px, -44px) scale(1.25)",
        height: "232px",
        filter: "brightness(1.2)",
      };
    case "lock":
      return {
        transform:
          "rotateZ(-45deg) rotateY(0deg) rotateX(0deg) translate(8px, -7px) scale(1.15)",
        height: "180px",
        filter: "brightness(0.9)",
      };
    default:
      return {
        width: "100%",
        height: "100%",
      };
  }
};

export const Map = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(INITIAL_ZOOM);

  // Generate mock locations once using useMemo with narrower boundaries
  const mockLocations = useMemo(() => {
    return generateMockLocations(-1, 1, -1, 1);
  }, []);

  const bind = useGesture({
    onDrag: ({ movement: [mx, my], first, memo }) => {
      if (first) return [position.x, position.y];
      setPosition({
        x: memo[0] + mx,
        y: memo[1] + my,
      });
      return memo;
    },
    onWheel: ({ delta: [, dy] }) => {
      setZoom((current) => {
        const newZoom = current - dy * 0.005;
        return Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM);
      });
    },
  });

  // Generate grid cells with smaller range
  const gridCells = [];
  const gridRange = 2;

  for (let row = -gridRange; row <= gridRange; row++) {
    for (let col = -gridRange; col <= gridRange; col++) {
      gridCells.push({ row, col });
    }
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        background: "black",
        cursor: "grab",
      }}
      {...bind()}
    >
      <div
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          transition: "transform 0.05s ease",
          width: "100%",
          height: "100%",
          position: "relative",
        }}
      >
        <IsometricContainer>
          {gridCells.map(({ row, col }) => {
            const cellType = getCellType(row, col, mockLocations);
            const location = mockLocations.find(
              (loc) => loc.latitude === row && loc.longitude === col
            );
            return (
              <Isometric key={`${row}-${col}`}>
                <IsometricPlane
                  position={{
                    top: GRID_SIZE * row,
                    left: GRID_SIZE * col,
                  }}
                  width={GRID_SIZE}
                  height={GRID_SIZE}
                  color="#231f20"
                >
                  <img
                    width="100%"
                    height="100%"
                    src={location ? getImageByType(location.type) : emptyImg}
                    alt={`Cell ${row}-${col}`}
                    style={{
                      pointerEvents: "none",
                      ...getCellStyles(cellType),
                    }}
                  />
                </IsometricPlane>
              </Isometric>
            );
          })}
        </IsometricContainer>
      </div>
    </div>
  );
};
