import Boundaries from "../classes/BoundariesClass.js";

/**
 * @typedef {Object} RayHit
 * @property {number} distance - The perpendicular distance from the camera to the boundary.
 * @property {number} textureX - The normalized x-coordinate on the boundary's texture (0 to 1).
 * @property {HTMLImageElement|null} texture - The texture image of the intersected boundary.
 * @property {string|null} color - The solid color of the boundary (used when texture is null).
 * @property {Boundaries|null} boundary - The intersected boundary object.
 */

/**
 * @typedef {Object} RayIntersection
 * @property {number} distance - The perpendicular distance from the camera to the closest boundary.
 * @property {number} textureX - The normalized x-coordinate on the boundary's texture (0 to 1).
 * @property {HTMLImageElement|null} texture - The texture image of the intersected boundary.
 * @property {string|null} color - The solid color of the boundary (used when texture is null).
 * @property {Boundaries|null} boundary - The intersected boundary object.
 * @property {RayHit[]} [transparentHits] - Array of transparent boundary hits.
 */

// Rendering constants
const HEIGHT_SCALE_FACTOR = 100;
const BRIGHTNESS_SCALE_FACTOR = 100;
const DARKNESS_EXPONENT = 2.0;
const SMOOTHING_RADIUS = 3;

// Canvas dimensions cache
let cachedWidth = 0;
let cachedHeight = 0;
let cachedHalfHeight = 0;
let sliceWidth = 0;

// Pre-allocated typed arrays for performance
let brightnessCache = null;
let zBuffer = null; // 1D Z-buffer for occlusion

/**
 * Updates cached canvas dimensions and reallocates buffers if needed
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} rayCount - Number of rays in the scene
 */
function updateCanvasCache(width, height, rayCount) {
  if (width !== cachedWidth || height !== cachedHeight) {
    cachedWidth = width;
    cachedHeight = height;
    cachedHalfHeight = height * 0.5;
    sliceWidth = width / rayCount;
  }
  
  // Reallocate buffers if ray count changed
  if (!brightnessCache || brightnessCache.length !== rayCount) {
    brightnessCache = new Float32Array(rayCount);
    zBuffer = new Float32Array(rayCount);
  }
}

/**
 * Calculates brightness with exponential falloff
 * Optimized with early exit for infinity
 * @param {number} distance - Distance to the wall
 * @returns {number} Brightness value 0-1
 */
function calculateBrightness(distance) {
  if (distance === Infinity || distance <= 0) return 0;
  const normalized = BRIGHTNESS_SCALE_FACTOR / distance;
  // Fast path for close walls
  if (normalized >= 1) return 1;
  // Use multiplication instead of Math.pow for exponent 2
  return normalized * normalized;
}

/**
 * Renders a single wall slice with texture or solid color
 * Optimized to minimize state changes
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position on screen
 * @param {number} y - Y position on screen
 * @param {number} width - Slice width
 * @param {number} height - Wall height
 * @param {HTMLImageElement|null} texture - Texture image (or null for solid color)
 * @param {string|null} color - Solid color (used when texture is null)
 * @param {number} textureX - Texture X coordinate (0-1)
 * @param {number} brightness - Brightness value (0-1)
 * @param {boolean} isTransparent - Whether this wall has transparency
 */
function renderWallSlice(ctx, x, y, width, height, texture, color, textureX, brightness, isTransparent = false) {
  // Handle solid color walls
  if (!texture || !texture.complete) {
    if (color) {
      // Check if color has alpha (rgba format)
      if (color.startsWith('rgba') || color.startsWith('hsla')) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width + 0.5, height);
        // Apply brightness to transparent colors
        if (brightness < 0.99 && !isTransparent) {
          ctx.fillStyle = `rgba(0,0,0,${(1 - brightness) * 0.7})`;
          ctx.fillRect(x, y, width + 0.5, height);
        }
      } else if (color.startsWith('hsl(')) {
        // HSL color - apply brightness by modifying lightness
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width + 0.5, height);
        if (brightness < 0.99) {
          ctx.fillStyle = `rgba(0,0,0,${1 - brightness})`;
          ctx.fillRect(x, y, width + 0.5, height);
        }
      } else {
        // Solid color - apply brightness
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width + 0.5, height);
        if (brightness < 0.99) {
          ctx.fillStyle = `rgba(0,0,0,${1 - brightness})`;
          ctx.fillRect(x, y, width + 0.5, height);
        }
      }
    } else {
      // Fallback gray color
      const gray = (128 * brightness) | 0;
      ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
      ctx.fillRect(x, y, width + 0.5, height);
    }
    return;
  }
  
  const texWidth = texture.width;
  const texHeight = texture.height;
  
  // Calculate source X position on texture (1 pixel wide slice)
  // Use bitwise OR for fast floor
  const srcX = ((textureX * texWidth) | 0) % texWidth;
  
  // Draw the texture slice (add 0.5 to prevent gaps between slices)
  ctx.drawImage(
    texture,
    srcX, 0,           // Source position
    1, texHeight,      // Source dimensions (1 pixel column)
    x, y,              // Destination position
    width + 0.5, height // Destination dimensions
  );
  
  // Apply darkness overlay only if needed
  if (brightness < 0.99) {
    ctx.fillStyle = `rgba(0,0,0,${1 - brightness})`;
    ctx.fillRect(x, y, width + 0.5, height);
  }
}

