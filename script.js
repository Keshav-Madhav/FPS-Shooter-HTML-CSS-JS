// Get the canvas and its 2D rendering context
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const canvas2 = document.getElementById('canvas2');
const ctx2 = canvas2.getContext('2d');

// Resize the canvas to fit the window
window.addEventListener('resize', resizeCanvas);
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  canvas2.width = window.innerWidth;
  canvas2.height = window.innerHeight;
}
resizeCanvas();

// Arrays to store boundaries, rays, and light source
let boundaries = [];
let rays = [];
let light;

// Number of rays to cast
let rayCount = 800; // Current number of rays being cast

// Variables for touch event handling
let tapTime = 0;
let tapTimeout;

// Wall color
let wallColor = 'rgb(244,164,96)'; // Sandy Brown
let edgeColor = 'rgb(139,69,19)'; // Saddle Brown

// Maze dimensions
let mazeRows = 11;
let mazeCols = 23;
let cellWidth = canvas.width / mazeCols;
let cellHeight = canvas.height / mazeRows;

// Calculate the position of the top left corner of the maze
let mazeStartX = cellWidth;
let mazeStartY = cellHeight;

// Field of view for the light source
let fov = 60;
const fovHalf = fov / 2;
let viewDirection = 0;

// Define scaling factors to adjust wall heights and brightness separately
const heightScaleFactor = 0.02;
const brightnessScaleFactor = 2.5; 

// Variables to store the previous mouse position
let prevMouseX = 0;

// Movement for the light source
let moveSpeed = 0.0015;
let moveUp = false;
let moveDown = false;
let moveLeft = false;
let moveRight = false;

// Collision radius for the light source
const collisionRadius = 2;

// Sensitivity factor for rotation speed
const sensitivity = 3;
let prevTime = performance.now(); // Track the previous time

// Toggle top-down view
let topDown = true;
if(topDown){
  canvas2.style.display = 'block';
  canvas.style.display = 'none';
}
else{
  canvas2.style.display = 'none';
  canvas.style.display = 'block';
}

// Toggle texture display
let showTexture = false;

// Desried frames per second
const desiredFPS = 60;

// Load textures
const textureImageWall = new Image();
textureImageWall.src = 'wall_texture_1.jpg';
const textureImageEdge = new Image();
textureImageEdge.src = 'wall_texture_2.jpg';

// Class to create boundaries
class Boundaries {
  constructor(x1, y1, x2, y2, color, texture){
    this.a = {x: x1, y: y1};
    this.b = {x: x2, y: y2};
    this.color = color;
    this.texture = texture;
  }

  // Method to draw boundaries
  draw(){
    ctx.beginPath();
    ctx.moveTo(this.a.x, this.a.y);
    ctx.lineTo(this.b.x, this.b.y);
    ctx.strokeStyle = this.color;
    ctx.stroke();
  }
}

// Initialize maze with all walls
let maze = new Array(mazeRows);
for (let i = 0; i < mazeRows; i++) {
  maze[i] = new Array(mazeCols).fill(1);
}

// Recursive function to carve paths
function carve(x, y) {
  // Define the carving directions
  let directions = [
    [-1, 0], // Up
    [1, 0], // Down
    [0, -1], // Left
    [0, 1] // Right
  ];

  // Randomize the directions
  directions.sort(() => Math.random() - 0.5);

  // Try carving in each direction
  for (let [dx, dy] of directions) {
    let nx = x + dx * 2;
    let ny = y + dy * 2;

    if (nx >= 0 && nx < mazeRows && ny >= 0 && ny < mazeCols && maze[nx][ny] === 1) {
      maze[x + dx][y + dy] = 0;
      maze[nx][ny] = 0;
      carve(nx, ny);
    }
  }
}

// Start carving from the upper-left corner
carve(0, 0);
// Generate optimized boundaries for the maze
for (let i = 0; i < mazeRows; i++) {
  for (let j = 0; j < mazeCols; j++) {
    if (maze[i][j] === 1) {
      let x1 = j * cellWidth;
      let y1 = i * cellHeight;
      let x2 = (j + 1) * cellWidth;
      let y2 = (i + 1) * cellHeight;

      // Check the neighboring cells
      if (i > 0 && maze[i - 1][j] === 0) { // Top
        boundaries.push(new Boundaries(x1, y1, x2, y1, wallColor, textureImageWall));
      }
      if (j > 0 && maze[i][j - 1] === 0) { // Left
        boundaries.push(new Boundaries(x1, y1, x1, y2, wallColor, textureImageWall));
      }
      if (j < mazeCols - 1 && maze[i][j + 1] === 0) { // Right
        boundaries.push(new Boundaries(x2, y1, x2, y2, wallColor, textureImageWall));
      }
      if (i < mazeRows - 1 && maze[i + 1][j] === 0) { // Bottom
        boundaries.push(new Boundaries(x1, y2, x2, y2, wallColor, textureImageWall));
      }
    }
  }
}

