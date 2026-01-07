import Boundaries from "../classes/BoundariesClass.js";

/**
 * @typedef {Object} RayHit
 * @property {number} distance - The perpendicular distance from the camera to the boundary.
 * @property {number} textureX - The normalized x-coordinate on the boundary's texture (0 to 1).
 * @property {HTMLImageElement|null} texture - The texture image of the intersected boundary.
 * @property {Boundaries|null} boundary - The intersected boundary object.
 */

/**
 * @typedef {Object} RayIntersection
 * @property {number} distance - The perpendicular distance from the camera to the closest boundary.
 * @property {number} textureX - The normalized x-coordinate on the boundary's texture (0 to 1).
 * @property {HTMLImageElement|null} texture - The texture image of the intersected boundary.
 * @property {Boundaries|null} boundary - The intersected boundary object.
 * @property {RayHit[]} [transparentHits] - Array of transparent boundary hits.
 */

// Pre-calculated constants for performance
const TWO_PI = Math.PI * 2;

// Canvas dimensions cache (updated when canvas resizes)
let cachedWidth = 0;
let cachedHeight = 0;
let cachedHalfHeight = 0;
let sliceWidth = 0;

// Pre-allocated brightness array for smoothing
let brightnessCache = null;

/**
 * Updates cached canvas dimensions
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} rayCount - Number of rays in the scene
 */
function updateCanvasCache(width, height, rayCount) {
  if (width !== cachedWidth || height !== cachedHeight) {
    cachedWidth = width;
    cachedHeight = height;
    cachedHalfHeight = height / 2;
    sliceWidth = width / rayCount;
  }
  
  if (!brightnessCache || brightnessCache.length !== rayCount) {
    brightnessCache = new Float32Array(rayCount);
  }
}

/**
 * Calculates brightness with exponential falloff
 * @param {number} distance - Distance to the wall
 * @returns {number} Brightness value 0-1
 */
function calculateBrightness(distance) {
  if (distance === Infinity) return 0;
  return Math.pow(Math.min(1, brightnessScaleFactor / distance), darknessExponent);
}

/**
 * Renders a single wall slice with texture
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position on screen
 * @param {number} y - Y position on screen
 * @param {number} width - Slice width
 * @param {number} height - Wall height
 * @param {HTMLImageElement} texture - Texture image
 * @param {number} textureX - Texture X coordinate (0-1)
 * @param {number} brightness - Brightness value (0-1)
 * @param {boolean} isTransparent - Whether to use alpha blending
 */
function renderWallSlice(ctx, x, y, width, height, texture, textureX, brightness, isTransparent = false) {
  if (!texture || !texture.complete) {
    // Fallback solid color
    ctx.fillStyle = `rgba(128, 128, 128, ${brightness})`;
    ctx.fillRect(x, y, width, height);
    return;
  }
  
  const texWidth = texture.width;
  const texHeight = texture.height;
  
  // Calculate source X position on texture (1 pixel wide slice)
  const srcX = Math.floor(textureX * texWidth) % texWidth;
  const srcWidth = 1; // Sample 1 pixel wide column from texture
  
  // Draw the texture slice
  ctx.drawImage(
    texture,
    srcX, 0,           // Source position
    srcWidth, texHeight, // Source dimensions (1 pixel column)
    x, y,              // Destination position
    width + 0.5, height    // Destination dimensions (add 0.5 to prevent gaps)
  );
  
  // Apply darkness overlay
  if (brightness < 1) {
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - brightness})`;
    ctx.fillRect(x, y, width + 0.5, height);
  }
}

/**
 * Renders the 3D scene by drawing wall slices with textures and darkness.
 * Supports transparent textures (sprites) by rendering them on top of walls.
 * @param {RayIntersection[]} scene - An array of intersection data for each ray.
 */
function render3D(scene) {
  const sceneLength = scene.length;
  
  // Update dimension cache
  updateCanvasCache(main_canvas.width, main_canvas.height, sceneLength);
  
  // Pre-calculate all brightness values for smoothing
  for (let i = 0; i < sceneLength; i++) {
    brightnessCache[i] = calculateBrightness(scene[i].distance);
  }
  
  // First pass: Render opaque walls from back to front
  for (let i = 0; i < sceneLength; i++) {
    const { distance, textureX, texture, boundary } = scene[i];
    
    if (distance === Infinity) continue;
    
    // Calculate smoothed brightness
    let brightnessSum = brightnessCache[i];
    let count = 1;
    
    for (let j = 1; j <= smoothingRadius; j++) {
      if (i - j >= 0) {
        brightnessSum += brightnessCache[i - j];
        count++;
      }
      if (i + j < sceneLength) {
        brightnessSum += brightnessCache[i + j];
        count++;
      }
    }
    
    const averageBrightness = brightnessSum / count;
    
    // Calculate wall height using perspective projection
    const wallHeight = (cachedHeight / distance) * heightScaleFactor;
    const y = cachedHalfHeight - wallHeight / 2;
    const x = i * sliceWidth;
    
    renderWallSlice(
      main_ctx,
      x, y,
      sliceWidth, wallHeight,
      texture,
      textureX,
      averageBrightness,
      false
    );
  }
  
  // Second pass: Render transparent sprites (back to front for correct blending)
  // Collect all transparent hits with their screen position info
  const transparentSlices = [];
  
  for (let i = 0; i < sceneLength; i++) {
    const { transparentHits } = scene[i];
    
    if (transparentHits && transparentHits.length > 0) {
      for (const hit of transparentHits) {
        transparentSlices.push({
          rayIndex: i,
          ...hit
        });
      }
    }
  }
  
  // Sort by distance (furthest first for proper alpha blending)
  transparentSlices.sort((a, b) => b.distance - a.distance);
  
  // Render transparent slices (no darkening for sprites)
  for (const slice of transparentSlices) {
    const { rayIndex, distance, textureX, texture } = slice;
    
    const wallHeight = (cachedHeight / distance) * heightScaleFactor;
    const y = cachedHalfHeight - wallHeight / 2;
    const x = rayIndex * sliceWidth;
    
    // For transparent textures, draw without darkening effect
    if (texture && texture.complete) {
      const texWidth = texture.width;
      const texHeight = texture.height;
      const srcX = Math.floor(textureX * texWidth) % texWidth;
      
      // Draw with transparency preserved - no darkness overlay for sprites
      main_ctx.drawImage(
        texture,
        srcX, 0,
        1, texHeight,
        x, y,
        sliceWidth + 0.5, wallHeight
      );
    }
  }
}

export { render3D };