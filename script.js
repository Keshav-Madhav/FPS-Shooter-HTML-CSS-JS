import Boundaries from "./classes/BoundariesClass.js";
import GameMap from "./classes/GameMapClass.js";
import Textures from "./classes/TexturesClass.js";
import Player from "./classes/UserClass.js";
import EnemyClass from "./classes/EnemyClass.js";
import { createTestMap } from "./maps/testMap.js";
import { createMazeMap, findMazePath } from "./maps/mazeMap.js";
import { createShowcaseMap } from "./maps/showcaseMap.js";
import { createEnemyTestMap } from "./maps/enemyTestMap.js";
import { getDeltaTime } from "./utils/deltaTime.js";
import { drawFPS } from "./utils/fpsDisplay.js";
import { render3D } from "./utils/render3DFunction.js";
import { drawBackground, drawMinimap, resizeCanvas } from "./utils/utils.js";

window.addEventListener('resize', ()=>{
  resizeCanvas({canvasArray: [main_canvas, background_canvas], ratio: 16/9});
  drawBackground(background_ctx, background_canvas.height, background_canvas.width);
});

/** @type {Boundaries[]} */
let boundaries = [];

/** @type {EnemyClass[]} */
let enemies = [];

/** @type {Player} */
let player;

/** @type {GameMap[]} */
let gameMaps = []

/** @type {GameMap} */
let ActiveMap = null;

/** @type {Textures} */
const textures = new Textures();

// Map selector state
let showMapSelector = false;
let selectedMapIndex = 0;

// Detection alert state
let isPlayerDetected = false;
let detectionAlertOpacity = 0;

// Noclip mode state
let noclipEnabled = false;

// Path reveal state
let showPath = false;
let currentPath = null;
let pathUsedOnce = false; // Track if path has been used
let pathRevealTime = 0; // Time when path was revealed
const PATH_DISPLAY_DURATION = 3000; // 3 seconds in milliseconds
let pathRegenerated = false; // Track if path was auto-regenerated from critical alert
const CRITICAL_ALERT_THRESHOLD = 0.75; // Alert time threshold for path regeneration

// Instructions state (for maze map)
let showInstructions = true; // Show instructions on maze map start
let instructionsDismissed = false; // Track if instructions have been dismissed

// Detection timer state (for maze map)
const DETECTION_TIMER_MAX = 5.0; // 5 seconds
const DETECTION_DRAIN_RATE = 1.0; // 1 second per second when detected
const DETECTION_REGEN_RATE = 0.1; // 0.1 seconds per second when not detected (10x slower)
const DETECTION_REGEN_DELAY = 1.0; // 1 second delay before regen starts
let detectionTimer = DETECTION_TIMER_MAX;
let isGameOver = false;
let lastFrameTime = performance.now();
let timeSinceLastDetection = 0; // Track time since last detection for regen delay

