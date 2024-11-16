import RayClass from "./classes/RayClass.js";
import UserCameraClass from "./classes/UserCameraClass.js";
import { drawFPS } from "./utils/fpsDisplay.js";

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Resize the canvas to fit the window
window.addEventListener('resize', resizeCanvas);
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();

// Arrays to store boundaries, rays, and user
let boundaries = [];
let rays = [];
let user;

// Field of view for the user
let fov = 60;
const fovHalf = fov / 2;

// Define scaling factors to adjust wall heights and brightness separately
const heightScaleFactor = 100;
const brightnessScaleFactor = 200;

// Variables to store the previous mouse position
let prevMouseX = 0;

// Minimap (optional)
const minimapSize = 150;
const minimapScale = minimapSize / Math.max(canvas.width, canvas.height);

// Calculate the position for the bottom left corner of the canvas
const minimapX = 20;
const minimapY = canvas.height - minimapSize + 40;

// Sensitivity factor for rotation speed
const sensitivity = 3;
let prevTime = performance.now(); // Track the previous time

// Desried frames per second
const desiredFPS = 60;

// Load textures
const textureImageWall = new Image();
textureImageWall.src = './images/wall_texture_1.jpg';
const textureImageEdge = new Image();
textureImageEdge.src = './images/wall_texture_2.png';

// Class to create boundaries
class Boundaries {
  constructor(x1, y1, x2, y2, texture){
    this.a = {x: x1, y: y1};
    this.b = {x: x2, y: y2};
    this.texture = texture;
  }
}

// Draw boundaries around the canvas
boundaries.push(new Boundaries(0, 0, canvas.width, 0, textureImageEdge));
boundaries.push(new Boundaries(0, 0, 0, canvas.height, textureImageEdge));
boundaries.push(new Boundaries(0, canvas.height, canvas.width, canvas.height, textureImageEdge));
boundaries.push(new Boundaries(canvas.width, 0, canvas.width, canvas.height, textureImageEdge));

// Create walls
boundaries.push(new Boundaries(100, 100, 200, 100, textureImageWall));
boundaries.push(new Boundaries(200, 100, 200, 200, textureImageWall));
boundaries.push(new Boundaries(200, 200, 100, 200, textureImageWall));
boundaries.push(new Boundaries(100, 200, 100, 100, textureImageWall));

boundaries.push(new Boundaries(500, 100, 800, 300, textureImageWall));

user = new UserCameraClass({x: 20, y: 20,  fov: 60, rayCount: 1000});

window.addEventListener('keydown', (e) => {
  if (e.key === 'r') {
    user = new UserCameraClass({x: 20, y: 20, fov: 60, rayCount: 1000});
  } 
})

window.addEventListener('keydown', (e) => {
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

window.addEventListener('keyup', (e) => {
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

window.addEventListener('mousemove', (e) => {
  const currentTime = performance.now();
  const deltaTime = currentTime - prevTime;
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
  for (let i = user.viewDirection - fov/2; i < user.viewDirection + fov/2; i += (fov / user.rayCount)) {
    user.rays.push(new RayClass(user.pos.x, user.pos.y, i * Math.PI / 180));
  }
});

function render3D(scene) {
  const w = canvas.width / scene.length;
  const smoothingRadius = 3; // Number of slices to take on each side for averaging

  for (let i = 0; i < scene.length; i++) {
    const { distance, textureX, texture } = scene[i];

    if (distance === Infinity) continue; // Skip if no wall was hit

    // Calculate the brightness of the current slice
    const currentBrightness = Math.min(1, brightnessScaleFactor / distance);

    // Collect brightness values of surrounding slices
    let brightnessSum = currentBrightness;
    let count = 1;

    for (let j = 1; j <= smoothingRadius; j++) {
      if (scene[i - j]) {
        const leftDistance = scene[i - j].distance;
        const leftBrightness = Math.min(1, brightnessScaleFactor / leftDistance);
        brightnessSum += leftBrightness;
        count++;
      }
      if (scene[i + j]) {
        const rightDistance = scene[i + j].distance;
        const rightBrightness = Math.min(1, brightnessScaleFactor / rightDistance);
        brightnessSum += rightBrightness;
        count++;
      }
    }

    // Calculate the average brightness
    const averageBrightness = brightnessSum / count;

    const wallHeight = (canvas.height / distance) * heightScaleFactor;
    const y = (canvas.height - wallHeight) / 2;

    // Draw the wall slice
    if (texture) {
      const textureY = 0;
      const textureWidth = texture.width;
      const textureHeight = texture.height;

      // Calculate the portion of the texture to use based on ray position
      const textureSliceWidth = textureWidth * w / canvas.width;

      // Calculate which section of the texture to draw
      const textureStartX = textureX * textureWidth;

      // Draw the image section
      ctx.drawImage(
        texture,
        textureStartX, textureY,
        textureSliceWidth, textureHeight,
        i * w, y,
        w, wallHeight
      );

      // Apply brightness with smoothing
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - averageBrightness})`;
      ctx.fillRect(i * w, y, w, wallHeight);
    } else {
      // Fallback if texture is not available
      ctx.fillStyle = `rgba(255, 255, 255, ${averageBrightness})`;
      ctx.fillRect(i * w, y, w, wallHeight);
    }
  }
}


function draw() {

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scene = user.spread(boundaries);
  render3D(scene);
  user.draw();

  ctx.save();
  ctx.scale(minimapScale, minimapScale);
  ctx.translate(minimapX / minimapScale, minimapY / minimapScale);

  // Draw boundaries on minimap
  for (let boundary of boundaries) {
    ctx.beginPath();
    ctx.moveTo(boundary.a.x, boundary.a.y);
    ctx.lineTo(boundary.b.x, boundary.b.y);
    ctx.strokeStyle = 'white';
    ctx.stroke();
  }

  // Draw user on minimap
  ctx.fillStyle = 'yellow';
  ctx.beginPath();
  ctx.arc(user.pos.x, user.pos.y, 1 / minimapScale, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  drawFPS(canvas.width, canvas.height, ctx);

  requestAnimationFrame(draw);
}

// Check if all textures are loaded
let texturesLoaded = 0;
const totalTextures = 2; // Update this value if you have more textures

function checkTexturesLoaded() {
  texturesLoaded++;
  if (texturesLoaded === totalTextures) {
    draw();
  }
}
textureImageEdge.onload = checkTexturesLoaded;
textureImageWall.onload = checkTexturesLoaded;