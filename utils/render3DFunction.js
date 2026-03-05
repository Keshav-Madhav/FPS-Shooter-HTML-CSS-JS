import Boundaries from "../classes/BoundariesClass.js";
import floorCaster from "./FloorCaster.js";
import lightingSystem from "./LightingSystem.js";
import { RenderConfig } from "../config/GameConfig.js";

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

// Rendering constants (from config)
const HEIGHT_SCALE_FACTOR = RenderConfig.heightScaleFactor;
const BRIGHTNESS_SCALE_FACTOR = RenderConfig.brightnessScaleFactor;
const PARALLAX_STRENGTH = RenderConfig.parallaxStrength;
const PITCH_STRENGTH = RenderConfig.pitchStrength;

// Distance threshold for LOD (Level of Detail) optimization
const LOD_DISTANCE_THRESHOLD = 500;

// Canvas dimensions cache
let cachedWidth = 0;
let cachedHeight = 0;
let cachedHalfHeight = 0;
let sliceWidth = 0;
let cachedBaseHeightMultiplier = 0;

// Pre-allocated typed arrays for performance
let brightnessCache = null;
let zBuffer = null;

/**
 * Updates cached canvas dimensions and reallocates buffers if needed
 */
function updateCanvasCache(width, height, rayCount) {
  if (width !== cachedWidth || height !== cachedHeight) {
    cachedWidth = width;
    cachedHeight = height;
    cachedHalfHeight = height * 0.5;
    sliceWidth = width / rayCount;
    cachedBaseHeightMultiplier = height * HEIGHT_SCALE_FACTOR;
  }

  if (!brightnessCache || brightnessCache.length !== rayCount) {
    brightnessCache = new Float32Array(rayCount);
    zBuffer = new Float32Array(rayCount);
  }
}

/**
 * Calculates brightness with exponential falloff (non-lighting mode)
 */
function calculateBrightness(distance) {
  if (distance === Infinity || distance <= 0) return 0;
  const normalized = BRIGHTNESS_SCALE_FACTOR / distance;
  if (normalized >= 1) return 1;
  return normalized * normalized;
}

// =============================================
// WALL RENDERING - LIGHTING MODE
// Black base + globalAlpha texture draw. No overlay pass (avoids sub-pixel banding).
// globalAlpha is batched per wall segment by the render loop.
// =============================================

/**
 * Renders a wall slice when lighting is active.
 * Black base prevents floor/ceiling bleed-through. globalAlpha controls brightness.
 * Single compositing step — no overlay = no banding.
 */
function renderWallSliceLit(ctx, x, y, w, h, texture, color, textureX) {
  if (texture && texture.complete) {
    const srcX = ((textureX * texture.width) | 0) % texture.width;
    ctx.drawImage(texture, srcX, 0, 1, texture.height, x, y, w, h);
  } else if (color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  } else {
    ctx.fillStyle = '#808080';
    ctx.fillRect(x, y, w, h);
  }
}

// =============================================
// WALL RENDERING - STANDARD MODE (no lighting)
// Original overlay approach, works fine with distance-based brightness.
// =============================================

/**
 * Renders a wall slice in standard (non-lighting) mode.
 */
function renderWallSliceStandard(ctx, x, y, w, h, texture, color, textureX, brightness, isTransparent) {
  if (!texture || !texture.complete) {
    if (color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
      if (brightness < 0.99 && !isTransparent) {
        const overlayAlpha = color.startsWith('rgba') || color.startsWith('hsla')
          ? (1 - brightness) * 0.7
          : 1 - brightness;
        ctx.fillStyle = `rgba(0,0,0,${overlayAlpha})`;
        ctx.fillRect(x, y, w, h);
      }
    } else {
      const gray = (128 * brightness) | 0;
      ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
      ctx.fillRect(x, y, w, h);
    }
    return;
  }

  const srcX = ((textureX * texture.width) | 0) % texture.width;
  ctx.drawImage(texture, srcX, 0, 1, texture.height, x, y, w, h);

  if (brightness < 0.99) {
    ctx.fillStyle = `rgba(0,0,0,${1 - brightness})`;
    ctx.fillRect(x, y, w, h);
  }
}

