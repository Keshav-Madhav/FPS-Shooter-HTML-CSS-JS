
// Define scaling factors to adjust wall heights and brightness separately
const heightScaleFactor = 100;
const brightnessScaleFactor = 100;
const smoothingRadius = 3; // Number of slices to take on each side for averaging
const darknessExponent = 2.0; // Increased for faster darkness falloff

// Variables to store the previous mouse position
let prevMouseX = 0;

// Variables to store the minimap settings
var miniMapSettings = {
  x: 110,
  y: 110,
  scale: 0.25,
  radius: 350
}

// Sensitivity factor for rotation speed
const sensitivity = 0.2;
let prevTime = performance.now(); // Track the previous time