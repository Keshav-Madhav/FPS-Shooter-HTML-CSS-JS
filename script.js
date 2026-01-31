/**
 * Main Game Script - Refactored for better separation of concerns
 * 
 * This file serves as the entry point and orchestrator for the game.
 * Logic is delegated to specialized modules for better maintainability.
 */

// Core game components
import { GameLoop, GameStateManager, InputHandler, RaycastManager } from './core/index.js';

// Configuration
import { MinimapConfig, DetectionConfig, ControlsConfig, FogOfWarConfig } from './config/index.js';

// UI Components
import { 
  DetectionAlert, 
  ProgressBar, 
  GameOverScreen,
  WinScreen,
  InstructionsPanel,
  MapSelector,
  SettingsMenu
} from './ui/index.js';

// Game classes
import Boundaries from './classes/BoundariesClass.js';
import GameMap from './classes/GameMapClass.js';
import Textures from './classes/TexturesClass.js';
import Player from './classes/UserClass.js';
import EnemyClass from './classes/EnemyClass.js';

// Map creators
import { createTestMap } from './maps/testMap.js';
import { createMazeMap, findMazePath } from './maps/mazeMap.js';
import { createShowcaseMap } from './maps/showcaseMap.js';
import { createEnemyTestMap } from './maps/enemyTestMap.js';

// Utilities
import { getDeltaTime } from './utils/deltaTime.js';
import { drawFPS } from './utils/fpsDisplay.js';
import { render3D, setFloorCastingParams, floorCaster } from './utils/render3DFunction.js';
import { drawBackground, drawMinimap, resizeCanvas } from './utils/utils.js';
import FogOfWar from './utils/FogOfWar.js';

// ===========================================
// GAME STATE
// ===========================================

/** @type {Boundaries[]} */
let boundaries = [];

/** @type {EnemyClass[]} */
let enemies = [];

/** @type {Player} */
let player;

/** @type {GameMap[]} */
let gameMaps = [];

/** @type {GameMap} */
let ActiveMap = null;

/** @type {Textures} */
const textures = new Textures();

/** @type {FogOfWar} */
const fogOfWar = new FogOfWar({
  cellSize: FogOfWarConfig.cellSize,
  mapWidth: FogOfWarConfig.defaultMapWidth,
  mapHeight: FogOfWarConfig.defaultMapHeight,
  enabled: FogOfWarConfig.enabled,
  rayCount: FogOfWarConfig.rayCount
});
fogOfWar.setRevealDistance(FogOfWarConfig.revealDistance);

// Noclip mode state
let noclipEnabled = false;

// ===========================================
// INITIALIZE UI COMPONENTS
// ===========================================

const detectionAlert = new DetectionAlert();
const detectionTimer = new ProgressBar({
  maxValue: DetectionConfig.timerMax,
  width: 200,
  height: 20,
  label: 'ALERT',
  position: 'bottom',
  showValue: true
});
const gameOverScreen = new GameOverScreen();
const winScreen = new WinScreen();
const mapSelector = new MapSelector();

// Maze-specific instructions panel
const mazeInstructions = new InstructionsPanel({
  title: 'MAZE CHALLENGE',
  sections: [
    {
      heading: 'OBJECTIVE:',
      lines: [
        '  • Start from the BLUE zone',
        '  • Navigate to the GREEN zone',
        '  • Avoid detection by enemies'
      ]
    },
    {
      heading: 'HINTS:',
      lines: [
        '  • Press P to reveal the path (3 seconds, one-time use)',
        '  • Emergency path help activates if alert drops critically low'
      ]
    }
  ],
  dismissPrompt: 'Press ENTER or SPACE to start'
});

// Settings menu
const settingsMenu = new SettingsMenu();
let settingsMenuClosing = false;

settingsMenu.onClose = () => {
  settingsMenuClosing = true;
  setTimeout(() => { settingsMenuClosing = false; }, 100);
};

// Open settings when pointer lock is released (handles Escape when locked)
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === null && !settingsMenu.visible && !mapSelector.visible && !settingsMenuClosing) {
    settingsMenu.show();
  }
});

// Open settings with Escape when pointer lock is NOT active
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.pointerLockElement && !settingsMenu.visible && !mapSelector.visible) {
    e.preventDefault();
    settingsMenu.show();
  }
});

