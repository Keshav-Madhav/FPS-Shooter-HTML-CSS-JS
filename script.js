const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Resize the canvas to fit the window
window.addEventListener('resize', resizeCanvas);
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();

// Arrays to store boundaries, rays, and light source
let boundaries = [];
let rays = [];
let light;

// Number of rays to cast
let rayCount = 1000; // Current number of rays being cast

// Field of view for the light source
let fov = 60;
const fovHalf = fov / 2;
let viewDirection = 0;

// Define scaling factors to adjust wall heights and brightness separately
const heightScaleFactor = 100;
const brightnessScaleFactor = 200;

// Variables to store the previous mouse position
let prevMouseX = 0;

// Movement for the light source
let moveSpeed = 0.005;
let moveUp = false;
let moveDown = false;
let moveLeft = false;
let moveRight = false;

// Collision radius for the light source
const collisionRadius = 2;

// Sensitivity factor for rotation speed
const sensitivity = 3;
let prevTime = performance.now(); // Track the previous time

// Desried frames per second
const desiredFPS = 60;

// Load textures
const textureImageWall = new Image();
textureImageWall.src = 'wall_texture_1.jpg';
const textureImageEdge = new Image();
textureImageEdge.src = 'wall_texture_2.png';

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

// Class to create rays
class Rays {
  constructor(x, y, angle){
    this.pos = {x: x, y: y};
    this.dir = {x: Math.cos(angle), y: Math.sin(angle)};
  }

  // Method to draw rays
  draw(){
    this.updatePos();

    this.update(this.pos.x + this.dir.x * 10, this.pos.y + this.dir.y * 10);
  }

  setAngle(angle){
    this.dir = {x: Math.cos(angle), y: Math.sin(angle)};
  }

  // Method to update ray direction
  update(x, y){
    this.dir.x = x - this.pos.x;
    this.dir.y = y - this.pos.y;

    const length = Math.sqrt(this.dir.x * this.dir.x + this.dir.y * this.dir.y);
    this.dir.x /= length;
    this.dir.y /= length;
  }

  // Method to cast ray and detect intersections with boundaries
  cast(bound){
    const x1 = bound.a.x;
    const y1 = bound.a.y;

    const x2 = bound.b.x;
    const y2 = bound.b.y;

    const x3 = this.pos.x;
    const y3 = this.pos.y;

    const x4 = this.pos.x + this.dir.x;
    const y4 = this.pos.y + this.dir.y;

    const denominator = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4);
    const numeratorT = (x1-x3)*(y3-y4) - (y1-y3)*(x3-x4);
    const numeratorU = -((x1-x2)*(y1-y3) - (y1-y2)*(x1-x3));

    if (denominator == 0){
      return;
    }

    const t = numeratorT / denominator;
    const u = numeratorU / denominator;

    if (t > 0 && t < 1 && u > 0) {
      const point = {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1)
      };

      return {
        point,
        boundary: bound
      };
    } else {
      return;
    }
  }

  updatePos() {
    const moveDirection = Math.atan2(Math.sin(viewDirection * Math.PI / 180), Math.cos(viewDirection * Math.PI / 180));
    const strafeDirection = moveDirection + Math.PI / 2; // Perpendicular to move direction
  
    let dx = 0;
    let dy = 0;
  
    if (moveUp) {
      dx += moveSpeed * Math.cos(moveDirection);
      dy += moveSpeed * Math.sin(moveDirection);
    } 
    if (moveDown) {
      dx -= moveSpeed * Math.cos(moveDirection);
      dy -= moveSpeed * Math.sin(moveDirection);
    }
    if (moveRight) {
      dx += moveSpeed * Math.cos(strafeDirection);
      dy += moveSpeed * Math.sin(strafeDirection);
    }
    if (moveLeft) {
      dx -= moveSpeed * Math.cos(strafeDirection);
      dy -= moveSpeed * Math.sin(strafeDirection);
    }

    light.pos.x += dx;
    light.pos.y += dy;
  }
}

// Class to create light source
class lightSource {
  constructor(x, y,){
    this.pos = {x: x, y: y};
    this.rays = [];
    this.heading = 0;

    // Generate rays for the light source
    for (let i = viewDirection - fov/2; i < viewDirection + fov/2; i += (fov / rayCount)){
      this.rays.push(new Rays(this.pos.x, this.pos.y, i * Math.PI / 180));
    }
  }