// Draw boundaries around the canvas
boundaries.push(new Boundaries(0, 0, canvas.width, 0, edgeColor, textureImageEdge));
boundaries.push(new Boundaries(0, 0, 0, canvas.height, edgeColor, textureImageEdge));
boundaries.push(new Boundaries(0, canvas.height, canvas.width, canvas.height, edgeColor, textureImageEdge));
boundaries.push(new Boundaries(canvas.width, 0, canvas.width, canvas.height, edgeColor, textureImageEdge));


// // draw 5 random boundaries
// for (let i = 0; i < 5; i++) {
//   let x1 = Math.random() * canvas.width;
//   let y1 = Math.random() * canvas.height;
//   let x2 = Math.random() * canvas.width;
//   let y2 = Math.random() * canvas.height;
//   boundaries.push(new Boundaries(x1, y1, x2, y2, wallColor));
// }

// Class to create rays
class Rays {
  constructor(x, y, angle, color){
    this.pos = {x: x, y: y};
    this.dir = {x: Math.cos(angle), y: Math.sin(angle)};
    this.color = color;
  }

  // Method to draw rays
  draw(){
    ctx.beginPath();
    ctx.moveTo(this.pos.x, this.pos.y);
    ctx.lineTo(this.pos.x + this.dir.x * 5, this.pos.y + this.dir.y * 5);
    ctx.strokeStyle = this.color;
    ctx.stroke();

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

    if (t > 0 && t < 1 && u > 0){
      const point = {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1)
      }
      return point;
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
  
    let newX = light.pos.x + dx;
    let newY = light.pos.y + dy;
  
    // Check horizontal movement
    if (!isPointInWall(newX, light.pos.y)) {
      light.pos.x = newX;
    }
  
    // Check vertical movement
    if (!isPointInWall(light.pos.x, newY)) {
      light.pos.y = newY;
    }
  
    // Additional collision checks for corners
    const cornerChecks = [
      {x: light.pos.x - collisionRadius, y: light.pos.y - collisionRadius},
      {x: light.pos.x + collisionRadius, y: light.pos.y - collisionRadius},
      {x: light.pos.x - collisionRadius, y: light.pos.y + collisionRadius},
      {x: light.pos.x + collisionRadius, y: light.pos.y + collisionRadius}
    ];
  
    for (let point of cornerChecks) {
      if (isPointInWall(point.x, point.y)) {
        // Push the player slightly away from the wall
        const pushDistance = 1; // Adjust as needed
        if (point.x < light.pos.x) light.pos.x += pushDistance;
        if (point.x > light.pos.x) light.pos.x -= pushDistance;
        if (point.y < light.pos.y) light.pos.y += pushDistance;
        if (point.y > light.pos.y) light.pos.y -= pushDistance;
        break;
      }
    }
  }
}

// Class to create light sources
class lightSource {
  constructor(x, y, color, rayColor){
    this.pos = {x: x, y: y};
    this.rays = [];
    this.color = color;
    this.heading = 0;

    // Generate rays for the light source
    for (let i = viewDirection - fov/2; i < viewDirection + fov/2; i += (fov / rayCount)){
      this.rays.push(new Rays(this.pos.x, this.pos.y, i * Math.PI / 180, rayColor));
    }
  }

  // Method to draw light source and its rays
  draw(){
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

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
      let color = 'rgb(0, 0, 0)'
      let texture = textureImageWall;

      for (let boundary of boundaries) {
        const point = ray.cast(boundary);
        if (point) {
          let distance = Math.hypot(this.pos.x - point.x, this.pos.y - point.y);
          const angle = this.heading - ray.dir.x;
          distance *= Math.cos(angle);
          if (distance < record) {
            record = distance;
            closest = point;
            color = boundary.color;
            texture = boundary.texture;

            // Determine which part of the texture to use
            if (Math.abs(boundary.b.x - boundary.a.x) > Math.abs(boundary.b.y - boundary.a.y)) {
              // Horizontal wall, use x-coordinate
              textureX = (point.x - boundary.a.x) / (boundary.b.x - boundary.a.x);
            } else {
              // Vertical wall, use y-coordinate
              textureX = (point.y - boundary.a.y) / (boundary.b.y - boundary.a.y);
            }

            // Wrap the texture coordinate
            textureX = textureX % 1;
            if (textureX < 0) textureX += 1; // Ensure textureX is positive
          }
        }
      }

      if (closest) {
        ctx.beginPath();
        ctx.moveTo(this.pos.x, this.pos.y);
        ctx.lineTo(closest.x, closest.y);
        ctx.strokeStyle = this.color;
        ctx.stroke();
      }
      scene[i] = [record, color, textureX, texture];
    }
    return scene;
  }

  move(x, y) {
    let newPos = { x: x, y: y };
    this.pos = newPos;
  }

  rotate(angle) {
    this.heading += angle;
    for (let ray of this.rays) {
      ray.update(this.pos.x + Math.cos(ray.dir.x + angle), this.pos.y + Math.sin(ray.dir.y + angle));
    }
  }
}