// ===========================================
// INITIALIZE CORE SYSTEMS
// ===========================================

const gameState = new GameStateManager();

// Set up game state callbacks
gameState.onGameOver = () => {
  gameOverScreen.show(gameState.scoreBreakdown);
};

gameState.onWin = () => {
  winScreen.show(gameState.scoreBreakdown);
};

gameState.onCriticalAlert = () => {
  // Regenerate path as emergency help
  if (ActiveMap.mazeData) {
    const path = findMazePath(
      ActiveMap.mazeData,
      ActiveMap.startZone,
      player.pos,
      ActiveMap.goalZone
    );
    gameState.setPath(path);
  }
};

// ===========================================
// INPUT HANDLING
// ===========================================

const inputHandler = new InputHandler(main_canvas, {
  // Blocking handler for instructions and settings menu
  onKeyDownBlocking: (e) => {
    // Handle settings menu first (highest priority)
    if (settingsMenu.visible) {
      const key = e.key;
      
      // Handle key rebinding
      if (settingsMenu.isRebinding) {
        e.preventDefault();
        settingsMenu.handleKeyForRebind(key);
        return true;
      }
      
      // Navigation and actions in settings menu
      if (key === 'Escape') {
        e.preventDefault();
        settingsMenu.hide();
        return true;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        settingsMenu.selectPrevious();
        return true;
      }
      if (key === 'ArrowDown') {
        e.preventDefault();
        settingsMenu.selectNext();
        return true;
      }
      if (key === 'ArrowLeft') {
        e.preventDefault();
        settingsMenu.adjustSensitivity(-1);
        return true;
      }
      if (key === 'ArrowRight') {
        e.preventDefault();
        settingsMenu.adjustSensitivity(1);
        return true;
      }
      if (key === 'Enter') {
        e.preventDefault();
        settingsMenu.confirm();
        return true;
      }
      if (key === 'Tab') {
        e.preventDefault();
        settingsMenu.switchTab(settingsMenu.currentTab === 'controls' ? 'sensitivity' : 'controls');
        return true;
      }
      if (key === 'Delete' || key === 'Backspace') {
        e.preventDefault();
        settingsMenu.clearBinding();
        return true;
      }
      if (key === 'r' || key === 'R') {
        e.preventDefault();
        settingsMenu.resetToDefaults();
        return true;
      }
      
      return true;
    }
    
    if (gameState.showInstructions && ActiveMap.mazeData) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        gameState.dismissInstructions();
        gameState.startTimer(); // Start the scoring timer
        mazeInstructions.dismiss();
        return true;
      }
      return true; // Block all other input
    }
    return false;
  },

  onMouseMove: (movementX, movementY) => {
    if (gameState.showInstructions && ActiveMap.mazeData) return;
    if (settingsMenu.visible) return;
    player.updateViewDirection(player.viewDirection + (movementX * ControlsConfig.getSensitivity()));
  },

  onJump: () => player.jump(),
  onCrouchStart: () => player.setCrouch(true),
  onCrouchEnd: () => player.setCrouch(false),
  onSprintStart: () => player.setSprint(true),
  onSprintEnd: () => player.setSprint(false),

  onReset: () => {
    resetGame();
  },

  onNoclipToggle: () => {
    noclipEnabled = player.toggleCollision();
    console.log(`Noclip mode: ${noclipEnabled ? 'ON' : 'OFF'}`);
  },

  onPathReveal: () => {
    if (ActiveMap.mazeData && gameState.tryRevealPath()) {
      const path = findMazePath(
        ActiveMap.mazeData,
        ActiveMap.startZone,
        player.pos,
        ActiveMap.goalZone
      );
      gameState.setPath(path);
      console.log('Path revealed for 3 seconds (one-time use)');
    } else if (gameState.pathUsedOnce) {
      console.log('Path reveal already used');
    }
  },

  onMapSelectorToggle: () => {
    if (settingsMenu.visible) return; // Don't toggle map selector when settings is open
    mapSelector.toggle();
    if (mapSelector.visible) {
      document.exitPointerLock();
    }
  },

  onMapQuickSelect: (index) => {
    if (index < gameMaps.length) {
      switchToMap(index);
      mapSelector.hide();
    }
  },

  onNavigateUp: () => {
    if (mapSelector.visible) {
      mapSelector.selectPrevious();
    }
  },

  onNavigateDown: () => {
    if (mapSelector.visible) {
      mapSelector.selectNext();
    }
  },

  onConfirm: () => {
    if (mapSelector.visible) {
      switchToMap(mapSelector.getSelectedIndex());
      mapSelector.hide();
    }
  },

  onCancel: () => {
    if (settingsMenu.visible) {
      settingsMenu.hide();
    } else {
      mapSelector.hide();
    }
  }
});

