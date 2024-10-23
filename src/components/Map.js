import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Rectangle,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { generateMockLocations } from "../mockData";

const cellSize = 100; // Size of each cell in pixels at zoom level 9
const CENTER_ROW = 5;
const CENTER_COL = 5;
const MIN_GRID_DISTANCE = 2;

const getMarkerColor = (type) => {
  const markerColors = {
    1: "#ff0000",
    2: "#00ff00",
    3: "#0000ff",
  };
  return markerColors[type] || "#000000";
};

const createGridPattern = (zoom) => {
  const size = zoom === 10 ? cellSize * 2 : cellSize;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("width", "100%");
  rect.setAttribute("height", "100%");
  rect.setAttribute("fill", "none");
  rect.setAttribute("stroke", "black");
  rect.setAttribute("stroke-width", "1");

  svg.appendChild(rect);

  return `data:image/svg+xml;base64,${btoa(
    new XMLSerializer().serializeToString(svg)
  )}`;
};

// Convert map coordinates to grid indices
const mapCoordsToGridIndices = (map, latLng) => {
  try {
    const point = map.project(latLng, 9);
    return {
      row: Math.floor(point.y / cellSize),
      col: Math.floor(point.x / cellSize),
    };
  } catch (error) {
    console.error("Error converting coordinates:", error);
    return { row: 0, col: 0 };
  }
};

// Convert grid indices to map coordinates
const gridIndicesToMapCoords = (map, row, col) => {
  try {
    const pixelX = col * cellSize;
    const pixelY = row * cellSize;
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
    return Math.max(rowDistance, colDistance); // Using max for more conservative distance
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
    return Math.sqrt(dx * dx + dy * dy) > cellSize / 256;
  } catch (error) {
    console.error("Error checking movement:", error);
    return true;
  }
};

function BoundsHandler({ onBoundsChange }) {
  const map = useMap();
  const lastProcessedCenter = useRef(null);

  useEffect(() => {
    const handleDrag = () => {
      try {
        const center = map.getCenter();

        // Only process if we've moved significantly
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
    // Process initial bounds
    handleDrag();

    return () => {
      map.off("drag", handleDrag);
      map.off("dragend", handleDrag);
    };
  }, [map, onBoundsChange]);

  return null;
}

function GridLayer() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const updateZoom = () => {
      setZoom(map.getZoom());
    };
    map.on("zoomend", updateZoom);
    return () => {
      map.off("zoomend", updateZoom);
    };
  }, [map]);

  return (
    <TileLayer
      url={createGridPattern(zoom)}
      tileSize={zoom === 10 ? cellSize * 2 : cellSize}
    />
  );
}

function SquareMarker({ item }) {
  const map = useMap();
  const sw = gridIndicesToMapCoords(map, item.latitude, item.longitude);
  const ne = gridIndicesToMapCoords(map, item.latitude + 1, item.longitude + 1);
  const bounds = [sw, ne];

  return (
    <Rectangle
      bounds={bounds}
      pathOptions={{
        color: getMarkerColor(item.type),
        weight: 2,
        fillOpacity: 0.5,
      }}
    >
      <Tooltip permanent>
        Cell: ({item.latitude}, {item.longitude})
        <br />
        Type: {item.type}
      </Tooltip>
    </Rectangle>
  );
}

export const Map = () => {
  const [items, setItems] = useState([]);

  const handleBoundsChange = (currentBounds) => {
    try {
      const currentCenter = {
        row: currentBounds.centerRow,
        col: currentBounds.centerCol,
      };

      // Check distance from center to all existing items
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

      // If we're far enough from all existing items or there are no items
      if (minDistance >= MIN_GRID_DISTANCE) {
        console.log("Generating new items for bounds:", currentBounds);

        // Generate new items
        const newItems = generateMockLocations(
          currentBounds.minRow,
          currentBounds.maxRow,
          currentBounds.minCol,
          currentBounds.maxCol
        );

        // Add new items, avoiding duplicates
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

  return (
    <MapContainer
      center={[0, 0]}
      zoom={9}
      crs={L.CRS.Simple}
      minZoom={9}
      maxZoom={10}
      scrollWheelZoom={true}
      style={{ height: "100vh", width: "100%" }}
      whenCreated={(map) => {
        console.log("Map created");
        try {
          // Set initial center to grid position (5,5)
          const centerCoords = gridIndicesToMapCoords(
            map,
            CENTER_ROW + 0.5, // Center of the cell
            CENTER_COL + 0.5
          );
          map.setView(centerCoords, 9);
        } catch (error) {
          console.error("Error setting initial view:", error);
        }
      }}
    >
      <BoundsHandler onBoundsChange={handleBoundsChange} />
      <GridLayer />
      {items.map((item, index) => (
        <SquareMarker
          key={`${item.latitude},${item.longitude}-${index}`}
          item={item}
        />
      ))}
    </MapContainer>
  );
};
