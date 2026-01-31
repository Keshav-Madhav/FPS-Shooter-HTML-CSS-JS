/**
 * Global configuration variables for the raycaster engine
 */

// Rendering scale factors
const heightScaleFactor = 100;
const brightnessScaleFactor = 100;
const smoothingRadius = 3;
const darknessExponent = 2.0;

// Maximum render distance (walls beyond this are culled)
const maxRenderDistance = 2000;

// Minimap configuration
var miniMapSettings = {
  x: 90,
  y: 90,
  scale: 0.35,
  radius: 220,
  rotateWithPlayer: true  // When true, map rotates so player always faces north (up)
};

// Mouse sensitivity for rotation
const sensitivity = 0.2;

// Frame timing
let prevTime = performance.now();
