import React from "react";
import "./App.css";
import MapCanvas from "./components/map/MapCanvas";
import { CellProvider } from "./context/CellContext";

function App() {
  return (
    <CellProvider>
      <div className="App">
        <MapCanvas />
      </div>
    </CellProvider>
  );
}

export default App;