main_canvas.addEventListener('keydown', (e) => {
  // Check if instructions are showing on maze map - only allow dismissal
  if (showInstructions && ActiveMap.mazeData) {
    // Press Enter or Space to dismiss instructions
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      showInstructions = false;
      instructionsDismissed = true;
      console.log('Instructions dismissed - controls enabled');
    }
    return; // Block all other inputs while instructions are showing
  }
  
  // Normal game controls (only work after instructions are dismissed)
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    player.moveForwards = true;
  } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    player.moveBackwards = true;
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    player.moveRight = true;
  } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    player.moveLeft = true;
  }

  if(e.key === 'Shift'){
    player.setSprint(true);
  }
  
  // Jump with Space bar
  if (e.key === ' ') {
    e.preventDefault(); // Prevent page scrolling
    player.jump();
  }
  
  // Crouch with Control or C key
  if (e.key === 'Control' || e.key === 'c' || e.key === 'C') {
    player.setCrouch(true);
  }

  if (e.key === 'r' || e.key === 'R') {
    // Reset player position and timer
    player.pos = {x: ActiveMap.userSpawnLocation.x, y: ActiveMap.userSpawnLocation.y};
    player.updateViewDirection(ActiveMap.userViewDirection);
    detectionTimer = DETECTION_TIMER_MAX;
    isGameOver = false;
    timeSinceLastDetection = 0;
    // Reset path reveal state
    showPath = false;
    currentPath = null;
    pathUsedOnce = false;
    pathRevealTime = 0;
    pathRegenerated = false;
  }
  
  // Toggle noclip mode (N key)
  if (e.key === 'n' || e.key === 'N') {
    noclipEnabled = player.toggleCollision();
    console.log(`Noclip mode: ${noclipEnabled ? 'ON' : 'OFF'}`);
  }
  
  // Toggle path reveal (P key) - only works once and shows for 3 seconds
  if (e.key === 'p' || e.key === 'P') {
    if (!pathUsedOnce && ActiveMap.mazeData) {
      showPath = true;
      pathUsedOnce = true;
      pathRevealTime = performance.now();
      // Calculate path from start through player to goal
      currentPath = findMazePath(
        ActiveMap.mazeData,
        ActiveMap.startZone,
        player.pos,
        ActiveMap.goalZone
      );
      console.log('Path revealed for 3 seconds (one-time use)');
    } else if (pathUsedOnce) {
      console.log('Path reveal already used');
    }
  }
  
  // Map selector toggle (M or Tab)
  if (e.key === 'm' || e.key === 'M' || e.key === 'Tab') {
    e.preventDefault();
    showMapSelector = !showMapSelector;
    if (showMapSelector) {
      document.exitPointerLock();
      selectedMapIndex = gameMaps.findIndex(m => m.name === ActiveMap.name);
    }
  }
  
  // Map selection with number keys (1-9)
  if (e.key >= '1' && e.key <= '9') {
    const mapIndex = parseInt(e.key) - 1;
    if (mapIndex < gameMaps.length) {
      switchToMap(mapIndex);
      showMapSelector = false;
    }
  }
  
  // Arrow keys for map selector
  if (showMapSelector) {
    if (e.key === 'ArrowUp') {
      selectedMapIndex = (selectedMapIndex - 1 + gameMaps.length) % gameMaps.length;
    } else if (e.key === 'ArrowDown') {
      selectedMapIndex = (selectedMapIndex + 1) % gameMaps.length;
    } else if (e.key === 'Enter') {
      switchToMap(selectedMapIndex);
      showMapSelector = false;
    } else if (e.key === 'Escape') {
      showMapSelector = false;
    }
  }
});

main_canvas.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    player.moveForwards = false;
  } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    player.moveBackwards = false;
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    player.moveRight = false;
  } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    player.moveLeft = false;
  }

  if(e.key === 'Shift'){
    player.setSprint(false);
  }
  
  // Release crouch with Control or C key
  if (e.key === 'Control' || e.key === 'c' || e.key === 'C') {
    player.setCrouch(false);
  }
});

