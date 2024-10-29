import React, { createContext, useContext, useState } from "react";

const CellContext = createContext();

export function CellProvider({ children }) {
  const [cellData, setCellData] = useState([]);
  const [userData, setUserData] = useState(null);
  const [selectedItem, setSelectedItem] = useState({ type: null, data: null });

  const logCellData = (data) => {
    setCellData((prevData) => [
      ...prevData,
      { ...data, timestamp: new Date().toISOString() },
    ]);
  };

  const setClickedUserData = (data) => {
    setUserData(data);
    setSelectedItem({ type: "user", data });
  };

  const setClickedLockData = (data) => {
    setSelectedItem({ type: "lock", data });
  };

  const setClickedMineData = (data) => {
    setSelectedItem({ type: "mine", data });
  };

  const setClickedEmptyCell = (x, y) => {
    setSelectedItem({
      type: "empty",
      data: { x, y },
    });
  };

  return (
    <CellContext.Provider
      value={{
        cellData,
        logCellData,
        userData,
        setClickedUserData,
        setClickedLockData,
        setClickedMineData,
        setClickedEmptyCell,
        selectedItem,
      }}
    >
      {children}
    </CellContext.Provider>
  );
}

export function useCellData() {
  const context = useContext(CellContext);
  if (!context) {
    throw new Error("useCellData must be used within a CellProvider");
  }
  return context;
}
