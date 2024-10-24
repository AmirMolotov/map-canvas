import React, { useState } from "react";
import { useGesture } from "@use-gesture/react";
import { Isometric, IsometricContainer, IsometricPlane } from "isometric-react";
import emptyImg from "../assets/no-prespective.svg";

const GRID_SIZE = 10;
const INITIAL_ZOOM = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

export const Map = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(INITIAL_ZOOM);

  // Handle both drag and wheel events
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
  const gridRange = 5; // Number of cells in each direction from center

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
          {gridCells.map(({ row, col }) => (
            <Isometric key={`${row}-${col}`}>
              <IsometricPlane
                position={{
                  top: GRID_SIZE * row,
                  left: GRID_SIZE * col,
                }}
                width={GRID_SIZE}
                height={GRID_SIZE}
                color="white"
              >
                <img
                  width="100%"
                  height="100%"
                  src={emptyImg}
                  alt={`Cell ${row}-${col}`}
                  style={{ pointerEvents: "none" }}
                />
              </IsometricPlane>
            </Isometric>
          ))}
        </IsometricContainer>
      </div>
    </div>
  );
};
