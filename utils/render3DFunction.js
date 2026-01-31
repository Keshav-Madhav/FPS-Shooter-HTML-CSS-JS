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
const PARALLAX_STRENGTH = 0.5; // How much eye height affects wall position

// Distance threshold for LOD (Level of Detail) optimization
const LOD_DISTANCE_THRESHOLD = 500; // Beyond this, use simplified rendering

// Canvas dimensions cache
let cachedWidth = 0;
let cachedHeight = 0;
let cachedHalfHeight = 0;
let sliceWidth = 0;
let cachedBaseHeightMultiplier = 0; // For fallback when heightMultiplier not provided

// Pre-allocated typed arrays for performance
let brightnessCache = null;
let zBuffer = null; // 1D Z-buffer for occlusion

// Flag to track if we're using precomputed multipliers
let usePrecomputedMultipliers = false;

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
    cachedBaseHeightMultiplier = height * HEIGHT_SCALE_FACTOR;
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
 * Supports 8-directional sprites with individual images or sprite sheet
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position on screen
 * @param {number} y - Y position on screen
 * @param {number} width - Slice width
 * @param {number} height - Wall height
 * @param {HTMLImageElement|null} texture - Texture image
 * @param {string|null} color - Solid color with alpha
 * @param {number|Object} textureX - Texture X coordinate (0-1) or object with directional info
 * @param {number} brightness - Brightness value (0-1)
 * @param {Object|null} boundary - The boundary object (for sprite info)
 * @param {HTMLImageElement|null} spriteTexture - Individual sprite texture (for directional sprites)
 * @param {boolean} mirrored - Whether to mirror the sprite horizontally
 */
function renderTranslucentSlice(ctx, x, y, width, height, texture, color, textureX, brightness, boundary = null, spriteTexture = null, mirrored = false) {
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
  
  // Handle individual directional sprites (new system)
  if (spriteTexture && spriteTexture.complete) {
    const spriteWidth = spriteTexture.width;
    const spriteHeight = spriteTexture.height;
    
    // Scale factor to adjust sprite size (lower = smaller sprites)
    // Adjust this value to change how tall sprites appear
    const SPRITE_SCALE = 0.5;
    
    // Calculate aspect ratio to maintain proportions
    const aspectRatio = spriteHeight / spriteWidth;
    const adjustedHeight = height * aspectRatio * SPRITE_SCALE;
    
    // Center the sprite vertically
    const adjustedY = y + (height - adjustedHeight) / 2;
    
    // Calculate source X position
    // For mirrored sprites, we need to flip the textureX coordinate
    let srcX;
    if (mirrored) {
      // Flip the texture coordinate for mirroring
      srcX = ((1 - textureX) * spriteWidth) | 0;
    } else {
      srcX = (textureX * spriteWidth) | 0;
    }
    
    // Clamp to valid range
    if (srcX < 0) srcX = 0;
    if (srcX >= spriteWidth) srcX = spriteWidth - 1;
    
    ctx.drawImage(
      spriteTexture,
      srcX, 0,
      1, spriteHeight,
      x, adjustedY,
      width + 0.5, adjustedHeight
    );
    return;
  }
  
  // Handle textured sprites (legacy sprite sheet)
  const texWidth = texture.width;
  const texHeight = texture.height;
  
  // Check for 8-directional sprite sheet (legacy)
  if (boundary && boundary.spriteSheet) {
    const spriteColumns = boundary.spriteSheet.columns || 8;
    const spriteRows = boundary.spriteSheet.rows || 6;
    
    // Calculate exact pixel dimensions for each sprite cell
    const spriteWidth = texWidth / spriteColumns;
    const spriteRowHeight = texHeight / spriteRows;
    
    // textureX is already calculated to be in the correct frame range (0-1 total texture)
    // Convert to pixel position
    let srcX = ((textureX * texWidth) | 0);
    
    // Clamp to valid range
    if (srcX < 0) srcX = 0;
    if (srcX >= texWidth) srcX = texWidth - 1;
    
    // Only draw from the first row (directional sprites)
    ctx.drawImage(
      texture,
      srcX, 0,                    // Source X, Y (first row)
      1, spriteRowHeight,         // Source dimensions (1 pixel wide, first row height)
      x, y,                       // Destination position
      width + 0.5, height         // Destination dimensions
    );
  } else {
    // Regular sprite - use full texture height
    const srcX = ((textureX * texWidth) | 0) % texWidth;
    
    ctx.drawImage(
      texture,
      srcX, 0,
      1, texHeight,
      x, y,
      width + 0.5, height
    );
  }
}

