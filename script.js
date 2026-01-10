import Boundaries from "./classes/BoundariesClass.js";
import GameMap from "./classes/GameMapClass.js";
import Textures from "./classes/TexturesClass.js";
import Player from "./classes/UserClass.js";
import EnemyClass from "./classes/EnemyClass.js";
import { createTestMap } from "./maps/testMap.js";
import { createMazeMap } from "./maps/mazeMap.js";
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
    player.moveSpeed = 3;
  }

  if (e.key === 'r') {
    player = new Player({x: ActiveMap.userSpawnLocation.x, y: ActiveMap.userSpawnLocation.y, viewDirection: ActiveMap.userViewDirection});
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
    player.moveSpeed = 1;
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

function setActiveMap(gameMaps, mapName) {
  ActiveMap = gameMaps.find(map => map.name === mapName);
  boundaries = ActiveMap.getBoundaries();

  enemies = ActiveMap.getEnemies();
  enemies.forEach(enemy => boundaries.push(enemy.skin));

  player.pos = {x: ActiveMap.userSpawnLocation.x, y: ActiveMap.userSpawnLocation.y};
  player.updateViewDirection(ActiveMap.userViewDirection);
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
    loopChance: 0.1,    // 20% chance for extra passages (creates forks)
    roomCount: 2,       // 5 open rooms
    roomMinSize: 2,
    roomMaxSize: 4,
    enemyCount: 12
  }));

  // Create user
  player = new Player({ x: 0, y: 0 });

  // Set active map - change to 'Maze Map' to play the maze
  setActiveMap(gameMaps, 'Maze Map');
}

function draw() {
  main_ctx.clearRect(0, 0, main_canvas.width, main_canvas.height);

  const deltaTime = getDeltaTime(120);

  // Update animated boundaries
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];
    if (boundary.isAnimated) {
      boundary.update();
    }
  }

  const scene = player.getScene(boundaries);
  render3D(scene);
  player.update(deltaTime);

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

  requestAnimationFrame(draw);
}

setUpGame();
textures.setOnAllLoaded(() => {
  draw();
});