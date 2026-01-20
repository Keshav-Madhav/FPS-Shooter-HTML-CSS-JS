/**
 * Main Game Script - Refactored for better separation of concerns
 * 
 * This file serves as the entry point and orchestrator for the game.
 * Logic is delegated to specialized modules for better maintainability.
 */

// Core game components
import { GameLoop, GameStateManager, InputHandler } from './core/index.js';

// Configuration
import { InputConfig, MinimapConfig, DetectionConfig } from './config/index.js';

// UI Components
import { 
  DetectionAlert, 
  ProgressBar, 
  GameOverScreen, 
  InstructionsPanel,
  MapSelector 
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
import { render3D } from './utils/render3DFunction.js';
import { drawBackground, drawMinimap, resizeCanvas } from './utils/utils.js';

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

// ===========================================
// INITIALIZE CORE SYSTEMS
// ===========================================

const gameState = new GameStateManager();

// Set up game state callbacks
gameState.onGameOver = () => {
  gameOverScreen.show();
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
  // Blocking handler for instructions
  onKeyDownBlocking: (e) => {
    if (gameState.showInstructions && ActiveMap.mazeData) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        gameState.dismissInstructions();
        mazeInstructions.dismiss();
        return true;
      }
      return true; // Block all other input
    }
    return false;
  },

  onMouseMove: (movementX, movementY) => {
    if (gameState.showInstructions && ActiveMap.mazeData) return;
    player.updateViewDirection(player.viewDirection + (movementX * InputConfig.mouseSensitivity));
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
    mapSelector.hide();
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
  resizeCanvas({ canvasArray: [main_canvas, background_canvas], ratio: 16 / 9 });
  drawBackground(background_ctx, background_canvas.height, background_canvas.width);
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
  detectionAlert.setDetected(false);

  // Apply minimap settings
  const settings = ActiveMap.minimapSettings || MinimapConfig.default;
  miniMapSettings.scale = settings.scale ?? MinimapConfig.default.scale;
  miniMapSettings.radius = settings.radius ?? MinimapConfig.default.radius;
  miniMapSettings.x = settings.x ?? MinimapConfig.default.x;
  miniMapSettings.y = settings.y ?? MinimapConfig.default.y;
  
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
  
  if (isMazeMap) {
    mazeInstructions.show();
  }
}

// ===========================================
// GAME SETUP
// ===========================================

function setUpGame() {
  resizeCanvas({ canvasArray: [main_canvas, background_canvas], ratio: 16 / 9 });
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

  // Create player
  player = new Player({ x: 0, y: 0 });

  // Set initial active map
  setActiveMap(gameMaps, 'Maze Map');
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

  // Calculate timing
  const currentTime = performance.now();
  const realDeltaSeconds = (currentTime - lastFrameTime) / 1000;
  lastFrameTime = currentTime;
  
  const deltaTime = getDeltaTime(120);

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
    // Render scene but don't update
    const scene = player.getScene(boundaries);
    render3D(scene, player.eyeHeight);
    drawMinimap(main_ctx, boundaries, player, enemies, ActiveMap.goalZone, ActiveMap.startZone, null);
    mazeInstructions.draw(main_ctx, main_canvas.width, main_canvas.height);
    return;
  }

  if (gameState.isGameOver) {
    // Render scene but don't update
    const scene = player.getScene(boundaries);
    render3D(scene, player.eyeHeight);
    drawMinimap(main_ctx, boundaries, player, enemies, ActiveMap.goalZone, ActiveMap.startZone, null);
    
    detectionTimer.setValue(gameState.detectionTimer);
    detectionTimer.draw(main_ctx, main_canvas.width, main_canvas.height);
    gameOverScreen.draw(main_ctx, main_canvas.width, main_canvas.height);
    return;
  }

  // Update animated boundaries
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];
    if (boundary.isAnimated) {
      boundary.update();
    }
  }

  // Render scene
  const scene = player.getScene(boundaries);
  render3D(scene, player.eyeHeight);
  player.update(deltaTime, boundaries);

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

  // Draw minimap
  drawMinimap(main_ctx, boundaries, player, enemies, ActiveMap.goalZone, ActiveMap.startZone, gameState.currentPath);

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