// Add Pointer Lock API setup
main_canvas.addEventListener('click', function() {
  main_canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', lockChangeAlert, false);
document.addEventListener('mozpointerlockchange', lockChangeAlert, false);

function lockChangeAlert() {
  if (document.pointerLockElement === main_canvas ||
      document.mozPointerLockElement === main_canvas) {
    document.addEventListener("mousemove", updatePosition, false);
  } else {
    document.removeEventListener("mousemove", updatePosition, false);
  }
}

function updatePosition(e) {
  // Don't allow camera movement when instructions are showing
  if (showInstructions && ActiveMap.mazeData) return;
  
  player.updateViewDirection(player.viewDirection + (e.movementX * sensitivity));
}

// Default minimap settings (used when map doesn't specify custom settings)
const defaultMinimapSettings = {
  x: 110,
  y: 110,
  scale: 0.25,
  radius: 350
};

function setActiveMap(gameMaps, mapName) {
  ActiveMap = gameMaps.find(map => map.name === mapName);
  boundaries = ActiveMap.getBoundaries();

  enemies = ActiveMap.getEnemies();
  enemies.forEach(enemy => boundaries.push(enemy.skin));

  player.pos = {x: ActiveMap.userSpawnLocation.x, y: ActiveMap.userSpawnLocation.y};
  player.updateViewDirection(ActiveMap.userViewDirection);
  
  // Reset path when changing maps
  showPath = false;
  currentPath = null;
  pathUsedOnce = false;
  pathRevealTime = 0;
  pathRegenerated = false;
  
  // Reset instructions state - show instructions for maze map
  if (ActiveMap.mazeData) {
    showInstructions = true;
    instructionsDismissed = false;
  } else {
    showInstructions = false;
    instructionsDismissed = true;
  }
  
  // Reset detection timer
  detectionTimer = DETECTION_TIMER_MAX;
  isGameOver = false;
  timeSinceLastDetection = 0;
  
  // Apply map-specific minimap settings or use defaults
  if (ActiveMap.minimapSettings) {
    miniMapSettings.scale = ActiveMap.minimapSettings.scale ?? defaultMinimapSettings.scale;
    miniMapSettings.radius = ActiveMap.minimapSettings.radius ?? defaultMinimapSettings.radius;
    miniMapSettings.x = ActiveMap.minimapSettings.x ?? defaultMinimapSettings.x;
    miniMapSettings.y = ActiveMap.minimapSettings.y ?? defaultMinimapSettings.y;
  } else {
    miniMapSettings.scale = defaultMinimapSettings.scale;
    miniMapSettings.radius = defaultMinimapSettings.radius;
    miniMapSettings.x = defaultMinimapSettings.x;
    miniMapSettings.y = defaultMinimapSettings.y;
  }
}

/**
 * Switches to a map by index
 */
function switchToMap(index) {
  if (index >= 0 && index < gameMaps.length) {
    setActiveMap(gameMaps, gameMaps[index].name);
    selectedMapIndex = index;
  }
}

/**
 * Draws the detection alert at bottom center
 */
function drawDetectionAlert() {
  // Animate opacity
  const targetOpacity = isPlayerDetected ? 1 : 0;
  detectionAlertOpacity += (targetOpacity - detectionAlertOpacity) * 0.15;
  
  if (detectionAlertOpacity < 0.01) return;
  
  const ctx = main_ctx;
  const w = main_canvas.width;
  const h = main_canvas.height;
  
  // Position at bottom center (with some margin from edge)
  const y = h - 50;
  
  // Pulsing effect when detected
  const pulse = isPlayerDetected ? 0.85 + Math.sin(performance.now() * 0.008) * 0.15 : 1;
  
  // Draw background pill
  const text = '⚠ DETECTED';
  ctx.save();
  ctx.font = `bold ${Math.floor(h * 0.028)}px Arial`;
  const textWidth = ctx.measureText(text).width;
  const paddingX = 24;
  const pillWidth = textWidth + paddingX * 2;
  const pillHeight = h * 0.045;
  const pillX = w / 2 - pillWidth / 2;
  const pillY = y - pillHeight / 2;
  const pillRadius = pillHeight / 2;
  
  ctx.globalAlpha = detectionAlertOpacity * pulse;
  
  // Pill background with red glow
  ctx.shadowColor = 'rgba(255, 60, 60, 0.8)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = 'rgba(180, 30, 30, 0.9)';
  ctx.beginPath();
  // Draw rounded rectangle manually for compatibility
  ctx.moveTo(pillX + pillRadius, pillY);
  ctx.lineTo(pillX + pillWidth - pillRadius, pillY);
  ctx.arc(pillX + pillWidth - pillRadius, pillY + pillRadius, pillRadius, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(pillX + pillRadius, pillY + pillHeight);
  ctx.arc(pillX + pillRadius, pillY + pillRadius, pillRadius, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  
  // Border
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, y);
  
  ctx.restore();
}

/**
 * Draws the detection timer (only for maze map)
 */
function drawDetectionTimer() {
  // Only show timer for maze map and when not full
  if (!ActiveMap.mazeData) return;
  if (detectionTimer >= DETECTION_TIMER_MAX) return;
  
  const ctx = main_ctx;
  const w = main_canvas.width;
  const h = main_canvas.height;
  
  // Position at bottom center
  const timerX = w / 2;
  const timerY = h - 100;
  
  // Calculate timer percentage
  const timerPercent = detectionTimer / DETECTION_TIMER_MAX;
  
  // Determine color based on timer level
  let timerColor;
  if (timerPercent > 0.6) {
    timerColor = 'rgba(100, 255, 100, 0.9)'; // Green
  } else if (timerPercent > 0.3) {
    timerColor = 'rgba(255, 200, 50, 0.9)'; // Yellow/Orange
  } else {
    // Red with pulsing effect when low
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.015);
    timerColor = `rgba(255, 50, 50, ${0.9 * pulse})`;
  }
  
  // Format timer with 2 decimal places
  const timerText = detectionTimer.toFixed(2) + 's';
  
  ctx.save();
  
  // Draw timer background bar
  const barWidth = 200;
  const barHeight = 20;
  const barX = timerX - barWidth / 2;
  const barY = timerY - barHeight / 2;
  
  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(barX - 5, barY - 5, barWidth + 10, barHeight + 10);
  
  // Timer bar border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barWidth, barHeight);
  
  // Timer bar fill
  ctx.fillStyle = timerColor;
  ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * timerPercent, barHeight - 4);
  
  // Timer text (centered above bar)
  ctx.font = `bold ${Math.floor(h * 0.025)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = timerColor;
  ctx.fillText(timerText, timerX, timerY - barHeight - 5);
  
  // Label (below bar)
  ctx.font = `${Math.floor(h * 0.015)}px Arial`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.textAlign = 'center';
  ctx.fillText('ALERT', timerX, timerY + barHeight);
  
  ctx.restore();
}

/**
 * Draws the game over screen
 */
function drawGameOverScreen() {
  if (!isGameOver) return;
  
  const ctx = main_ctx;
  const w = main_canvas.width;
  const h = main_canvas.height;
  
  ctx.save();
  
  // Dark overlay with fade effect
  ctx.fillStyle = 'rgba(20, 0, 0, 0.85)';
  ctx.fillRect(0, 0, w, h);
  
  // Red vignette effect
  const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
  gradient.addColorStop(0, 'rgba(50, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(100, 0, 0, 0.5)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  
  // Pulsing effect
  const pulse = 0.85 + 0.15 * Math.sin(performance.now() * 0.003);
  
  // "CAUGHT" text
  ctx.font = `bold ${Math.floor(h * 0.12)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Text shadow/glow
  ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = `rgba(255, 50, 50, ${pulse})`;
  ctx.fillText('CAUGHT', w / 2, h * 0.4);
  
  // Subtitle
  ctx.shadowBlur = 0;
  ctx.font = `${Math.floor(h * 0.035)}px Arial`;
  ctx.fillStyle = 'rgba(255, 150, 150, 0.8)';
  ctx.fillText('You were detected for too long!', w / 2, h * 0.52);
  
  // Instructions
  ctx.font = `${Math.floor(h * 0.03)}px Arial`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText('Press R to restart', w / 2, h * 0.65);
  
  ctx.restore();
}

/**
 * Draws instructions for the maze map
 */
function drawMazeInstructions() {
  // Only show for maze map and when not dismissed
  if (!ActiveMap.mazeData || !showInstructions) return;
  
  const ctx = main_ctx;
  const w = main_canvas.width;
  const h = main_canvas.height;
  
  ctx.save();
  
  // Semi-transparent background panel
  const panelWidth = w * 0.5;
  const panelHeight = h * 0.4;
  const panelX = (w - panelWidth) / 2;
  const panelY = h * 0.1;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  
  // Border with pulsing effect
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.003);
  ctx.strokeStyle = `rgba(100, 200, 255, ${pulse})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
  
  // Title
  ctx.fillStyle = '#00ccff';
  ctx.font = `bold ${Math.floor(h * 0.04)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('MAZE CHALLENGE', w / 2, panelY + h * 0.02);
  
  // Instructions
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = `${Math.floor(h * 0.022)}px Arial`;
  ctx.textAlign = 'left';
  
  const instructionX = panelX + panelWidth * 0.1;
  let instructionY = panelY + h * 0.09;
  const lineHeight = h * 0.035;
  
  const instructions = [
    'OBJECTIVE:',
    '  • Start from the BLUE zone',
    '  • Navigate to the GREEN zone',
    '  • Avoid detection by enemies',
    '',
    'HINTS:',
    '  • Press P to reveal the path (3 seconds, one-time use)',
    '  • Emergency path help activates if alert drops critically low'
  ];
  
  instructions.forEach((line, index) => {
    if (line.startsWith('OBJECTIVE:') || line.startsWith('HINTS:')) {
      ctx.fillStyle = '#ffaa00';
      ctx.font = `bold ${Math.floor(h * 0.024)}px Arial`;
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = `${Math.floor(h * 0.022)}px Arial`;
    }
    ctx.fillText(line, instructionX, instructionY);
    instructionY += lineHeight;
  });
  
  // Dismissal prompt with pulsing effect
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(100, 255, 100, ${pulse})`;
  ctx.font = `bold ${Math.floor(h * 0.028)}px Arial`;
  ctx.fillText('Press ENTER or SPACE to start', w / 2, panelY + panelHeight - h * 0.05);
  
  ctx.restore();
}

/**
 * Draws the path expiry timer when path is active
 */
function drawPathExpiryTimer() {
  if (!showPath || !ActiveMap.mazeData) return;
  
  const ctx = main_ctx;
  const w = main_canvas.width;
  const h = main_canvas.height;
  
  // Calculate remaining time
  const elapsed = performance.now() - pathRevealTime;
  const remaining = PATH_DISPLAY_DURATION - elapsed;
  const remainingSeconds = Math.max(0, remaining / 1000);
  
  ctx.save();
  
  // Position at top center
  const timerX = w / 2;
  const timerY = h * 0.08;
  
  // Timer bar dimensions
  const barWidth = 200;
  const barHeight = 25;
  const barX = timerX - barWidth / 2;
  const barY = timerY - barHeight / 2;
  
  // Calculate percentage
  const percentage = remainingSeconds / (PATH_DISPLAY_DURATION / 1000);
  
  // Color based on remaining time
  let barColor;
  if (percentage > 0.6) {
    barColor = 'rgba(100, 255, 100, 0.9)'; // Green
  } else if (percentage > 0.3) {
    barColor = 'rgba(255, 200, 50, 0.9)'; // Yellow
  } else {
    // Red with pulsing when low
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.02);
    barColor = `rgba(255, 50, 50, ${0.9 * pulse})`;
  }
  
  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(barX - 5, barY - 5, barWidth + 10, barHeight + 10);
  
  // Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barWidth, barHeight);
  
  // Fill bar
  ctx.fillStyle = barColor;
  ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * percentage, barHeight - 4);
  
  // Timer text
  ctx.font = `bold ${Math.floor(h * 0.022)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = barColor;
  ctx.fillText(remainingSeconds.toFixed(1) + 's', timerX, timerY);
  
  // Label above
  ctx.font = `${Math.floor(h * 0.018)}px Arial`;
  ctx.fillStyle = 'rgba(255, 200, 50, 0.9)';
  ctx.fillText('PATH ACTIVE', timerX, timerY - barHeight - 5);
  
  ctx.restore();
}

/**
 * Draws the map selector UI
 */
function drawMapSelector() {
  if (!showMapSelector) return;
  
  const ctx = main_ctx;
  const w = main_canvas.width;
  const h = main_canvas.height;
  
  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(0, 0, w, h);
  
  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.floor(h * 0.06)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SELECT MAP', w * 0.5, h * 0.15);
  
  // Instructions
  ctx.font = `${Math.floor(h * 0.025)}px Arial`;
  ctx.fillStyle = '#888888';
  ctx.fillText('Use ↑↓ arrows or number keys (1-9) to select, Enter to confirm, M/Tab to close', w * 0.5, h * 0.22);
  
  // Map list
  const startY = h * 0.32;
  const itemHeight = h * 0.1;
  
  for (let i = 0; i < gameMaps.length; i++) {
    const map = gameMaps[i];
    const y = startY + i * itemHeight;
    const isSelected = i === selectedMapIndex;
    const isActive = map.name === ActiveMap.name;
    
    // Selection background
    if (isSelected) {
      ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
      ctx.fillRect(w * 0.2, y - itemHeight * 0.4, w * 0.6, itemHeight * 0.8);
      
      // Border
      ctx.strokeStyle = '#6699ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.2, y - itemHeight * 0.4, w * 0.6, itemHeight * 0.8);
    }
    
    // Map number
    ctx.fillStyle = isSelected ? '#ffffff' : '#666666';
    ctx.font = `bold ${Math.floor(h * 0.04)}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}.`, w * 0.25, y);
    
    // Map name
    ctx.fillStyle = isSelected ? '#ffffff' : '#aaaaaa';
    ctx.font = `${Math.floor(h * 0.04)}px Arial`;
    ctx.fillText(map.name, w * 0.32, y);
    
    // Active indicator
    if (isActive) {
      ctx.fillStyle = '#44ff44';
      ctx.font = `${Math.floor(h * 0.025)}px Arial`;
      ctx.textAlign = 'right';
      ctx.fillText('(CURRENT)', w * 0.75, y);
    }
    
    // Map size info
    ctx.fillStyle = '#666666';
    ctx.font = `${Math.floor(h * 0.02)}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText(`${map.size.width}x${map.size.height} units`, w * 0.32, y + itemHeight * 0.25);
  }
}

function setUpGame() {
  resizeCanvas({ canvasArray: [main_canvas, background_canvas], ratio: 16 / 9 });
  drawBackground(background_ctx, background_canvas.height, background_canvas.width);

  // Add textures
  textures.addTexture("wall", './images/wall_texture_1.jpg');
  textures.addTexture("edge", './images/wall_texture_2.png');
  textures.addTexture("enemySprite0", './images/00.png');  // Front
  textures.addTexture("enemySprite1", './images/10.png');  // Front-left
  textures.addTexture("enemySprite2", './images/20.png');  // Left
  textures.addTexture("enemySprite3", './images/30.png');  // Back-left
  textures.addTexture("enemySprite4", './images/40.png');  // Back

  // Add maps
  gameMaps.push(createTestMap(textures, 'Test Map'));
  
  // Add procedural maze map with thick walls
  gameMaps.push(createMazeMap(textures, 'Maze Map', {
    cols: 20,
    rows: 20,
    cellSize: 90,
    wallThickness: 15,
    curveChance: 1.0,   // All corners curved
    loopChance: 0.1,    // 10% chance for extra passages (creates forks)
    roomCount: 2,       // 2 open rooms
    roomMinSize: 2,
    roomMaxSize: 4,
    enemyCount: 15      // More enemies for challenge
  }));
  
  // Add showcase map with all wall features
  gameMaps.push(createShowcaseMap(textures, 'Showcase Map'));
  
  // Add enemy testing map
  gameMaps.push(createEnemyTestMap(textures, 'Enemy Test'));

  // Create user
  player = new Player({ x: 0, y: 0 });

  // Set active map - change to 'Maze Map' to play the maze
  setActiveMap(gameMaps, 'Maze Map');
}

function draw() {
  main_ctx.clearRect(0, 0, main_canvas.width, main_canvas.height);
  
  // Redraw background with current eye height for parallax effect
  drawBackground(background_ctx, background_canvas.height, background_canvas.width, player.eyeHeight);

  // Calculate real delta time for timer (independent of game deltaTime)
  const currentTime = performance.now();
  const realDeltaSeconds = (currentTime - lastFrameTime) / 1000;
  lastFrameTime = currentTime;

  const deltaTime = getDeltaTime(120);

  // If instructions are showing, only render scene but don't update
  if (showInstructions && ActiveMap.mazeData) {
    const scene = player.getScene(boundaries);
    render3D(scene, player.eyeHeight);
    drawMinimap(main_ctx, boundaries, player, enemies, ActiveMap.goalZone, ActiveMap.startZone, currentPath);
    drawMazeInstructions();
    return;
  }
  
  // If game over, only render scene but don't update
  if (isGameOver) {
    const scene = player.getScene(boundaries);
    render3D(scene, player.eyeHeight);
    drawMinimap(main_ctx, boundaries, player, enemies, ActiveMap.goalZone, ActiveMap.startZone, currentPath);
    drawDetectionTimer();
    drawGameOverScreen();
    return;
  }

  // Update animated boundaries
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];
    if (boundary.isAnimated) {
      boundary.update();
    }
  }

  const scene = player.getScene(boundaries);
  render3D(scene, player.eyeHeight);
  player.update(deltaTime, boundaries);

  // Track if any enemy detects the player this frame
  isPlayerDetected = false;
  
  enemies.forEach(enemy => {
    enemy.update(deltaTime);
    const detected = enemy.detectPlayer(player, boundaries);
    if (detected.isDetected) {
      isPlayerDetected = true;
      enemy.viewDirection = Math.atan2(detected.userPosition.y - enemy.pos.y, detected.userPosition.x - enemy.pos.x) * 180 / Math.PI;
    }

    const enemyBoundary = boundaries.find(b => b.uniqueID === enemy.id);
    if (enemyBoundary) {
      enemyBoundary.updatePosition(enemy.pos.x, enemy.pos.y);
      
      // Billboard: rotate boundary to always face the player
      // The original boundary is vertical (90°). To make it perpendicular to the 
      // line of sight (angleToPlayer), we rotate it by angleToPlayer so the
      // boundary runs perpendicular to the player's view direction.
      const angleToPlayer = Math.atan2(player.pos.y - enemy.pos.y, player.pos.x - enemy.pos.x) * 180 / Math.PI;
      enemyBoundary.rotateBoundary(angleToPlayer);
      
      // Set the enemy's actual facing direction for 8-directional sprite frame calculation
      enemyBoundary.setFacingDirection(enemy.viewDirection);
    }
  });

  // Update detection timer (only for maze map)
  if (ActiveMap.mazeData) {
    if (isPlayerDetected) {
      // Drain timer when detected
      detectionTimer -= DETECTION_DRAIN_RATE * realDeltaSeconds;
      timeSinceLastDetection = 0; // Reset regen delay
      if (detectionTimer <= 0) {
        detectionTimer = 0;
        isGameOver = true;
      }
      
      // Check if player reached critical alert level and hasn't used path regen yet
      if (detectionTimer <= CRITICAL_ALERT_THRESHOLD && !pathRegenerated) {
        // Regenerate path as emergency help
        pathRegenerated = true;
        showPath = true;
        pathRevealTime = performance.now();
        currentPath = findMazePath(
          ActiveMap.mazeData,
          ActiveMap.startZone,
          player.pos,
          ActiveMap.goalZone
        );
        // Don't log to console - keep it subtle
      }
    } else {
      // Track time since last detection
      timeSinceLastDetection += realDeltaSeconds;
      
      // Only regenerate after delay has passed AND not crouching
      // (crouching prevents regen - you must stand to recover)
      if (timeSinceLastDetection >= DETECTION_REGEN_DELAY && !player.isCrouching) {
        detectionTimer += DETECTION_REGEN_RATE * realDeltaSeconds;
        if (detectionTimer > DETECTION_TIMER_MAX) {
          detectionTimer = DETECTION_TIMER_MAX;
        }
      }
    }
  }

  // Update path if showing (recalculate based on current player position)
  if (showPath && ActiveMap.mazeData) {
    // Check if 3 seconds have passed
    if (performance.now() - pathRevealTime >= PATH_DISPLAY_DURATION) {
      showPath = false;
      currentPath = null;
      console.log('Path reveal expired');
    } else {
      currentPath = findMazePath(
        ActiveMap.mazeData,
        ActiveMap.startZone,
        player.pos,
        ActiveMap.goalZone
      );
    }
  }
  
  drawMinimap(main_ctx, boundaries, player, enemies, ActiveMap.goalZone, ActiveMap.startZone, currentPath);

  drawFPS(main_canvas.width, main_canvas.height, main_ctx);
  
  // Draw path expiry timer (when path is active)
  drawPathExpiryTimer();
  
  // Draw detection alert at bottom center
  drawDetectionAlert();
  
  // Draw detection timer (maze map only)
  drawDetectionTimer();
  
  // Draw game over screen if applicable
  drawGameOverScreen();
  
  // Draw map selector overlay
  drawMapSelector();
}

// ============ GAME LOOP OPTIONS ============
// Set to true for uncapped FPS, false for vsync-locked 60fps
const UNCAPPED_FPS = false;

let isRunning = false;

function startGameLoop() {
  if (isRunning) return;
  isRunning = true;
  
  if (UNCAPPED_FPS) {
    // Uncapped: Use while loop with periodic yields for smooth performance
    runUncappedLoop();
  } else {
    // VSync locked: Use requestAnimationFrame
    runVsyncLoop();
  }
}

// Uncapped FPS loop - runs as fast as possible
function runUncappedLoop() {
  const channel = new MessageChannel();
  
  channel.port1.onmessage = () => {
    if (!isRunning) return;
    draw();
    channel.port2.postMessage(null);
  };
  
  // Start the loop
  channel.port2.postMessage(null);
}

// VSync-locked loop using requestAnimationFrame
function runVsyncLoop() {
  function loop() {
    if (!isRunning) return;
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// Stop the game loop (useful for debugging)
function stopGameLoop() {
  isRunning = false;
}

// Expose for console debugging
window.stopGameLoop = stopGameLoop;
window.startGameLoop = startGameLoop;

setUpGame();
textures.setOnAllLoaded(() => {
  startGameLoop();
});