// ===========================================
// GAME LOOP
// ===========================================

const gameLoop = new GameLoop(draw);

// Track frame timing for real delta
let lastFrameTime = performance.now();

// ===========================================
// CANVAS RESIZE HANDLING
// ===========================================

window.addEventListener('resize', () => {
  resizeCanvas({ canvasArray: [main_canvas, background_canvas, minimap_canvas], ratio: 16 / 9 });
  drawBackground(background_ctx, background_canvas.height, background_canvas.width);
  
  // Update camera's canvas height for precomputed height multipliers
  if (player && player.camera) {
    player.camera.setCanvasHeight(main_canvas.height);
  }
});

// ===========================================
// OPTIMIZATION STATS (Debug)
// ===========================================

let showOptimizationStats = false; // Toggle with 'O' key
let floorCastingEnabled = true; // Toggle with 'F' key

// Performance tracking - lightweight
let lastStatsTime = performance.now();
let statsFrameCount = 0;
let totalFrames = 0;
let sessionStartTime = performance.now();

// Cached stats (updated periodically, not every frame)
let cachedStats = {
  fps: 60,
  avgFrameTime: 16.67,
  minFrameTime: 16.67,
  maxFrameTime: 16.67,
  onePercentLow: 16.67,
  frameTimeSum: 0,
  frameTimeMin: 999,
  frameTimeMax: 0,
  frameTimeSamples: []
};

/**
 * Updates performance tracking (called every frame, lightweight)
 */
function updatePerformanceTracking() {
  const now = performance.now();
  statsFrameCount++;
  totalFrames++;
  
  // Track frame time for this frame
  const frameTime = getDeltaTime(120) * (1000 / 120);
  cachedStats.frameTimeSum += frameTime;
  if (frameTime < cachedStats.frameTimeMin) cachedStats.frameTimeMin = frameTime;
  if (frameTime > cachedStats.frameTimeMax) cachedStats.frameTimeMax = frameTime;
  cachedStats.frameTimeSamples.push(frameTime);
  
  // Keep only last 60 samples
  if (cachedStats.frameTimeSamples.length > 60) {
    cachedStats.frameTimeSamples.shift();
  }
  
  // Update cached stats every 500ms
  const elapsed = now - lastStatsTime;
  if (elapsed >= 500) {
    cachedStats.fps = Math.round((statsFrameCount / elapsed) * 1000);
    cachedStats.avgFrameTime = cachedStats.frameTimeSum / statsFrameCount;
    cachedStats.minFrameTime = cachedStats.frameTimeMin;
    cachedStats.maxFrameTime = cachedStats.frameTimeMax;
    
    // Calculate 1% low only during update (not every frame)
    if (cachedStats.frameTimeSamples.length > 0) {
      const sorted = cachedStats.frameTimeSamples.slice().sort((a, b) => b - a);
      cachedStats.onePercentLow = sorted[0]; // Just use the worst frame
    }
    
    // Reset for next period
    statsFrameCount = 0;
    lastStatsTime = now;
    cachedStats.frameTimeSum = 0;
    cachedStats.frameTimeMin = 999;
    cachedStats.frameTimeMax = 0;
  }
}

/**
 * Draws optimization statistics on screen
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} width 
 * @param {number} height 
 */
