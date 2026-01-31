/**
 * Central game configuration file
 * All configurable game values are centralized here for easy tuning
 */

// ===========================================
// RENDERING CONFIGURATION
// ===========================================
export const RenderConfig = {
  heightScaleFactor: 100,
  brightnessScaleFactor: 100,
  smoothingRadius: 3,
  darknessExponent: 2.0,
  maxRenderDistance: 2000,
  parallaxStrength: 0.5,
  pixelsPerWorldUnit: 4
};

// ===========================================
// MINIMAP CONFIGURATION
// ===========================================
export const MinimapConfig = {
  default: {
    x: 110,
    y: 110,
    scale: 0.25,
    radius: 350,
    rotateWithPlayer: true
  }
};

// ===========================================
// FOG OF WAR CONFIGURATION
// ===========================================
export const FogOfWarConfig = {
  // Whether fog of war is enabled (only applies to maze maps)
  enabled: true,
  
  // Size of each exploration cell in world units (smaller = tighter fog, 5-15 recommended)
  cellSize: 5,
  
  // Maximum reveal distance in world units
  revealDistance: 350,
  
  // Number of rays to cast within FOV (reduced for performance with small cells)
  rayCount: 90,
  
  // Default map dimensions (overridden per-map)
  defaultMapWidth: 3000,
  defaultMapHeight: 3000
};

// ===========================================
// PLAYER CONFIGURATION
// ===========================================
export const PlayerConfig = {
  // Collision
  radius: 12,
  collisionMargin: 0.5,

  // Vertical movement
  baseEyeHeight: 0,
  crouchEyeHeight: -0.25,
  jumpStrength: 0.03,
  gravity: 0.00085,
  maxEyeHeight: 1.5,
  uncrouchSpeed: 0.08,

  // Speed multipliers
  baseMoveSpeed: 1,
  crouchSpeedMultiplier: 0.45,
  sprintSpeedMultiplier: 3,
  jumpSpeedMultiplier: 1.4,

  // FOV settings
  baseFov: 80,
  slowFov: 83,
  fastFov: 77,
  fovLerpSpeed: 0.15
};

// ===========================================
// DETECTION SYSTEM CONFIGURATION
// ===========================================
export const DetectionConfig = {
  // Timer settings
  timerMax: 3.0,
  drainRate: 1.0,        // Per second when detected
  regenRate: 0.1,        // Per second when not detected
  regenDelay: 1.0,       // Seconds before regen starts

  // Path reveal settings
  pathDisplayDuration: 5000, // Milliseconds
  criticalAlertThreshold: 0.75,

  // Detection modifiers
  crouchMultiplier: 0.75,
  jumpMultiplier: 1.2,
  sprintRangeMultiplier: 1.2,
  sprintFovMultiplier: 1.3,
  proximityDistanceMultiplier: 0.15
};

// ===========================================
// ENEMY CONFIGURATION
// ===========================================
export const EnemyConfig = {
  defaultFov: 60,
  defaultRayCount: 200,
  defaultVisibilityDistance: 300,

  // Visibility falloff zones
  fullDistanceThreshold: 0.2,
  transitionEnd: 0.4,
  minMultiplier: 0.4
};

// ===========================================
// INPUT CONFIGURATION
// ===========================================
export const InputConfig = {
  mouseSensitivity: 0.2,
  
  // Key bindings
  keys: {
    forward: ['ArrowUp', 'w', 'W'],
    backward: ['ArrowDown', 's', 'S'],
    strafeLeft: ['ArrowLeft', 'a', 'A'],
    strafeRight: ['ArrowRight', 'd', 'D'],
    sprint: ['Shift'],
    jump: [' '],
    crouch: ['Control', 'c', 'C'],
    reset: ['r', 'R'],
    noclip: ['n', 'N'],
    pathReveal: ['p', 'P'],
    mapSelector: ['m', 'M', 'Tab']
  }
};

// ===========================================
// UI CONFIGURATION
// ===========================================
export const UIConfig = {
  // Detection alert
  alert: {
    fadeSpeed: 0.15,
    pulseSpeed: 0.008
  },

  // Timer bar
  timerBar: {
    width: 200,
    height: 20,
    greenThreshold: 0.6,
    yellowThreshold: 0.3
  },

  // Map selector
  mapSelector: {
    overlayOpacity: 0.85,
    itemHeight: 0.1  // As fraction of canvas height
  },

  // Instructions panel
  instructionsPanel: {
    width: 0.5,    // As fraction of canvas width
    height: 0.4,   // As fraction of canvas height
    pulseSpeed: 0.003
  }
};

// ===========================================
// GAME LOOP CONFIGURATION
// ===========================================
export const GameLoopConfig = {
  uncappedFps: false,
  targetFps: 120  // For delta time normalization
};

// ===========================================
// BACKGROUND CONFIGURATION
// ===========================================
export const BackgroundConfig = {
  parallaxStrength: 0.1,
  sky: {
    startLuminosity: 55,
    endLuminosity: 20,
    hue: 210,
    saturation: 20
  },
  floor: {
    startLuminosity: 40,
    endLuminosity: 10,
    hue: 0,
    saturation: 0
  }
};

// ===========================================
// MAP CONFIGURATION
// ===========================================
export const MapConfig = {
  // Default map settings
  defaults: {
    width: 1920,
    height: 1080,
    spawnDirection: 90  // Degrees, facing right
  }
};

// ===========================================
// ZONE CONFIGURATION
// ===========================================
export const ZoneConfig = {
  // Start zone appearance
  start: {
    color: 'rgba(0, 200, 255, 0.3)',
    borderColor: 'rgba(0, 200, 255, 0.8)',
    pulseSpeed: 0.003,
    pulseIntensity: 0.2
  },
  // Goal zone appearance
  goal: {
    color: 'rgba(0, 255, 100, 0.3)',
    borderColor: 'rgba(0, 255, 100, 0.8)',
    pulseSpeed: 0.004,
    pulseIntensity: 0.25
  },
  // Default zone radius
  defaultRadius: 40
};

// ===========================================
// MAZE GENERATION CONFIGURATION
// ===========================================
export const MazeConfig = {
  defaults: {
    cols: 28,
    rows: 28,
    cellSize: 100,
    wallThickness: 18,
    curveChance: 1.0,
    loopChance: 0.1,
    roomCount: 3,
    roomMinSize: 2,
    roomMaxSize: 5,
    enemyCount: 20
  }
};
