import Boundaries from "./classes/BoundariesClass.js";
import GameMap from "./classes/GameMapClass.js";
import Textures from "./classes/TexturesClass.js";
import UserCameraClass from "./classes/CameraClass.js";
import Player from "./classes/UserClass.js";
import { createTestMap } from "./maps/testMap.js";
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
  boundaries = ActiveMap.boundaries;
  player.pos = {x: ActiveMap.userSpawnLocation.x, y: ActiveMap.userSpawnLocation.y};
  player.updateViewDirection(ActiveMap.userViewDirection);
}

function setUpGame(){
  resizeCanvas({canvasArray: [main_canvas, background_canvas], ratio: 16/9});
  drawBackground(background_ctx, background_canvas.height, background_canvas.width);

  // Add textures
  textures.addTexture("wall", './images/wall_texture_1.jpg');
  textures.addTexture("edge", './images/wall_texture_2.png');

  // Add maps
  gameMaps.push(createTestMap(textures, 'Test Map'));

  // Create user
  player = new Player({x: 0, y: 0});

  // Set active map
  setActiveMap(gameMaps, 'Test Map');
}

function draw() {
  main_ctx.clearRect(0, 0, main_canvas.width, main_canvas.height);

  const deltaTime = getDeltaTime(120);

  const scene = player.getScene(boundaries);
  render3D(scene);
  player.update(deltaTime);

  drawMinimap(main_ctx, boundaries, player);

  drawFPS(main_canvas.width, main_canvas.height, main_ctx);

  boundaries[0].rotateBoundary(0.03);

  requestAnimationFrame(draw);
}

setUpGame();
textures.setOnAllLoaded(() => {
  draw();
});