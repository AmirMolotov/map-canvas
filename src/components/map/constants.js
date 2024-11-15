// Grid constants
export const CHUNK_SIZE = 20; // Maximum range for a chunk
export const MAX_RANGE = 20; // Maximum allowed range for API requests

// Desktop zoom levels
export const ALLOWED_ZOOM_LEVELS = [0.8, 0.6, 0.4];
export const INITIAL_SCALE = 0.6;

// Mobile zoom levels (twice the desktop values)
export const MOBILE_ZOOM_LEVELS = [1.6, 1.2, 0.8];
export const MOBILE_INITIAL_SCALE = 1.6;
export const MOBILE_PAN_SPEED_MULTIPLIER = 2.5; // Makes panning faster on mobile

// Initial state
export const INITIAL_OFFSET = { x: 0, y: 0 };
