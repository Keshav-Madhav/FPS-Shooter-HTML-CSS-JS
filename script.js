import Boundaries from "./classes/BoundariesClass.js";
import GameMap from "./classes/GameMapClass.js";
import Textures from "./classes/TexturesClass.js";
import Player from "./classes/UserClass.js";
import EnemyClass from "./classes/EnemyClass.js";
import { createTestMap } from "./maps/testMap.js";
import { createMazeMap } from "./maps/mazeMap.js";
import { createShowcaseMap } from "./maps/showcaseMap.js";
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

main_canvas.addEventListener('keydown', (e) => {
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
    // Reset player position
    player.pos = {x: ActiveMap.userSpawnLocation.x, y: ActiveMap.userSpawnLocation.y};
    player.updateViewDirection(ActiveMap.userViewDirection);
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
  textures.addTexture("cacoDemon", './images/caco-demon.png');

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

  // Create user
  player = new Player({ x: 0, y: 0 });

  // Set active map - change to 'Maze Map' to play the maze
  setActiveMap(gameMaps, 'Maze Map');
}

function draw() {
  main_ctx.clearRect(0, 0, main_canvas.width, main_canvas.height);
  
  // Redraw background with current eye height for parallax effect
  drawBackground(background_ctx, background_canvas.height, background_canvas.width, player.eyeHeight);

  const deltaTime = getDeltaTime(120);

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

  enemies.forEach(enemy => {
    enemy.update(deltaTime);
    const detected = enemy.detectPlayer(player, boundaries);
    if (detected.isDetected) {
      enemy.viewDirection = Math.atan2(detected.userPosition.y - enemy.pos.y, detected.userPosition.x - enemy.pos.x) * 180 / Math.PI;
    }

    const enemyBoundary = boundaries.find(b => b.uniqueID === enemy.id);
    if (enemyBoundary) {
      enemyBoundary.updatePosition(enemy.pos.x, enemy.pos.y);
      enemyBoundary.rotateBoundary(enemy.viewDirection);
    }
  });

  drawMinimap(main_ctx, boundaries, player, enemies);

  drawFPS(main_canvas.width, main_canvas.height, main_ctx);
  
  // Draw current map name and controls hint
  if (!showMapSelector) {
    main_ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    main_ctx.font = `${Math.floor(main_canvas.height * 0.02)}px Arial`;
    main_ctx.textAlign = 'left';
    main_ctx.textBaseline = 'top';
    main_ctx.fillText(`Map: ${ActiveMap.name}`, 10, 10);
    main_ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    main_ctx.fillText('Press M or Tab to change map | R to reset | 1-3 quick select', 10, 10 + main_canvas.height * 0.025);
  }
  
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