function drawOptimizationStats(ctx, width, height) {
  if (!showOptimizationStats || !player) return;
  
  const now = performance.now();
  
  // Use cached values
  const currentFPS = cachedStats.fps;
  const avgFrameTime = cachedStats.avgFrameTime;
  const minFrameTime = cachedStats.minFrameTime;
  const maxFrameTime = cachedStats.maxFrameTime;
  const onePercentLow = cachedStats.onePercentLow;
  
  // Session time (cheap calculation)
  const sessionTime = (now - sessionStartTime) / 1000;
  const sessionMinutes = Math.floor(sessionTime / 60);
  const sessionSeconds = Math.floor(sessionTime % 60);
  
  // These are already optimized in their respective classes
  const gridStats = player.camera.spatialGrid.getStats();
  const fogStats = fogOfWar.getStats();
  
  // Calculate distance to goal if available
  let distToGoal = null;
  if (ActiveMap.goalZone) {
    const dx = ActiveMap.goalZone.x - player.pos.x;
    const dy = ActiveMap.goalZone.y - player.pos.y;
    distToGoal = Math.sqrt(dx * dx + dy * dy);
  }
  
  ctx.save();
  
  // Background panel - bottom left corner
  const panelWidth = 270;
  const panelHeight = 340;
  const panelX = 8;
  const panelY = height - panelHeight - 8;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
  
  const x = panelX + 8;
  let y = panelY + 16;
  const lineHeight = 13;
  
  // Title
  ctx.fillStyle = 'rgba(0, 255, 100, 1)';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('DEBUG STATS', x, y);
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(100, 100, 100, 0.9)';
  ctx.fillText(`Session: ${sessionMinutes}m ${sessionSeconds}s`, x + 120, y);
  y += lineHeight + 4;
  
  // Performance Section
  ctx.fillStyle = 'rgba(255, 100, 100, 1)';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('PERFORMANCE', x, y); y += lineHeight;
  ctx.font = '10px monospace';
  
  // FPS with color coding
  ctx.fillStyle = currentFPS >= 55 ? 'rgba(0, 255, 0, 0.9)' : currentFPS >= 30 ? 'rgba(255, 255, 0, 0.9)' : 'rgba(255, 50, 50, 0.9)';
  ctx.fillText(`FPS: ${currentFPS}`, x, y);
  ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
  ctx.fillText(`Avg: ${avgFrameTime.toFixed(2)}ms`, x + 70, y);
  ctx.fillText(`1%Low: ${onePercentLow.toFixed(1)}ms`, x + 160, y);
  y += lineHeight;
  
  ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
  ctx.fillText(`Min: ${minFrameTime.toFixed(2)}ms  Max: ${maxFrameTime.toFixed(2)}ms`, x, y);
  ctx.fillText(`Frames: ${totalFrames}`, x + 170, y);
  y += lineHeight + 3;
  
  // Rendering Section
  ctx.fillStyle = 'rgba(100, 200, 255, 1)';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('RENDERING', x, y); y += lineHeight;
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
  ctx.fillText(`Rays: ${player.camera.rayCount}`, x, y);
  ctx.fillText(`FOV: ${player.camera.fov.toFixed(0)}°`, x + 85, y);
  ctx.fillText(`Canvas: ${width}x${height}`, x + 145, y);
  y += lineHeight;
  ctx.fillText(`Floor/Ceil: ${floorCastingEnabled ? 'ON' : 'OFF'}`, x, y);
  ctx.fillText(`Zones: ${ActiveMap.floorZones ? ActiveMap.floorZones.length : 0}`, x + 110, y);
  ctx.fillText(`Enemies: ${enemies.length}`, x + 175, y);
  y += lineHeight + 3;
  
  // Spatial Grid Section
  ctx.fillStyle = 'rgba(255, 200, 100, 1)';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('SPATIAL GRID', x, y); y += lineHeight;
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
  ctx.fillText(`Cells: ${gridStats.cellCount}`, x, y);
  ctx.fillText(`Boundaries: ${gridStats.boundaryCount}`, x + 90, y);
  y += lineHeight;
  ctx.fillText(`Avg/Cell: ${gridStats.avgBoundariesPerCell}`, x, y);
  ctx.fillText(`Max/Cell: ${gridStats.maxBoundariesPerCell}`, x + 100, y);
  ctx.fillText(`${gridStats.memoryEstimate}`, x + 195, y);
  y += lineHeight + 3;
  
  // Fog of War Section
  ctx.fillStyle = 'rgba(200, 100, 255, 1)';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('FOG OF WAR', x, y); y += lineHeight;
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
  ctx.fillText(`Status: ${fogStats.enabled ? 'ENABLED' : 'DISABLED'}`, x, y);
  ctx.fillText(`Explored: ${fogStats.percentExplored}`, x + 130, y);
  y += lineHeight;
  ctx.fillText(`Cells: ${fogStats.exploredCells}`, x, y);
  ctx.fillText(`Visible Enemies: ${fogStats.seenEnemies}`, x + 100, y);
  y += lineHeight + 3;
  
  // Map Section
  ctx.fillStyle = 'rgba(100, 255, 200, 1)';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('MAP', x, y); y += lineHeight;
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
  ctx.fillText(`Name: ${ActiveMap.name}`, x, y);
  ctx.fillText(`Size: ${ActiveMap.size.width}x${ActiveMap.size.height}`, x + 140, y);
  y += lineHeight;
  ctx.fillText(`Type: ${ActiveMap.mazeData ? 'Maze' : 'Custom'}`, x, y);
  if (distToGoal !== null) {
    ctx.fillText(`Goal Dist: ${distToGoal.toFixed(0)}`, x + 100, y);
  }
  y += lineHeight + 3;
  
  // Player Section
  ctx.fillStyle = 'rgba(255, 255, 100, 1)';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('PLAYER', x, y); y += lineHeight;
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
  ctx.fillText(`Pos: (${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(1)})`, x, y);
  ctx.fillText(`Dir: ${player.viewDirection.toFixed(1)}°`, x + 165, y);
  y += lineHeight;
  ctx.fillText(`Eye: ${player.eyeHeight.toFixed(3)}`, x, y);
  
  // Player state indicators
  let stateX = x + 90;
  if (player.isCrouching) {
    ctx.fillStyle = 'rgba(100, 150, 255, 0.9)';
    ctx.fillText('CROUCH', stateX, y);
    stateX += 55;
  }
  if (player.isSprinting) {
    ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
    ctx.fillText('SPRINT', stateX, y);
    stateX += 55;
  }
  if (player.eyeHeight > 0.1) {
    ctx.fillStyle = 'rgba(100, 255, 100, 0.9)';
    ctx.fillText('JUMP', stateX, y);
  }
  y += lineHeight + 4;
  
  // Controls hint
  ctx.fillStyle = 'rgba(120, 120, 120, 0.9)';
  ctx.fillText('[O] Hide Stats  [F] Toggle Floor  [M] Map Select', x, y);
  
  ctx.restore();
}

