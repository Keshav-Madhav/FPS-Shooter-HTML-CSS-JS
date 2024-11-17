
// Define scaling factors to adjust wall heights and brightness separately
const heightScaleFactor = 100;
const brightnessScaleFactor = 100;
const smoothingRadius = 3; // Number of slices to take on each side for averaging
const darknessExponent = 2.0; // Increased for faster darkness falloff

// Variables to store the previous mouse position
let prevMouseX = 0;

// Minimap (optional)
const minimapSize = 150;
const minimapScale = minimapSize / Math.max(main_canvas.width, main_canvas.height);

// Calculate the position for the bottom left corner of the main_canvas
const minimapX = 20;
const minimapY = main_canvas.height - minimapSize + 40;

// Sensitivity factor for rotation speed
const sensitivity = 0.3;
let prevTime = performance.now(); // Track the previous time

// Load textures
const textureImageWall = new Image();
textureImageWall.src = './images/wall_texture_1.jpg';
const textureImageEdge = new Image();
textureImageEdge.src = './images/wall_texture_2.png';