// =============================================
// TRANSPARENT / SPRITE RENDERING
// =============================================

function renderTranslucentSlice(ctx, x, y, width, height, texture, color, textureX, brightness, boundary = null, spriteTexture = null, mirrored = false) {
  // Handle colored translucent walls
  if (!texture || !texture.complete) {
    if (color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, width + 0.5, height);
      if (brightness < 0.95) {
        ctx.fillStyle = `rgba(0,0,0,${(1 - brightness) * 0.3})`;
        ctx.fillRect(x, y, width + 0.5, height);
      }
    }
    return;
  }

  // Individual directional sprites
  if (spriteTexture && spriteTexture.complete) {
    const spriteWidth = spriteTexture.width;
    const spriteHeight = spriteTexture.height;
    const SPRITE_SCALE = 0.5;
    const aspectRatio = spriteHeight / spriteWidth;
    const adjustedHeight = height * aspectRatio * SPRITE_SCALE;
    const adjustedY = y + (height - adjustedHeight) / 2;

    let srcX;
    if (mirrored) {
      srcX = ((1 - textureX) * spriteWidth) | 0;
    } else {
      srcX = (textureX * spriteWidth) | 0;
    }
    if (srcX < 0) srcX = 0;
    if (srcX >= spriteWidth) srcX = spriteWidth - 1;

    // In darkness, skip or dim sprites via globalAlpha (sprites are transparent PNGs,
    // so globalAlpha is correct — they're meant to blend with the background)
    if (_lightingEnabled) {
      if (brightness < 0.02) return; // invisible in darkness
      if (brightness < 0.99) ctx.globalAlpha = brightness;
    }

    ctx.drawImage(spriteTexture, srcX, 0, 1, spriteHeight, x, adjustedY, width + 0.5, adjustedHeight);

    if (_lightingEnabled && brightness < 0.99) {
      ctx.globalAlpha = 1;
    }
    return;
  }

  // Legacy sprite sheet
  const texWidth = texture.width;
  const texHeight = texture.height;

  if (boundary && boundary.spriteSheet) {
    const spriteColumns = boundary.spriteSheet.columns || 8;
    const spriteRows = boundary.spriteSheet.rows || 6;
    const spriteRowHeight = texHeight / spriteRows;

    let srcX = ((textureX * texWidth) | 0);
    if (srcX < 0) srcX = 0;
    if (srcX >= texWidth) srcX = texWidth - 1;

    ctx.drawImage(texture, srcX, 0, 1, spriteRowHeight, x, y, width + 0.5, height);
  } else {
    const srcX = ((textureX * texWidth) | 0) % texWidth;
    ctx.drawImage(texture, srcX, 0, 1, texHeight, x, y, width + 0.5, height);
  }
}

// =============================================
// FLOOR CASTING STATE
// =============================================

let _floorCastEnabled = true;
let _playerX = 0;
let _playerY = 0;
let _playerAngle = 0;
let _playerFov = 0;
let _lightingEnabled = false;

function setFloorCastingParams(params) {
  _playerX = params.playerX;
  _playerY = params.playerY;
  _playerAngle = params.playerAngle * (Math.PI / 180);
  _playerFov = params.fov * (Math.PI / 180);
  _floorCastEnabled = params.enabled ?? true;
  _lightingEnabled = params.lightingEnabled ?? false;
}

// =============================================
// MAIN RENDER FUNCTION
// =============================================

/**
 * Renders the 3D scene.
 *
 * @param {RayIntersection[]} scene - Ray intersection data.
 * @param {number} [eyeHeight=0] - Vertical camera position (-1 to 1)
 * @param {number} [pitch=0] - Vertical look angle (-1 to 1)
 */
