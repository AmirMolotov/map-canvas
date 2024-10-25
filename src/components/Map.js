import React, { useState } from "react";
import { useGesture } from "@use-gesture/react";
import { Isometric, IsometricContainer, IsometricPlane } from "isometric-react";
import emptyImg from "../assets/empty-block.svg";
import blockMine from "../assets/ton-block.png";
import blockLock from "../assets/lock-block.png";

const GRID_SIZE = 10;
const INITIAL_ZOOM = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

// Function to determine which image to use for a cell
const getCellImage = (row, col) => {
  // Special positions for 3D models
  if (row === 0 && col === 0) return blockMine;
  if (row === 2 && col === 2) return blockLock;
  return emptyImg;
};

// Function to determine cell type
const getCellType = (row, col) => {
  if (row === 0 && col === 0) return "mine";
  if (row === 2 && col === 2) return "lock";
  return "empty";
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

  // Generate grid cells
  const gridCells = [];
  const gridRange = 5;

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
            const cellType = getCellType(row, col);
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
                    src={getCellImage(row, col)}
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
