import React from "react";
import "./MapModal.css";

const MapModal = ({ isOpen, onClose, onStyleSelect }) => {
  if (!isOpen) return null;

  const mapStyles = [
    { id: "satellite", name: "Satellite View" },
    { id: "terrain", name: "Terrain View" },
    { id: "standard", name: "Standard View" },
  ];

  return (
    <div className="map-modal-overlay" onClick={onClose}>
      <div className="map-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="map-modal-header">
          <h2>Select Map Style</h2>
          <button className="close-button" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="map-modal-body">
          {mapStyles.map((style) => (
            <button
              key={style.id}
              className="style-button"
              onClick={() => {
                console.log(isOpen);
                if (!isOpen) return;
                onStyleSelect(style.id);
                onClose();
              }}
            >
              {style.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MapModal;
