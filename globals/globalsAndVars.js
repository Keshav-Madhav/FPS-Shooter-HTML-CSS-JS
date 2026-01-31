/**
 * Global variables for the raycaster engine
 * Note: Configuration values have been moved to config/GameConfig.js
 * Only runtime globals that need to be shared between non-module scripts are kept here.
 */

// Minimap settings (runtime state, modified by script.js, used by utils.js)
// Default values from MinimapConfig
var miniMapSettings = {
  x: 90,
  y: 90,
  scale: 0.35,
  radius: 220,
  rotateWithPlayer: true
};