function render3D(scene, eyeHeight = 0, pitch = 0) {
  const sceneLength = scene.length;
  updateCanvasCache(main_canvas.width, main_canvas.height, sceneLength);

  // --- First pass: brightness + z-buffer ---
  if (_lightingEnabled) {
    // Lighting mode: sample per wall segment to avoid per-column noise.
    // Consecutive rays on the same boundary share one brightness sample.
    let lastBoundary = null;
    let lastLitValue = 0;
    const RESAMPLE_INTERVAL = 6;

    for (let i = 0; i < sceneLength; i++) {
      const item = scene[i];
      const dist = item.distance;
      zBuffer[i] = dist;

      if (dist === Infinity) {
        brightnessCache[i] = 0;
        lastBoundary = null;
        continue;
      }

      const boundary = item.boundary;
      if (boundary !== lastBoundary || (i % RESAMPLE_INTERVAL === 0)) {
        const litBrightness = lightingSystem.calculateBrightnessOnly(item.hitX, item.hitY);
        const distFog = dist < 50 ? 1 : Math.min(1, 200 / dist);
        lastLitValue = litBrightness * distFog;
        lastBoundary = boundary;
      }

      brightnessCache[i] = lastLitValue;
    }
  } else {
    // Standard mode: distance-based brightness with neighbor smoothing
    for (let i = 0; i < sceneLength; i++) {
      const dist = scene[i].distance;
      brightnessCache[i] = calculateBrightness(dist);
      zBuffer[i] = dist;
    }
  }

  // --- Pitch offset (Y-shearing) ---
  const pitchOffset = pitch * cachedHeight * PITCH_STRENGTH;
  const horizonY = cachedHalfHeight + pitchOffset;

  // --- Floor and ceiling pass ---
  if (_floorCastEnabled && floorCaster.enabled) {
    floorCaster.updateDimensions(cachedWidth, cachedHeight);
    floorCaster.render(
      main_ctx, scene,
      _playerX, _playerY, _playerAngle, _playerFov,
      eyeHeight, pitchOffset
    );
  }

  // --- Second pass: opaque walls ---
  if (_lightingEnabled) {
    // Lit mode: two-pass — black base then texture at globalAlpha=brightness.
    // No overlay = no sub-pixel banding. globalAlpha = no bleed-through.
    const ctx = main_ctx;

    // Pass 1: black base fills (exact sliceWidth, no overlap)
    ctx.fillStyle = '#000';
    for (let i = 0; i < sceneLength; i++) {
      const { distance, heightMultiplier } = scene[i];
      if (distance === Infinity) continue;

      const brightness = brightnessCache[i];
      if (brightness < 0.005) continue;

      let wallHeight;
      if (heightMultiplier && heightMultiplier > 0) {
        wallHeight = heightMultiplier / distance;
      } else {
        wallHeight = cachedBaseHeightMultiplier / distance;
      }

      const verticalOffset = eyeHeight * wallHeight * PARALLAX_STRENGTH;
      const y = horizonY - wallHeight * 0.5 + verticalOffset;
      ctx.fillRect(i * sliceWidth, y, sliceWidth, wallHeight);
    }

    // Pass 2: textured walls at globalAlpha=brightness
    let currentAlpha = -1;
    for (let i = 0; i < sceneLength; i++) {
      const { distance, textureX, texture, color, heightMultiplier } = scene[i];
      if (distance === Infinity) continue;

      const brightness = brightnessCache[i];
      if (brightness < 0.005) continue;

      let wallHeight;
      if (heightMultiplier && heightMultiplier > 0) {
        wallHeight = heightMultiplier / distance;
      } else {
        wallHeight = cachedBaseHeightMultiplier / distance;
      }

      const verticalOffset = eyeHeight * wallHeight * PARALLAX_STRENGTH;
      const x = i * sliceWidth;
      const y = horizonY - wallHeight * 0.5 + verticalOffset;

      if (brightness !== currentAlpha) {
        ctx.globalAlpha = brightness;
        currentAlpha = brightness;
      }

      renderWallSliceLit(ctx, x, y, sliceWidth + 0.5, wallHeight, texture, color, textureX);
    }
    ctx.globalAlpha = 1;
  } else {
    // Standard mode: distance-based brightness with neighbor smoothing
    for (let i = 0; i < sceneLength; i++) {
      const { distance, textureX, texture, color, boundary, heightMultiplier } = scene[i];
      if (distance === Infinity) continue;

      let brightness;
      if (distance > LOD_DISTANCE_THRESHOLD) {
        brightness = brightnessCache[i];
      } else {
        let sum = brightnessCache[i];
        let count = 1;
        for (let d = 1; d <= 3; d++) {
          if (i - d >= 0) { sum += brightnessCache[i - d]; count++; }
          if (i + d < sceneLength) { sum += brightnessCache[i + d]; count++; }
        }
        brightness = sum / count;
      }

      let wallHeight;
      if (heightMultiplier && heightMultiplier > 0) {
        wallHeight = heightMultiplier / distance;
      } else {
        wallHeight = cachedBaseHeightMultiplier / distance;
      }

      const verticalOffset = eyeHeight * wallHeight * PARALLAX_STRENGTH;
      const y = horizonY - wallHeight * 0.5 + verticalOffset;
      const x = i * sliceWidth;
      const isTransparent = boundary && boundary.isTransparent;

      renderWallSliceStandard(main_ctx, x, y, sliceWidth + 0.5, wallHeight, texture, color, textureX, brightness, isTransparent);
    }
  }

  // --- Third pass: transparent / sprites ---
  const transparentSlices = [];

  for (let i = 0; i < sceneLength; i++) {
    const { transparentHits } = scene[i];
    if (transparentHits && transparentHits.length > 0) {
      for (let j = 0; j < transparentHits.length; j++) {
        const hit = transparentHits[j];
        if (hit.distance < zBuffer[i]) {
          transparentSlices.push({
            rayIndex: i,
            distance: hit.distance,
            textureX: hit.textureX,
            texture: hit.texture,
            color: hit.color,
            boundary: hit.boundary,
            spriteTexture: hit.spriteTexture || null,
            mirrored: hit.mirrored || false,
            hitX: hit.point ? hit.point.x : 0,
            hitY: hit.point ? hit.point.y : 0
          });
        }
      }
    }
  }

  if (transparentSlices.length > 1) {
    transparentSlices.sort((a, b) => b.distance - a.distance);
  }

  for (let i = 0; i < transparentSlices.length; i++) {
    const slice = transparentSlices[i];
    const { rayIndex, distance, textureX, texture, color, boundary, spriteTexture, mirrored } = slice;

    const sceneItem = scene[rayIndex];
    let wallHeight;
    if (sceneItem && sceneItem.heightMultiplier && sceneItem.heightMultiplier > 0) {
      wallHeight = sceneItem.heightMultiplier / distance;
    } else {
      wallHeight = cachedBaseHeightMultiplier / distance;
    }

    const verticalOffset = eyeHeight * wallHeight * PARALLAX_STRENGTH;
    const y = horizonY - wallHeight * 0.5 + verticalOffset;
    const x = rayIndex * sliceWidth;

    // Brightness for transparent hit
    let brightness;
    if (_lightingEnabled) {
      const litBrightness = lightingSystem.calculateBrightnessOnly(slice.hitX, slice.hitY);
      const distFog = distance < 50 ? 1 : Math.min(1, 200 / distance);
      brightness = litBrightness * distFog;
    } else {
      brightness = calculateBrightness(distance);
    }

    renderTranslucentSlice(main_ctx, x, y, sliceWidth, wallHeight, texture, color, textureX, brightness, boundary, spriteTexture, mirrored);
  }
}

export { render3D, setFloorCastingParams, floorCaster, lightingSystem };
