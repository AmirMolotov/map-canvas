import React from "react";
import { useCellData } from "../../context/CellContext";
import "./MapModal.css";

const MapModal = ({ isOpen, onClose }) => {
  const { selectedItem } = useCellData();

  if (!isOpen) return null;

  const renderContent = () => {
    if (!selectedItem.data) return <p>No data available</p>;
    console.log(selectedItem);

    switch (selectedItem.type) {
      case "user":
        return (
          <div className="user-info">
            <p>
              <strong>ID:</strong> {selectedItem.data.id}
            </p>
            <p>
              <strong>Name:</strong> {selectedItem.data.first_name}
            </p>
            <p>
              <strong>Location:</strong> ({selectedItem.data.x_location},{" "}
              {selectedItem.data.y_location})
            </p>
            <p>
              <strong>Last Offline:</strong>{" "}
              {new Date(selectedItem.data.last_offline).toLocaleString()}
            </p>
            <p>
              <strong>Protected Until:</strong>{" "}
              {new Date(selectedItem.data.protected_time).toLocaleString()}
            </p>
          </div>
        );
      case "empty":
      case "lock":
      case "mine":
        return (
          <div className="item-info">
            <p>
              <strong>Type:</strong>{" "}
              {selectedItem.type.charAt(0).toUpperCase() +
                selectedItem.type.slice(1)}
            </p>
            <p>
              <strong>ID:</strong> {selectedItem.data.id}
            </p>
            <p>
              <strong>Location:</strong> ({selectedItem.data.x},{" "}
              {selectedItem.data.y})
            </p>
          </div>
        );
      default:
        return <p>Unknown item type</p>;
    }
  };

  const getModalTitle = () => {
    switch (selectedItem.type) {
      case "user":
        return "User Information";
      case "lock":
        return "Lock Information";
      case "mine":
        return "Mine Information";
      default:
        return "Information";
    }
  };

  return (
    <div className="map-modal-overlay" onClick={onClose}>
      <div className="map-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="map-modal-header">
          <h2>{getModalTitle()}</h2>
          <button className="close-button" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="map-modal-body">{renderContent()}</div>
      </div>
    </div>
  );
};

export default MapModal;