/**
 * Renders the 3D scene by drawing wall slices with textures and darkness.
 * Optimized with:
 * - 1D Z-buffer for occlusion culling
 * - Pre-calculated brightness with smoothing
 * - Typed arrays for better memory performance
 * - Reduced draw calls and state changes
 * - Vertical parallax support for jumping and crouching
 * 
 * @param {RayIntersection[]} scene - An array of intersection data for each ray.
 * @param {number} [eyeHeight=0] - Vertical camera position (-1 to 1, 0 = center)
 *                                  Positive = looking from above, negative = from below
 */
function render3D(scene, eyeHeight = 0) {
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
  // Uses precomputed height multipliers when available for faster wall height calculation
  for (let i = 0; i < sceneLength; i++) {
    const { distance, textureX, texture, color, boundary, heightMultiplier } = scene[i];
    
    // Skip rays that hit nothing
    if (distance === Infinity) continue;
    
    // LOD optimization: skip brightness smoothing for distant walls
    let averageBrightness;
    if (distance > LOD_DISTANCE_THRESHOLD) {
      // Far walls: use raw brightness (faster)
      averageBrightness = brightnessCache[i];
    } else {
      // Near walls: calculate smoothed brightness using neighboring rays
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
      
      averageBrightness = brightnessSum / count;
    }
    
    // Calculate wall height using precomputed multiplier if available
    // With precomputed: wallHeight = heightMultiplier / distance (single divide)
    // Without precomputed: wallHeight = (height * SCALE) / distance (multiply + divide)
    let wallHeight;
    if (heightMultiplier && heightMultiplier > 0) {
      // Use precomputed multiplier (includes fisheye correction)
      wallHeight = heightMultiplier / distance;
    } else {
      // Fallback to manual calculation
      wallHeight = cachedBaseHeightMultiplier / distance;
    }
    
    // Distance-based parallax: closer walls (larger wallHeight) move more
    // Positive eyeHeight (jumping) = walls shift down, negative (crouching) = walls shift up
    // The offset is proportional to wallHeight, so close walls move more than distant ones
    const verticalOffset = eyeHeight * wallHeight * PARALLAX_STRENGTH;
    const y = cachedHalfHeight - wallHeight * 0.5 + verticalOffset;
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
            boundary: hit.boundary,
            spriteTexture: hit.spriteTexture || null,
            mirrored: hit.mirrored || false
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
    const { rayIndex, distance, textureX, texture, color, boundary, spriteTexture, mirrored } = slice;
    
    // Use precomputed height multiplier from the corresponding ray if available
    const sceneItem = scene[rayIndex];
    let wallHeight;
    if (sceneItem && sceneItem.heightMultiplier && sceneItem.heightMultiplier > 0) {
      wallHeight = sceneItem.heightMultiplier / distance;
    } else {
      wallHeight = cachedBaseHeightMultiplier / distance;
    }
    
    // Distance-based parallax for transparent walls too
    const verticalOffset = eyeHeight * wallHeight * PARALLAX_STRENGTH;
    const y = cachedHalfHeight - wallHeight * 0.5 + verticalOffset;
    const x = rayIndex * sliceWidth;
    
    // Calculate brightness for this distance
    const brightness = calculateBrightness(distance);
    
    renderTranslucentSlice(main_ctx, x, y, sliceWidth, wallHeight, texture, color, textureX, brightness, boundary, spriteTexture, mirrored);
  }
}

export { render3D };