light = new lightSource(mazeStartX - 30, mazeStartY - 30, 'rgba(255, 255, 237, 0.03)', 'rgba(255, 255, 0, 0.8)');

window.addEventListener('keydown', (e) => {
  if (e.key === 'r') {
    light = new lightSource(mazeStartX - 30, mazeStartY - 30, 'rgba(255, 255, 237, 0.03)', 'rgba(255, 255, 0, 0.8)');
  } 
  else if (e.key === 'p') {
    topDown = !topDown;
    if(topDown){
      canvas2.style.display = 'block';
      canvas.style.display = 'none';
    }
    else{
      canvas2.style.display = 'none';
      canvas.style.display = 'block';
    }
  }
  else if (e.key === 't') {
    showTexture = !showTexture;
  }
});

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
    moveSpeed = 0.003;
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
    moveSpeed = 0.0015;
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
    light.rays.push(new Rays(light.pos.x, light.pos.y, i * Math.PI / 180, 'rgba(255, 255, 0, 0.8)'));
  }
});

// Function to check if a point is within a wall
function isPointInWall(x, y) {
  const cellX = Math.floor(x / cellWidth);
  const cellY = Math.floor(y / cellHeight);
  
  // Check if the point is within the maze bounds
  if (cellX < 0 || cellX >= mazeCols || cellY < 0 || cellY >= mazeRows) {
    return true; // Treat out-of-bounds as a wall
  }
  
  return maze[cellY][cellX] === 1; // 1 represents a wall in your maze array
}

// Helper function to map a value from one range to another
function map(value, start1, stop1, start2, stop2) {
  return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
}

function draw3D(scene) {
  const w = canvas2.width / scene.length; // Width of each vertical strip on the screen

  for (let i = 0; i < scene.length; i++) {
    const rayAngle = viewDirection + map(i, 0, scene.length - 1, -fovHalf, fovHalf); // Angle of the ray
    const perpendicularDistance = scene[i][0] * Math.cos((rayAngle - viewDirection) * Math.PI / 180); // Calculate perpendicular distance

    // Calculate the wall height based on the perpendicular distance
    const wallHeight = canvas2.height / (perpendicularDistance * heightScaleFactor);

    // Calculate darkness based on distance and apply brightness scaling
    const brightness = map(perpendicularDistance*brightnessScaleFactor, 0, canvas2.width, 255, 30);

    if(!showTexture){
      // Extract the RGB values from the color string
      let [r, g, b] = scene[i][1].replace('rgb(', '').replace(')', '').split(',').map(Number);

      // Adjust the RGB values based on the brightness
      r = Math.max(0, Math.min(255, r * brightness / 255));
      g = Math.max(0, Math.min(255, g * brightness / 255));
      b = Math.max(0, Math.min(255, b * brightness / 255));

      // Draw the wall segment with adjusted brightness
      ctx2.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
      ctx2.fillRect(i * w, canvas2.height / 2 - wallHeight / 2, w + 1, wallHeight);
    } else {
      // Calculate the texture X coordinate (wrapping if needed)
      let textureX = scene[i][2] * scene[i][3].width;
      textureX = textureX % scene[i][3].width; // Wrap texture coordinate

      // Draw the wall segment using the texture
      ctx2.drawImage(
        scene[i][3], // Image source
        textureX, 0, 1, scene[i][3].height, // Source rectangle (1 pixel wide)
        i * w, canvas2.height / 2 - wallHeight / 2, // Destination rectangle top-left
        w + 1, wallHeight // Destination rectangle width and height
      );
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx2.clearRect(0, 0, canvas.width, canvas.height);
  
  // Create gradient for the top rectangle
  let gradient1 = ctx2.createLinearGradient(0, 0, 0, canvas.height / 2);
  gradient1.addColorStop(0, '#444444');
  gradient1.addColorStop(0.7, '#222222');
  gradient1.addColorStop(1, '#111111');
  
  ctx2.fillStyle = gradient1;
  ctx2.fillRect(0, 0, canvas.width, canvas.height / 2);
  
  // Create gradient for the bottom rectangle
  let gradient2 = ctx2.createLinearGradient(0, canvas.height / 2, 0, canvas.height);
  gradient2.addColorStop(0, '#001000');
  gradient2.addColorStop(0.3, '#006000');
  gradient2.addColorStop(1, '#006600');
  
  ctx2.fillStyle = gradient2;
  ctx2.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

  light.draw();
  const scene = light.spread(boundaries);

  draw3D(scene);

  for (let boundary of boundaries){
    boundary.draw();
  }

  drawFPS(topDown ? ctx2 : ctx);
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