// Add keyboard listener for stats toggle and floor casting toggle
document.addEventListener('keydown', (e) => {
  if (!settingsMenu.visible && !mapSelector.visible) {
    if (e.key === 'o' || e.key === 'O') {
      showOptimizationStats = !showOptimizationStats;
      console.log(`Optimization stats: ${showOptimizationStats ? 'ON' : 'OFF'}`);
    }
    if (e.key === 'f' || e.key === 'F') {
      floorCastingEnabled = !floorCastingEnabled;
      floorCaster.enabled = floorCastingEnabled;
      console.log(`Floor casting: ${floorCastingEnabled ? 'ON' : 'OFF'}`);
    }
  }
});

// ===========================================
// MAP MANAGEMENT
// ===========================================

/**
 * Sets the active map
 * @param {GameMap[]} maps - Array of game maps
 * @param {string} mapName - Name of the map to activate
 */
function setActiveMap(maps, mapName) {
  ActiveMap = maps.find(map => map.name === mapName);
  boundaries = ActiveMap.getBoundaries();

  enemies = ActiveMap.getEnemies();
  enemies.forEach(enemy => boundaries.push(enemy.skin));

  player.pos = { x: ActiveMap.userSpawnLocation.x, y: ActiveMap.userSpawnLocation.y };
  player.updateViewDirection(ActiveMap.userViewDirection);

  // Reset game state
  const isMazeMap = !!ActiveMap.mazeData;
  gameState.reset(isMazeMap);
  
  // Handle instructions for maze map
  if (isMazeMap) {
    mazeInstructions.show();
  } else {
    mazeInstructions.hide();
    mazeInstructions.dismiss();
  }
  
  // Reset UI
  gameOverScreen.hide();
  winScreen.hide();
  detectionAlert.setDetected(false);
  
  // Reset goal zone
  if (ActiveMap.goalZone) {
    ActiveMap.goalZone.reset();
  }

  // Apply minimap settings
  const settings = ActiveMap.minimapSettings || MinimapConfig.default;
  miniMapSettings.scale = settings.scale ?? MinimapConfig.default.scale;
  miniMapSettings.radius = settings.radius ?? MinimapConfig.default.radius;
  miniMapSettings.x = settings.x ?? MinimapConfig.default.x;
  miniMapSettings.y = settings.y ?? MinimapConfig.default.y;
  miniMapSettings.rotateWithPlayer = settings.rotateWithPlayer ?? MinimapConfig.default.rotateWithPlayer;
  
  // Configure and reset fog of war
  // Only enable fog of war for maze maps
  fogOfWar.setEnabled(isMazeMap && FogOfWarConfig.enabled);
  if (isMazeMap) {
    // Configure fog of war for maze dimensions
    const mazeWidth = ActiveMap.mazeData ? ActiveMap.mazeData.cols * ActiveMap.mazeData.cellSize * 2 : 3000;
    const mazeHeight = ActiveMap.mazeData ? ActiveMap.mazeData.rows * ActiveMap.mazeData.cellSize * 2 : 3000;
    fogOfWar.configure(mazeWidth, mazeHeight);
  }
  fogOfWar.reset();
  
  // Configure floor zones
  floorCaster.clearZones();
  if (ActiveMap.floorZones) {
    floorCaster.setZones(ActiveMap.floorZones);
  }
  
  // Update map selector
  mapSelector.setActiveMap(maps.indexOf(ActiveMap));
}

