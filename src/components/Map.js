import React, { useState, useEffect, useRef } from "react";
import { MapContainer, Tooltip, useMap, ImageOverlay } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { generateMockLocations } from "../mockData";
import blockLock from "../assets/block-lock.svg";
import blockMine from "../assets/block-mine.png";
import emptyImg from "../assets/empty.png";

const baseCellWidth = 400; // Smaller base width
const baseCellHeight = 400; // Smaller base height
const CELL_GAP = 0.01; // Almost no gap between cells
const CENTER_ROW = 5;
const CENTER_COL = 5;
const MIN_GRID_DISTANCE = 2;

// All cells are the same size now
const getCellSizeMultiplier = () => 1.0;

const getImageSource = (type) => {
  switch (type) {
    case 1: // Red
      return blockLock;
    case 3: // Blue
      return blockMine;
    default:
      return emptyImg;
  }
};

// Convert map coordinates to grid indices
const mapCoordsToGridIndices = (map, latLng) => {
  try {
    const point = map.project(latLng, 9);
    return {
      row: Math.floor(point.y / baseCellHeight),
      col: Math.floor(point.x / baseCellWidth),
    };
  } catch (error) {
    console.error("Error converting coordinates:", error);
    return { row: 0, col: 0 };
  }
};

// Convert grid indices to map coordinates with size multiplier
const gridIndicesToMapCoords = (map, row, col, multiplier = 1) => {
  try {
    const pixelX = col * baseCellWidth;
    const pixelY = row * baseCellHeight;
    return map.unproject([pixelX, pixelY], 9);
  } catch (error) {
    console.error("Error converting grid indices:", error);
    return map.getCenter();
  }
};

// Calculate grid distance between two points
const calculateGridDistance = (point1, point2) => {
  try {
    const rowDistance = Math.abs(point1.row - point2.row);
    const colDistance = Math.abs(point1.col - point2.col);
    return Math.max(rowDistance, colDistance);
  } catch (error) {
    console.error("Error calculating grid distance:", error);
    return Infinity;
  }
};

// Check if two points are significantly different
const isSignificantMove = (point1, point2) => {
  if (!point1 || !point2) return true;

  try {
    const dx = point1.lat - point2.lat;
    const dy = point1.lng - point2.lng;
    return (
      Math.sqrt(dx * dx + dy * dy) >
      Math.min(baseCellWidth, baseCellHeight) / 256
    );
  } catch (error) {
    console.error("Error checking movement:", error);
    return true;
  }
};

function GridCell({ row, col, image = emptyImg }) {
  const map = useMap();
  const sizeMultiplier = 1.0;

  // Calculate base coordinates
  const baseCoords = gridIndicesToMapCoords(map, row, col);
  const nextCellCoords = gridIndicesToMapCoords(map, row + 1, col + 1);

  // Calculate cell dimensions in lat/lng units
  const cellLatSize = Math.abs(nextCellCoords.lat - baseCoords.lat);
  const cellLngSize = Math.abs(nextCellCoords.lng - baseCoords.lng);

  // Calculate adjusted size with gap
  const adjustedLatSize = cellLatSize * sizeMultiplier * (1 - CELL_GAP);
  const adjustedLngSize = cellLngSize * sizeMultiplier * (1 - CELL_GAP);

  // Calculate center point
  const centerLat = baseCoords.lat + cellLatSize / 2;
  const centerLng = baseCoords.lng + cellLngSize / 2;

  // Calculate bounds for the image
  const bounds = [
    [centerLat - adjustedLatSize / 2, centerLng - adjustedLngSize / 2],
    [centerLat + adjustedLatSize / 2, centerLng + adjustedLngSize / 2],
  ];

  return <ImageOverlay bounds={bounds} url={image} opacity={1} />;
}