  // Method to draw light source and its rays
  draw(){
    for(let ray of this.rays){
      ray.pos.x = this.pos.x;
      ray.pos.y = this.pos.y;
      ray.draw();
    }
  }

  // Method to spread rays and detect intersections with boundaries
  spread(boundaries) {
    const scene = [];
    for (let i = 0; i < this.rays.length; i++) {
        const ray = this.rays[i];
        let closest = null;
        let record = Infinity;
        let textureX = 0;
        let texture = null;
        let hitBoundary = null;

        for (let boundary of boundaries) {
            const result = ray.cast(boundary);
            if (result) {
                const { point, boundary: hitBound } = result;
                let distance = Math.hypot(this.pos.x - point.x, this.pos.y - point.y);
                const angle = Math.atan2(ray.dir.y, ray.dir.x) - viewDirection * Math.PI / 180;
                distance *= Math.cos(angle); // Fix fisheye effect
                if (distance < record) {
                    record = distance;
                    closest = point;
                    texture = hitBound.texture;
                    hitBoundary = hitBound;

                    // Determine which part of the texture to use
                    if (Math.abs(hitBound.b.x - hitBound.a.x) > Math.abs(hitBound.b.y - hitBound.a.y)) {
                        textureX = (point.x - hitBound.a.x) / (hitBound.b.x - hitBound.a.x);
                    } else {
                        textureX = (point.y - hitBound.a.y) / (hitBound.b.y - hitBound.a.y);
                    }

                    textureX = textureX % 1;
                    if (textureX < 0) textureX += 1;
                }
            }
        }

        scene[i] = {
            distance: record,
            textureX: textureX,
            texture: texture,
            boundary: hitBoundary
        };
    }
    return scene;
}
}

light = new lightSource(20, 20,);

window.addEventListener('keydown', (e) => {
  if (e.key === 'r') {
    light = new lightSource(20, 20);
  } 
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    moveUp = true;
  } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    moveDown = true;
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    moveRight = true;
  } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    moveLeft = true;
  }

  if(e.key === 'Shift'){
    moveSpeed = 0.01;
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    moveUp = false;
  } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    moveDown = false;
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    moveRight = false;
  } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    moveLeft = false;
  }

  if(e.key === 'Shift'){
    moveSpeed = 0.005;
  }
});

window.addEventListener('mousemove', (e) => {
  const currentTime = performance.now();
  const deltaTime = currentTime - prevTime;
  const deltaX = e.clientX - prevMouseX;
  const speed = Math.abs(deltaX) / deltaTime; // Calculate mouse movement speed
  
  viewDirection += Math.sign(deltaX) * speed * sensitivity; // Adjust fov rotation based on mouse movement speed

  prevMouseX = e.clientX;
  prevTime = currentTime;
  
  // Ensure the view direction stays within 0 to 360 degrees
  if (viewDirection < 0) {
    viewDirection += 360;
  } else if (viewDirection >= 360) {
    viewDirection -= 360;
  }

  // Update the rays based on the new view direction
  light.rays = [];
  for (let i = viewDirection - fov/2; i < viewDirection + fov/2; i += (fov / rayCount)) {
    light.rays.push(new Rays(light.pos.x, light.pos.y, i * Math.PI / 180));
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

  const scene = light.spread(boundaries);
  render3D(scene);

  light.draw();

  // Minimap (optional)
  const minimapSize = 150;
  const minimapScale = minimapSize / Math.max(canvas.width, canvas.height);
  ctx.save();
  ctx.scale(minimapScale, minimapScale);
  ctx.translate(10 / minimapScale, 10 / minimapScale);
  
  // Draw boundaries on minimap
  for (let boundary of boundaries) {
    ctx.beginPath();
    ctx.moveTo(boundary.a.x, boundary.a.y);
    ctx.lineTo(boundary.b.x, boundary.b.y);
    ctx.strokeStyle = 'white';
    ctx.stroke();
  }

  // Draw light source on minimap
  ctx.fillStyle = 'yellow';
  ctx.beginPath();
  ctx.arc(light.pos.x, light.pos.y, 1 / minimapScale, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  drawFPS(ctx);
}

// Check if all textures are loaded
let texturesLoaded = 0;
const totalTextures = 2; // Update this value if you have more textures

function checkTexturesLoaded() {
  texturesLoaded++;
  if (texturesLoaded === totalTextures) {
    createConstantFPSGameLoop(desiredFPS, draw);
  }
}
textureImageEdge.onload = checkTexturesLoaded;
textureImageWall.onload = checkTexturesLoaded;