/**
 * Switches to a map by index
 * @param {number} index - Index of the map to switch to
 */
function switchToMap(index) {
  if (index >= 0 && index < gameMaps.length) {
    setActiveMap(gameMaps, gameMaps[index].name);
  }
}

/**
 * Resets the current game
 */
function resetGame() {
  player.pos = { x: ActiveMap.userSpawnLocation.x, y: ActiveMap.userSpawnLocation.y };
  player.updateViewDirection(ActiveMap.userViewDirection);
  
  const isMazeMap = !!ActiveMap.mazeData;
  gameState.reset(isMazeMap);
  
  gameOverScreen.hide();
  winScreen.hide();
  
  // Reset goal zone
  if (ActiveMap.goalZone) {
    ActiveMap.goalZone.reset();
  }
  
  // Reset fog of war for maze maps
  if (isMazeMap) {
    fogOfWar.reset();
    mazeInstructions.show();
  }
}

// ===========================================
// GAME SETUP
// ===========================================

function setUpGame() {
  resizeCanvas({ canvasArray: [main_canvas, background_canvas, minimap_canvas], ratio: 16 / 9 });
  drawBackground(background_ctx, background_canvas.height, background_canvas.width);

  // Add textures
  textures.addTexture('wall', './images/wall_texture_1.jpg');
  textures.addTexture('edge', './images/wall_texture_2.png');
  textures.addTexture('enemySprite0', './images/00.png');
  textures.addTexture('enemySprite1', './images/10.png');
  textures.addTexture('enemySprite2', './images/20.png');
  textures.addTexture('enemySprite3', './images/30.png');
  textures.addTexture('enemySprite4', './images/40.png');

  // Add maps
  gameMaps.push(createTestMap(textures, 'Test Map'));
  gameMaps.push(createMazeMap(textures, 'Maze Map', {
    cols: 20,
    rows: 20,
    cellSize: 90,
    wallThickness: 15,
    curveChance: 1.0,
    loopChance: 0.1,
    roomCount: 2,
    roomMinSize: 2,
    roomMaxSize: 4,
    enemyCount: 15
  }));
  gameMaps.push(createShowcaseMap(textures, 'Showcase Map'));
  gameMaps.push(createEnemyTestMap(textures, 'Enemy Test'));

  // Set up map selector
  mapSelector.setMaps(gameMaps);

  // Create player with canvas height for precomputed height multipliers
  player = new Player({ x: 0, y: 0 });
  
  // Initialize camera with canvas height for precomputed height multipliers
  player.camera.setCanvasHeight(main_canvas.height);

  // Set initial active map
  setActiveMap(gameMaps, 'Maze Map');
  
  console.log('Optimizations enabled: Spatial Grid, SIMD-like batching, Precomputed Height Multipliers, Floor Casting');
  console.log('Press O to toggle optimization stats overlay, F to toggle floor casting');
}

// ===========================================
// RENDER PATH EXPIRY TIMER
// ===========================================

