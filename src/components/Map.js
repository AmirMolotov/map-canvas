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

const NavigationButton = ({ onClick, style, children }) => (
  <button
    onClick={onClick}
    style={{
      position: "absolute",
      padding: "10px 20px",
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      border: "2px solid rgba(255, 255, 255, 0.4)",
      color: "white",
      cursor: "pointer",
      zIndex: 1000,
      borderRadius: "5px",
      ...style,
    }}
  >
    {children}
  </button>
);

export const Map = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [boundaries, setBoundaries] = useState({
    minRow: -1,
    maxRow: 2,
    minCol: -1,
    maxCol: 2,
  });
  const [allLocations, setAllLocations] = useState(() =>
    generateMockLocations(-1, 2, -1, 2)
  );

  // Memoize grid cells generation based on current boundaries
  const gridCells = useMemo(() => {
    const cells = [];
    for (let row = boundaries.minRow; row <= boundaries.maxRow; row++) {
      for (let col = boundaries.minCol; col <= boundaries.maxCol; col++) {
        cells.push({ row, col });
      }
    }
    return cells;
  }, [boundaries]);

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

  const expandGrid = (direction) => {
    let newBoundaries = { ...boundaries };
    let newLocations;

    switch (direction) {
      case "up":
        newBoundaries.minRow -= 3;
        newLocations = generateMockLocations(
          newBoundaries.minRow,
          newBoundaries.minRow + 2,
          boundaries.minCol,
          boundaries.maxCol
        );
        setPosition((prev) => ({ ...prev, y: prev.y + 300 }));
        break;
      case "down":
        newBoundaries.maxRow += 3;
        newLocations = generateMockLocations(
          newBoundaries.maxRow - 2,
          newBoundaries.maxRow,
          boundaries.minCol,
          boundaries.maxCol
        );
        setPosition((prev) => ({ ...prev, y: prev.y - 300 }));
        break;
      case "left":
        newBoundaries.minCol -= 3;
        newLocations = generateMockLocations(
          boundaries.minRow,
          boundaries.maxRow,
          newBoundaries.minCol,
          newBoundaries.minCol + 2
        );
        setPosition((prev) => ({ ...prev, x: prev.x + 300 }));
        break;
      case "right":
        newBoundaries.maxCol += 3;
        newLocations = generateMockLocations(
          boundaries.minRow,
          boundaries.maxRow,
          newBoundaries.maxCol - 2,
          newBoundaries.maxCol
        );
        setPosition((prev) => ({ ...prev, x: prev.x - 300 }));
        break;
    }

    setBoundaries(newBoundaries);
    setAllLocations((prev) => [...prev, ...newLocations]);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "black",
        cursor: "grab",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
      {...bind()}
    >
      <NavigationButton
        onClick={() => expandGrid("up")}
        style={{ top: "20px", left: "50%", transform: "translateX(-50%)" }}
      >
        ↑
      </NavigationButton>
      <NavigationButton
        onClick={() => expandGrid("down")}
        style={{ bottom: "20px", left: "50%", transform: "translateX(-50%)" }}
      >
        ↓
      </NavigationButton>
      <NavigationButton
        onClick={() => expandGrid("left")}
        style={{ left: "20px", top: "50%", transform: "translateY(-50%)" }}
      >
        ←
      </NavigationButton>
      <NavigationButton
        onClick={() => expandGrid("right")}
        style={{ right: "20px", top: "50%", transform: "translateY(-50%)" }}
      >
        →
      </NavigationButton>
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
            const cellType = getCellType(row, col, allLocations);
            const location = allLocations.find(
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
