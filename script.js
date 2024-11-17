import Boundaries from "./classes/BoundariesClass.js";
import RayClass from "./classes/RayClass.js";
import Textures from "./classes/TexturesClass.js";
import UserCameraClass from "./classes/UserCameraClass.js";
import { getDeltaTime } from "./utils/deltaTime.js";
import { drawFPS } from "./utils/fpsDisplay.js";
import { render3D } from "./utils/render3DFunction.js";
import { drawBackground, drawMinimap, resizeCanvas } from "./utils/utils.js";

window.addEventListener('resize', ()=>{
  resizeCanvas({canvasArray: [main_canvas, background_canvas], ratio: 16/9});
  drawBackground(background_ctx, background_canvas.height, background_canvas.width);
});
resizeCanvas({canvasArray: [main_canvas, background_canvas], ratio: 16/9});
drawBackground(background_ctx, background_canvas.height, background_canvas.width);

const minimapScale = minimapSize / Math.max(main_canvas.width, main_canvas.height);

// Calculate the position for the bottom left corner of the main_canvas
const minimapX = 20;
const minimapY = main_canvas.height - minimapSize + 40;

/** @type {Boundaries[]} */
let boundaries = [];
/** @type {UserCameraClass} */
let user;

/** @type {Textures} */
const textures = new Textures();

// Add textures
textures.addTexture("wall", './images/wall_texture_1.jpg');
textures.addTexture("edge", './images/wall_texture_2.png');

// Draw boundaries around the main_canvas
boundaries.push(new Boundaries(0, 0, main_canvas.width, 0, textureImageEdge));
boundaries.push(new Boundaries(0, 0, 0, main_canvas.height, textureImageEdge));
boundaries.push(new Boundaries(0, main_canvas.height, main_canvas.width, main_canvas.height, textureImageEdge));
boundaries.push(new Boundaries(main_canvas.width, 0, main_canvas.width, main_canvas.height, textureImageEdge));

// Create walls
boundaries.push(new Boundaries(100, 100, 200, 100, textureImageWall));
boundaries.push(new Boundaries(200, 100, 200, 200, textureImageWall));
boundaries.push(new Boundaries(200, 200, 100, 200, textureImageWall));
boundaries.push(new Boundaries(100, 200, 100, 100, textureImageWall));

boundaries.push(new Boundaries(500, 100, 800, 300, textureImageWall));

user = new UserCameraClass({x: 20, y: 20,  fov: 60, rayCount: 1000});

main_canvas.addEventListener('keydown', (e) => {
  if (e.key === 'r') {
    user = new UserCameraClass({x: 20, y: 20, fov: 60, rayCount: 1000});
  } 
})

main_canvas.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    user.moveForwards = true;
  } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    user.moveBackwards = true;
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    user.moveRight = true;
  } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    user.moveLeft = true;
  }

  if(e.key === 'Shift'){
    user.moveSpeed = 3;
  }
});

main_canvas.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    user.moveForwards = false;
  } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    user.moveBackwards = false;
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    user.moveRight = false;
  } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    user.moveLeft = false;
  }

  if(e.key === 'Shift'){
    user.moveSpeed = 1;
  }
});

main_canvas.addEventListener('mousemove', (e) => {
  const currentTime = performance.now();
  var deltaTime = currentTime - prevTime;
  deltaTime = deltaTime === 0 ? 1 : deltaTime; // Prevent division by zero
  const deltaX = e.clientX - prevMouseX;
  const speed = Math.abs(deltaX) / deltaTime; // Calculate mouse movement speed
  
  user.viewDirection += Math.sign(deltaX) * speed * sensitivity; // Adjust fov rotation based on mouse movement speed

  prevMouseX = e.clientX;
  prevTime = currentTime;
  
  // Ensure the view direction stays within 0 to 360 degrees
  if (user.viewDirection < 0) {
    user.viewDirection += 360;
  } else if (user.viewDirection >= 360) {
    user.viewDirection -= 360;
  }

  // Update the rays based on the new view direction
  user.rays = [];
  for (let i = user.viewDirection - user.fov/2; i < user.viewDirection + user.fov/2; i += (user.fov / user.rayCount)) {
    user.rays.push(new RayClass(user.pos.x, user.pos.y, i * Math.PI / 180));
  }
});


function draw() {
  main_ctx.clearRect(0, 0, main_canvas.width, main_canvas.height);

  const deltaTime = getDeltaTime(120);

  const scene = user.spread(boundaries);
  render3D(scene);
  user.draw(deltaTime);

  drawMinimap(main_ctx, boundaries, user, minimapScale, minimapX, minimapY);

  drawFPS(main_canvas.width, main_canvas.height, main_ctx);

  requestAnimationFrame(draw);
}

textures.setOnAllLoaded(() => {
  draw();
});