function drawPathExpiryTimer() {
  if (!gameState.showPath || !ActiveMap.mazeData) return;

  const ctx = main_ctx;
  const w = main_canvas.width;
  const h = main_canvas.height;

  const remainingSeconds = gameState.getPathTimeRemaining();
  const percentage = remainingSeconds / (DetectionConfig.pathDisplayDuration / 1000);

  // Position at top center
  const timerX = w / 2;
  const timerY = h * 0.08;
  const barWidth = 200;
  const barHeight = 25;
  const barX = timerX - barWidth / 2;
  const barY = timerY - barHeight / 2;

  // Color based on remaining time
  let barColor;
  if (percentage > 0.6) {
    barColor = 'rgba(100, 255, 100, 0.9)';
  } else if (percentage > 0.3) {
    barColor = 'rgba(255, 200, 50, 0.9)';
  } else {
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.02);
    barColor = `rgba(255, 50, 50, ${0.9 * pulse})`;
  }

  ctx.save();

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(barX - 5, barY - 5, barWidth + 10, barHeight + 10);

  // Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  // Fill
  ctx.fillStyle = barColor;
  ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * percentage, barHeight - 4);

  // Timer text
  ctx.font = `bold ${Math.floor(h * 0.022)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = barColor;
  ctx.fillText(remainingSeconds.toFixed(1) + 's', timerX, timerY);

  // Label
  ctx.font = `${Math.floor(h * 0.018)}px Arial`;
  ctx.fillStyle = 'rgba(255, 200, 50, 0.9)';
  ctx.fillText('PATH ACTIVE', timerX, timerY - barHeight - 5);

  ctx.restore();
}

// ===========================================
// MAIN DRAW LOOP
// ===========================================

function draw() {
  main_ctx.clearRect(0, 0, main_canvas.width, main_canvas.height);
  minimap_ctx.clearRect(0, 0, minimap_canvas.width, minimap_canvas.height);

  // Calculate timing
  const currentTime = performance.now();
  const realDeltaSeconds = (currentTime - lastFrameTime) / 1000;
  lastFrameTime = currentTime;
  
  const deltaTime = getDeltaTime(120);
  
  // Update performance tracking (lightweight, runs every frame)
  updatePerformanceTracking();

  // Redraw background with parallax
  drawBackground(background_ctx, background_canvas.height, background_canvas.width, player.eyeHeight);

  // Update input state to player
  const moveState = inputHandler.getMoveState();
  player.moveForwards = moveState.forward;
  player.moveBackwards = moveState.backward;
  player.moveLeft = moveState.left;
  player.moveRight = moveState.right;

  // Check if game logic should pause
  const isMazeMap = !!ActiveMap.mazeData;
  
  if (gameState.showInstructions && isMazeMap) {
    // Set floor casting params for static render
    setFloorCastingParams({
      playerX: player.pos.x,
      playerY: player.pos.y,
      playerAngle: player.viewDirection,
      fov: player.camera.fov,
      enabled: floorCastingEnabled
    });
    // Render scene but don't update
    const scene = player.getScene(boundaries);
    render3D(scene, player.eyeHeight);
    // Update fog of war even during instructions so player sees starting area
    fogOfWar.setBoundaries(boundaries);
    fogOfWar.updateExploration(player.pos.x, player.pos.y, player.viewDirection, player.camera.fov);
    drawMinimap(minimap_ctx, boundaries, player, enemies, ActiveMap.goalZone, ActiveMap.startZone, null, fogOfWar);
    mazeInstructions.draw(main_ctx, main_canvas.width, main_canvas.height);
    return;
  }

  if (gameState.isGameOver) {
    // Set floor casting params for static render
    setFloorCastingParams({
      playerX: player.pos.x,
      playerY: player.pos.y,
      playerAngle: player.viewDirection,
      fov: player.camera.fov,
      enabled: floorCastingEnabled
    });
    // Render scene but don't update
    const scene = player.getScene(boundaries);
    render3D(scene, player.eyeHeight);
    drawMinimap(minimap_ctx, boundaries, player, enemies, ActiveMap.goalZone, ActiveMap.startZone, null, fogOfWar);
    
    detectionTimer.setValue(gameState.detectionTimer);
    detectionTimer.draw(main_ctx, main_canvas.width, main_canvas.height);
    gameOverScreen.draw(main_ctx, main_canvas.width, main_canvas.height);
    return;
  }

  if (gameState.isWin) {
    // Set floor casting params for static render
    setFloorCastingParams({
      playerX: player.pos.x,
      playerY: player.pos.y,
      playerAngle: player.viewDirection,
      fov: player.camera.fov,
      enabled: floorCastingEnabled
    });
    // Render scene but don't update
    const scene = player.getScene(boundaries);
    render3D(scene, player.eyeHeight);
    drawMinimap(minimap_ctx, boundaries, player, enemies, ActiveMap.goalZone, ActiveMap.startZone, null, fogOfWar);
    
    winScreen.draw(main_ctx, main_canvas.width, main_canvas.height);
    return;
  }

  // Update animated boundaries
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];
    if (boundary.isAnimated) {
      boundary.update();
    }
  }

  // Set floor casting parameters
  setFloorCastingParams({
    playerX: player.pos.x,
    playerY: player.pos.y,
    playerAngle: player.viewDirection,
    fov: player.camera.fov,
    enabled: floorCastingEnabled
  });

  // Render scene
  const scene = player.getScene(boundaries);
  render3D(scene, player.eyeHeight);
  player.update(deltaTime, boundaries);

  // Check if player reached goal zone
  if (isMazeMap && ActiveMap.goalZone && !gameState.isWin) {
    if (ActiveMap.goalZone.checkReached(player.pos.x, player.pos.y)) {
      gameState.triggerWin();
    }
  }

  // Track detection
  let isPlayerDetected = false;
  
  enemies.forEach(enemy => {
    enemy.update(deltaTime);
    const detected = enemy.detectPlayer(player, boundaries);
    
    if (detected.isDetected) {
      isPlayerDetected = true;
      enemy.viewDirection = Math.atan2(
        detected.userPosition.y - enemy.pos.y,
        detected.userPosition.x - enemy.pos.x
      ) * 180 / Math.PI;
    }

    // Update enemy boundary
    const enemyBoundary = boundaries.find(b => b.uniqueID === enemy.id);
    if (enemyBoundary) {
      enemyBoundary.updatePosition(enemy.pos.x, enemy.pos.y);
      
      const angleToPlayer = Math.atan2(
        player.pos.y - enemy.pos.y,
        player.pos.x - enemy.pos.x
      ) * 180 / Math.PI;
      enemyBoundary.rotateBoundary(angleToPlayer);
      enemyBoundary.setFacingDirection(enemy.viewDirection);
    }
  });

  // Stop sprinting when detected
  if (isPlayerDetected) {
    player.setSprint(false);
  }

  // Update detection alert
  detectionAlert.setDetected(isPlayerDetected);

  // Update game state (detection timer, etc.)
  gameState.update(realDeltaSeconds, isPlayerDetected, player.isCrouching, isMazeMap);

  // Update path if showing
  if (gameState.showPath && isMazeMap) {
    const path = findMazePath(
      ActiveMap.mazeData,
      ActiveMap.startZone,
      player.pos,
      ActiveMap.goalZone
    );
    gameState.setPath(path);
  }

  // Update fog of war exploration (view-based with wall occlusion)
  if (isMazeMap) {
    fogOfWar.setBoundaries(boundaries);
    fogOfWar.updateExploration(player.pos.x, player.pos.y, player.viewDirection, player.camera.fov);
  }

  // Draw minimap (on separate canvas for optimization)
  drawMinimap(minimap_ctx, boundaries, player, enemies, ActiveMap.goalZone, ActiveMap.startZone, gameState.currentPath, fogOfWar);

  // Draw FPS
  drawFPS(main_canvas.width, main_canvas.height, main_ctx);

  // Draw UI components
  drawPathExpiryTimer();
  detectionAlert.draw(main_ctx, main_canvas.width, main_canvas.height);
  
  // Detection timer (only for maze map and when not full)
  if (isMazeMap) {
    detectionTimer.setValue(gameState.detectionTimer);
    detectionTimer.draw(main_ctx, main_canvas.width, main_canvas.height);
  }

  // Map selector (drawn last to be on top)
  mapSelector.draw(main_ctx, main_canvas.width, main_canvas.height);
  
  // Optimization stats (debug overlay)
  drawOptimizationStats(main_ctx, main_canvas.width, main_canvas.height);
}

// ===========================================
// INITIALIZE AND START GAME
// ===========================================

setUpGame();

textures.setOnAllLoaded(() => {
  gameLoop.start();
});

// Expose for debugging
window.stopGameLoop = () => gameLoop.stop();
window.startGameLoop = () => gameLoop.start();
window.gameState = gameState;