/**
 * Renders a transparent/translucent slice (sprites or colored walls)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position on screen
 * @param {number} y - Y position on screen
 * @param {number} width - Slice width
 * @param {number} height - Wall height
 * @param {HTMLImageElement|null} texture - Texture image
 * @param {string|null} color - Solid color with alpha
 * @param {number} textureX - Texture X coordinate (0-1)
 * @param {number} brightness - Brightness value (0-1)
 */
function renderTranslucentSlice(ctx, x, y, width, height, texture, color, textureX, brightness) {
  // Handle colored translucent walls
  if (!texture || !texture.complete) {
    if (color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, width + 0.5, height);
      // Apply subtle brightness for depth
      if (brightness < 0.95) {
        ctx.fillStyle = `rgba(0,0,0,${(1 - brightness) * 0.3})`;
        ctx.fillRect(x, y, width + 0.5, height);
      }
    }
    return;
  }
  
  // Handle textured sprites
  const texWidth = texture.width;
  const texHeight = texture.height;
  const srcX = ((textureX * texWidth) | 0) % texWidth;
  
  ctx.drawImage(
    texture,
    srcX, 0,
    1, texHeight,
    x, y,
    width + 0.5, height
  );
}

/**
 * Renders the 3D scene by drawing wall slices with textures and darkness.
 * Optimized with:
 * - 1D Z-buffer for occlusion culling
 * - Pre-calculated brightness with smoothing
 * - Typed arrays for better memory performance
 * - Reduced draw calls and state changes
 * 
 * @param {RayIntersection[]} scene - An array of intersection data for each ray.
 */
function render3D(scene) {
  const sceneLength = scene.length;
  
  // Update dimension cache and allocate buffers
  updateCanvasCache(main_canvas.width, main_canvas.height, sceneLength);
  
  // First pass: Calculate all brightness values and initialize z-buffer
  for (let i = 0; i < sceneLength; i++) {
    const dist = scene[i].distance;
    brightnessCache[i] = calculateBrightness(dist);
    zBuffer[i] = dist; // Store distance for occlusion testing
  }
  
  // Second pass: Render opaque walls
  // Process in order (no sorting needed for opaque walls)
  for (let i = 0; i < sceneLength; i++) {
    const { distance, textureX, texture, color, boundary } = scene[i];
    
    // Skip rays that hit nothing
    if (distance === Infinity) continue;
    
    // Calculate smoothed brightness using neighboring rays
    let brightnessSum = brightnessCache[i];
    let count = 1;
    
    // Unrolled loop for common case (smoothingRadius = 3)
    const left3 = i - 3;
    const left2 = i - 2;
    const left1 = i - 1;
    const right1 = i + 1;
    const right2 = i + 2;
    const right3 = i + 3;
    
    if (left1 >= 0) { brightnessSum += brightnessCache[left1]; count++; }
    if (left2 >= 0) { brightnessSum += brightnessCache[left2]; count++; }
    if (left3 >= 0) { brightnessSum += brightnessCache[left3]; count++; }
    if (right1 < sceneLength) { brightnessSum += brightnessCache[right1]; count++; }
    if (right2 < sceneLength) { brightnessSum += brightnessCache[right2]; count++; }
    if (right3 < sceneLength) { brightnessSum += brightnessCache[right3]; count++; }
    
    const averageBrightness = brightnessSum / count;
    
    // Calculate wall height using perspective projection
    // Multiply by HEIGHT_SCALE_FACTOR / distance
    const wallHeight = (cachedHeight * HEIGHT_SCALE_FACTOR) / distance;
    const y = cachedHalfHeight - wallHeight * 0.5;
    const x = i * sliceWidth;
    
    const isTransparent = boundary && boundary.isTransparent;
    
    renderWallSlice(
      main_ctx,
      x, y,
      sliceWidth, wallHeight,
      texture,
      color,
      textureX,
      averageBrightness,
      isTransparent
    );
  }
  
  // Third pass: Collect and render transparent/translucent walls
  // Sort by distance (furthest first for correct alpha blending)
  const transparentSlices = [];
  
  for (let i = 0; i < sceneLength; i++) {
    const { transparentHits } = scene[i];
    
    if (transparentHits && transparentHits.length > 0) {
      for (let j = 0; j < transparentHits.length; j++) {
        const hit = transparentHits[j];
        // Only add if in front of the z-buffer (already checked in camera, but double-check)
        if (hit.distance < zBuffer[i]) {
          transparentSlices.push({
            rayIndex: i,
            distance: hit.distance,
            textureX: hit.textureX,
            texture: hit.texture,
            color: hit.color,
            boundary: hit.boundary
          });
        }
      }
    }
  }
  
  // Sort furthest first for correct alpha blending
  if (transparentSlices.length > 1) {
    transparentSlices.sort((a, b) => b.distance - a.distance);
  }
  
  // Render transparent/translucent slices
  for (let i = 0; i < transparentSlices.length; i++) {
    const slice = transparentSlices[i];
    const { rayIndex, distance, textureX, texture, color } = slice;
    
    const wallHeight = (cachedHeight * HEIGHT_SCALE_FACTOR) / distance;
    const y = cachedHalfHeight - wallHeight * 0.5;
    const x = rayIndex * sliceWidth;
    
    // Calculate brightness for this distance
    const brightness = calculateBrightness(distance);
    
    renderTranslucentSlice(main_ctx, x, y, sliceWidth, wallHeight, texture, color, textureX, brightness);
  }
}

export { render3D };