function BoundsHandler({ onBoundsChange }) {
  const map = useMap();
  const lastProcessedCenter = useRef(null);

  useEffect(() => {
    const handleDrag = () => {
      try {
        const center = map.getCenter();

        if (isSignificantMove(center, lastProcessedCenter.current)) {
          const bounds = map.getBounds();
          const southWest = mapCoordsToGridIndices(map, bounds.getSouthWest());
          const northEast = mapCoordsToGridIndices(map, bounds.getNorthEast());

          const currentBounds = {
            minRow: southWest.row,
            maxRow: northEast.row,
            minCol: southWest.col,
            maxCol: northEast.col,
            centerRow: Math.floor((southWest.row + northEast.row) / 2),
            centerCol: Math.floor((southWest.col + northEast.col) / 2),
          };

          onBoundsChange(currentBounds);
          lastProcessedCenter.current = center;
        }
      } catch (error) {
        console.error("Error handling drag:", error);
      }
    };

    map.on("drag", handleDrag);
    map.on("dragend", handleDrag);
    handleDrag();

    return () => {
      map.off("drag", handleDrag);
      map.off("dragend", handleDrag);
    };
  }, [map, onBoundsChange]);

  return null;
}

export const Map = () => {
  const [items, setItems] = useState([]);
  const [bounds, setBounds] = useState(null);

  const handleBoundsChange = (currentBounds) => {
    try {
      setBounds(currentBounds);
      const currentCenter = {
        row: currentBounds.centerRow,
        col: currentBounds.centerCol,
      };

      const minDistance =
        items.length > 0
          ? Math.min(
              ...items.map((item) =>
                calculateGridDistance(currentCenter, {
                  row: item.latitude,
                  col: item.longitude,
                })
              )
            )
          : Infinity;

      if (minDistance >= MIN_GRID_DISTANCE) {
        console.log("Generating new items for bounds:", currentBounds);

        const newItems = generateMockLocations(
          currentBounds.minRow,
          currentBounds.maxRow,
          currentBounds.minCol,
          currentBounds.maxCol
        );

        setItems((prevItems) => {
          const existingPositions = new Set(
            prevItems.map((item) => `${item.latitude},${item.longitude}`)
          );
          const uniqueNewItems = newItems.filter(
            (item) =>
              !existingPositions.has(`${item.latitude},${item.longitude}`)
          );
          return [...prevItems, ...uniqueNewItems];
        });
      }
    } catch (error) {
      console.error("Error handling bounds change:", error);
    }
  };

  // Generate grid cells for the current bounds
  const gridCells = bounds
    ? Array.from({ length: bounds.maxRow - bounds.minRow + 1 }, (_, rowIndex) =>
        Array.from(
          { length: bounds.maxCol - bounds.minCol + 1 },
          (_, colIndex) => ({
            row: bounds.minRow + rowIndex,
            col: bounds.minCol + colIndex,
          })
        )
      ).flat()
    : [];

  return (
    <MapContainer
      center={[0, 0]}
      zoom={9}
      crs={L.CRS.Simple}
      minZoom={9}
      maxZoom={10}
      scrollWheelZoom={true}
      style={{ height: "100vh", width: "100%", background: "black" }}
      whenCreated={(map) => {
        console.log("Map created");
        try {
          const centerCoords = gridIndicesToMapCoords(
            map,
            CENTER_ROW + 0.5,
            CENTER_COL + 0.5
          );
          map.setView(centerCoords, 9);
        } catch (error) {
          console.error("Error setting initial view:", error);
        }
      }}
    >
      <BoundsHandler onBoundsChange={handleBoundsChange} />
      {/* Render empty.png for all grid cells */}
      {gridCells.map(({ row, col }) => (
        <GridCell key={`grid-${row}-${col}`} row={row} col={col} />
      ))}
      {/* Render special cells (red/blue) on top */}
      {items.map((item, index) => (
        <GridCell
          key={`item-${item.latitude},${item.longitude}-${index}`}
          row={item.latitude}
          col={item.longitude}
          image={getImageSource(item.type)}
        />
      ))}
    </MapContainer>
  );
};
