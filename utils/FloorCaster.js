import { RenderConfig } from "../config/GameConfig.js";
import lightingSystem from "./LightingSystem.js";

/**
 * FloorCaster - Performant floor and ceiling rendering with visual depth
 * Uses horizontal span rendering for efficiency
 * Supports floor zones for traps, jump indicators, etc.
 * 
 * Synchronized with wall rendering using the same projection math.
 */

// Performance settings
const FLOOR_RENDER_STEP = 1; // Render every Nth row (1 = full, 2 = half) - use 1 for best quality
const MAX_FLOOR_DISTANCE = RenderConfig.maxRenderDistance; // Max distance for floor calculations
const FLOOR_TILE_SIZE = 64; // Size of floor tiles in world units

// Ceiling light fixture appearance
const FIXTURE_RADIUS = 18;           // World-unit radius of the bright fixture spot
const FIXTURE_RADIUS_SQ = FIXTURE_RADIUS * FIXTURE_RADIUS;
const FIXTURE_GLOW_RADIUS = 40;      // Slightly larger warm glow around fixture
const FIXTURE_GLOW_RADIUS_SQ = FIXTURE_GLOW_RADIUS * FIXTURE_GLOW_RADIUS;

// Rendering constants (from config - must match wall rendering)
const HEIGHT_SCALE_FACTOR = RenderConfig.heightScaleFactor;
const PARALLAX_STRENGTH = RenderConfig.parallaxStrength;

/**
 * @typedef {Object} FloorZone
 * @property {number} x - Center X position
 * @property {number} y - Center Y position
 * @property {number} radius - Zone radius
 * @property {string} type - Zone type: 'jump', 'danger', 'slow', 'speed', 'pit'
 * @property {string} [color] - Override color
 * @property {number} [intensity] - Effect intensity 0-1
 */

class FloorCaster {
  constructor() {
    // Cache for floor rendering
    this.enabled = true;
    this.ceilingEnabled = true;
    
    // Floor appearance
    this.floorColor = { h: 20, s: 15, l: 25 }; // Warm brown/stone
    this.ceilingColor = { h: 210, s: 10, l: 35 }; // Cool gray/blue
    
    // Checkerboard pattern
    this.useCheckerboard = true;
    this.checkerboardDarkness = 0.85; // How much darker alternate tiles are
    
    // Floor zones (traps, jump areas, etc.)
    /** @type {FloorZone[]} */
    this.zones = [];
    
    // Pre-calculated values (updated on resize)
    this._width = 0;
    this._height = 0;
    this._halfHeight = 0;
    this._rowDistances = null; // Pre-calculated distance per row

    // Cached arrays (reused across frames to avoid GC pressure)
    this._rayDirs = null;
    this._rayDirsCount = 0;
    this._wallBottoms = null;
    this._wallTops = null;

    // Animation time for effects
    this._animTime = 0;

    // Whether to use dynamic lighting system
    this.lightingEnabled = false;
  }
  
  /**
   * Updates cached values when canvas size changes
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   */
  updateDimensions(width, height) {
    if (this._width === width && this._height === height) return;
    
    this._width = width;
    this._height = height;
    this._halfHeight = height * 0.5;
    
    // Pre-calculate row distances for floor casting
    // Distance = screenHeight / (2 * rowFromCenter)
    // This gives perspective-correct distance for each scanline
    const floorRows = Math.ceil(this._halfHeight / FLOOR_RENDER_STEP);
    this._rowDistances = new Float32Array(floorRows);
    
    for (let i = 0; i < floorRows; i++) {
      const rowFromCenter = (i * FLOOR_RENDER_STEP) + 1;
      this._rowDistances[i] = (height * 50) / rowFromCenter; // 50 = height scale factor
    }
  }
  
  /**
   * Adds a floor zone
   * @param {FloorZone} zone - Zone definition
   */
  addZone(zone) {
    this.zones.push({
      x: zone.x,
      y: zone.y,
      radius: zone.radius,
      radiusSq: zone.radius * zone.radius,
      type: zone.type || 'jump',
      color: zone.color || null,
      intensity: zone.intensity ?? 1.0
    });
  }
  
  /**
   * Clears all floor zones
   */
  clearZones() {
    this.zones = [];
  }
  
  /**
   * Sets zones from an array
   * @param {FloorZone[]} zones 
   */
  setZones(zones) {
    this.zones = zones.map(z => ({
      x: z.x,
      y: z.y,
      radius: z.radius,
      radiusSq: z.radius * z.radius,
      type: z.type || 'jump',
      color: z.color || null,
      intensity: z.intensity ?? 1.0
    }));
  }
  
  /**
   * Gets the zone at a world position (if any)
   * @param {number} worldX 
   * @param {number} worldY 
   * @returns {FloorZone|null}
   */
  getZoneAt(worldX, worldY) {
    for (let i = 0; i < this.zones.length; i++) {
      const zone = this.zones[i];
      const dx = worldX - zone.x;
      const dy = worldY - zone.y;
      if (dx * dx + dy * dy <= zone.radiusSq) {
        return zone;
      }
    }
    return null;
  }
  
  /**
   * Gets zone color based on type and animation
   * @param {FloorZone} zone 
   * @param {number} distanceFactor - 0-1, affects brightness
   * @returns {string} CSS color
   */
  _getZoneColor(zone, distanceFactor) {
    const pulse = 0.7 + 0.3 * Math.sin(this._animTime * 0.005);
    const intensity = zone.intensity * pulse;
    const alpha = 0.4 + 0.4 * intensity * distanceFactor;
    
    switch (zone.type) {
      case 'start':
        // Cyan/blue pulsing - start zone
        const startPulse = 0.6 + 0.4 * Math.sin(this._animTime * 0.004);
        return `rgba(0, 200, 255, ${0.5 + 0.3 * startPulse * distanceFactor})`;
      
      case 'goal':
        // Green pulsing - goal zone
        const goalPulse = 0.6 + 0.4 * Math.sin(this._animTime * 0.005);
        return `rgba(0, 255, 100, ${0.5 + 0.35 * goalPulse * distanceFactor})`;
      
      case 'jump':
        // Bright cyan/blue pulsing - "jump here!"
        return `rgba(0, 220, 255, ${alpha})`;
      
      case 'danger':
        // Red pulsing - damage zone
        return `rgba(255, 50, 50, ${alpha})`;
      
      case 'pit':
        // Dark with red edge glow - pitfall
        const pitPulse = 0.5 + 0.5 * Math.sin(this._animTime * 0.003);
        return `rgba(20, 0, 0, ${0.8 + 0.2 * pitPulse})`;
      
      case 'slow':
        // Yellow/amber - slow zone
        return `rgba(255, 180, 0, ${alpha * 0.7})`;
      
      case 'speed':
        // Green - speed boost
        return `rgba(0, 255, 100, ${alpha * 0.8})`;
      
      case 'warning':
        // Alternating yellow/black stripes effect
        const stripe = Math.sin(this._animTime * 0.01) > 0;
        return stripe ? `rgba(255, 200, 0, ${alpha})` : `rgba(40, 40, 0, ${alpha})`;
      
      default:
        return zone.color || `rgba(100, 100, 255, ${alpha})`;
    }
  }
  
  /**
   * Renders floor and ceiling
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} scene - Scene data from raycasting (wall distances per column)
   * @param {number} playerX - Player world X
   * @param {number} playerY - Player world Y
   * @param {number} playerAngle - Player view angle in radians
   * @param {number} fov - Field of view in radians
   * @param {number} [eyeHeight=0] - Eye height for parallax
   * @param {number} [pitchOffset=0] - Vertical pitch offset in pixels (from Y-shearing)
   */
  render(ctx, scene, playerX, playerY, playerAngle, fov, eyeHeight = 0, pitchOffset = 0) {
    if (!this.enabled) return;
    
    this._animTime = performance.now();
    
    const width = this._width;
    const height = this._height;
    const halfHeight = this._halfHeight;
    const sceneLength = scene.length;
    
    // Base height multiplier (same as wall rendering)
    const baseHeightMultiplier = height * HEIGHT_SCALE_FACTOR;
    
    // Pre-calculate ray directions (reuse array across frames to avoid GC)
    if (!this._rayDirs || this._rayDirsCount !== sceneLength) {
      this._rayDirs = new Array(sceneLength);
      for (let i = 0; i < sceneLength; i++) {
        this._rayDirs[i] = { x: 0, y: 0, cos: 0 };
      }
      this._rayDirsCount = sceneLength;
    }
    const rayDirs = this._rayDirs;
    const halfFov = fov * 0.5;
    const fovStep = fov / sceneLength;
    for (let i = 0; i < sceneLength; i++) {
      const angleOffset = -halfFov + i * fovStep;
      const rayAngle = playerAngle + angleOffset;
      rayDirs[i].x = Math.cos(rayAngle);
      rayDirs[i].y = Math.sin(rayAngle);
      rayDirs[i].cos = Math.cos(angleOffset);
    }
    
    // Shifted horizon from pitch
    const horizonY = halfHeight + pitchOffset;

    // Render floor (below horizon)
    if (this.enabled) {
      this._renderFloor(ctx, scene, playerX, playerY, rayDirs, horizonY, width, height, baseHeightMultiplier, eyeHeight);
    }

    // Render ceiling (above horizon)
    if (this.ceilingEnabled) {
      this._renderCeiling(ctx, scene, playerX, playerY, rayDirs, horizonY, width, height, baseHeightMultiplier, eyeHeight);
      // Draw ceiling light fixtures on top of ceiling
      if (this.lightingEnabled) {
        this._renderCeilingFixtures(ctx, scene, playerX, playerY, playerAngle, fov, horizonY, width, height, baseHeightMultiplier, eyeHeight);
      }
    }
  }
  
  /**
   * Renders the floor with perspective and zones
   * Row-based rendering with proper wall occlusion
   * @private
   */
  _renderFloor(ctx, scene, playerX, playerY, rayDirs, horizonY, width, height, baseHeightMultiplier, eyeHeight) {
    const sceneLength = scene.length;
    const colWidth = width / sceneLength;
    const floorH = this.floorColor.h;
    const floorS = this.floorColor.s;
    const floorL = this.floorColor.l;
    const useChecker = this.useCheckerboard;
    const checkerDark = this.checkerboardDarkness;
    const litMode = this.lightingEnabled;

    // Reuse wall position arrays
    if (!this._wallBottoms || this._wallBottoms.length !== sceneLength) {
      this._wallBottoms = new Float32Array(sceneLength);
    }
    const wallBottoms = this._wallBottoms;
    for (let col = 0; col < sceneLength; col++) {
      const wallDist = scene[col].distance;
      if (wallDist === Infinity || wallDist <= 0) {
        wallBottoms[col] = horizonY;
      } else {
        const wallHeight = baseHeightMultiplier / wallDist;
        const wallParallaxOffset = eyeHeight * wallHeight * PARALLAX_STRENGTH;
        wallBottoms[col] = horizonY - wallHeight * 0.5 + wallParallaxOffset + wallHeight;
      }
    }

    // Lighting mode: larger steps, sample every Nth column, skip far rows
    const rowStep = litMode ? 3 : 2;
    const lightSampleStep = litMode ? 8 : 1;

    // Pre-compute fog color once (same for all fog pixels)
    const fogLightness = litMode ? (floorL * 0.02) | 0 : null;
    const fogColor = litMode ? `hsl(${floorH},${(floorS * 0.3) | 0}%,${fogLightness}%)` : null;

    for (let screenY = Math.floor(horizonY) + 1; screenY < height; screenY += rowStep) {
      const rowFromCenter = screenY - horizonY;
      if (rowFromCenter <= 0) continue;

      const parallaxFactor = 0.5 + eyeHeight * PARALLAX_STRENGTH;
      const perpDist = (baseHeightMultiplier * parallaxFactor) / rowFromCenter;

      const isFog = perpDist > MAX_FLOOR_DISTANCE;

      // Very distant lit rows: single dark fog span (beyond any light range)
      if (litMode && isFog) {
        let first = -1, last = -1;
        for (let col = 0; col < sceneLength; col++) {
          if (screenY >= wallBottoms[col]) {
            if (first < 0) first = col;
            last = col;
          }
        }
        if (first >= 0) {
          ctx.fillStyle = fogColor;
          ctx.fillRect(first * colWidth, screenY, (last - first + 1) * colWidth + 1, rowStep);
        }
        continue;
      }

      const distRatio = Math.min(perpDist / MAX_FLOOR_DISTANCE, 2.0);
      const brightness = Math.max(0.08, 1 - distRatio * 0.45);

      if (isFog) {
        // Non-lit fog: single span
        const fogB = brightness * 0.5;
        const fogL2 = (floorL * fogB) | 0;
        const color = `hsl(${floorH},${(floorS * 0.5) | 0}%,${fogL2}%)`;
        let first = -1, last = -1;
        for (let col = 0; col < sceneLength; col++) {
          if (screenY >= wallBottoms[col]) {
            if (first < 0) first = col;
            last = col;
          }
        }
        if (first >= 0) {
          ctx.fillStyle = color;
          ctx.fillRect(first * colWidth, screenY, (last - first + 1) * colWidth + 1, rowStep);
        }
        continue;
      }

      // Normal row: per-column with span batching
      // Quantize lightness to integers so spans merge (key optimization)
      let spanStart = -1;
      let spanLightness = -1;
      let spanIsZone = false;
      let spanZoneColor = null;
      let cachedLitBrightness = 0;

      for (let col = 0; col < sceneLength; col++) {
        if (screenY < wallBottoms[col]) {
          if (spanStart >= 0) {
            if (spanIsZone) {
              ctx.fillStyle = spanZoneColor;
            } else {
              ctx.fillStyle = `hsl(${floorH},${floorS}%,${spanLightness}%)`;
            }
            ctx.fillRect(spanStart * colWidth, screenY, (col - spanStart) * colWidth + 1, rowStep);
            spanStart = -1;
          }
          continue;
        }

        const rayDir = rayDirs[col];
        const rayDist = perpDist / rayDir.cos;
        const worldX = playerX + rayDir.x * rayDist;
        const worldY = playerY + rayDir.y * rayDist;

        let pixelBrightness = brightness;
        if (litMode) {
          // Sample lighting less frequently for distant rows
          const sampleStep = perpDist > 500 ? 16 : lightSampleStep;
          if (col % sampleStep === 0) {
            const litBrightness = lightingSystem.calculateBrightnessOnly(worldX, worldY);
            const distFog = perpDist < 50 ? 1 : Math.min(1, 200 / perpDist);
            cachedLitBrightness = litBrightness * distFog;
          }
          pixelBrightness = cachedLitBrightness;
        }

        // Check for zone (only if we have zones)
        let zone = null;
        if (this.zones.length > 0) {
          zone = this.getZoneAt(worldX, worldY);
        }

        if (zone) {
          const zoneColor = this._getZoneColor(zone, pixelBrightness);
          if (spanStart >= 0 && (!spanIsZone || spanZoneColor !== zoneColor)) {
            if (spanIsZone) {
              ctx.fillStyle = spanZoneColor;
            } else {
              ctx.fillStyle = `hsl(${floorH},${floorS}%,${spanLightness}%)`;
            }
            ctx.fillRect(spanStart * colWidth, screenY, (col - spanStart) * colWidth + 1, rowStep);
            spanStart = col;
          } else if (spanStart < 0) {
            spanStart = col;
          }
          spanIsZone = true;
          spanZoneColor = zoneColor;
        } else {
          // Checkerboard + quantize lightness to integer
          const tileX = (worldX / FLOOR_TILE_SIZE) | 0;
          const tileY = (worldY / FLOOR_TILE_SIZE) | 0;
          const checkerMod = useChecker && ((tileX + tileY) & 1) === 0 ? checkerDark : 1;
          const lightness = (floorL * pixelBrightness * checkerMod) | 0; // Integer quantize

          if (spanStart >= 0 && (spanIsZone || lightness !== spanLightness)) {
            if (spanIsZone) {
              ctx.fillStyle = spanZoneColor;
            } else {
              ctx.fillStyle = `hsl(${floorH},${floorS}%,${spanLightness}%)`;
            }
            ctx.fillRect(spanStart * colWidth, screenY, (col - spanStart) * colWidth + 1, rowStep);
            spanStart = col;
          } else if (spanStart < 0) {
            spanStart = col;
          }
          spanIsZone = false;
          spanLightness = lightness;
        }
      }

      if (spanStart >= 0) {
        if (spanIsZone) {
          ctx.fillStyle = spanZoneColor;
        } else {
          ctx.fillStyle = `hsl(${floorH},${floorS}%,${spanLightness}%)`;
        }
        ctx.fillRect(spanStart * colWidth, screenY, (sceneLength - spanStart) * colWidth + 1, rowStep);
      }
    }
  }
  
  /**
   * Draws a horizontal floor span
   * @private
   */
  _drawFloorSpan(ctx, startCol, endCol, y, rowHeight, colWidth, brightness, zone, isChecker, isFog = false) {
    const x = startCol * colWidth;
    const spanWidth = (endCol - startCol) * colWidth;
    
    if (isFog) {
      // Far distance fog - solid dark color blending to horizon
      const { h, s, l } = this.floorColor;
      const fogL = l * brightness * 0.5; // Darker for fog
      ctx.fillStyle = `hsl(${h}, ${s * 0.5}%, ${fogL}%)`;
    } else if (zone) {
      // Zone color
      ctx.fillStyle = this._getZoneColor(zone, brightness);
    } else {
      // Normal floor with checkerboard
      const { h, s, l } = this.floorColor;
      const checkerMod = this.useCheckerboard && isChecker ? this.checkerboardDarkness : 1;
      const finalL = l * brightness * checkerMod;
      ctx.fillStyle = `hsl(${h}, ${s}%, ${finalL}%)`;
    }
    
    ctx.fillRect(x, y, spanWidth + 1, rowHeight);
  }
  
  /**
   * Renders the ceiling with checkerboard pattern
   * Row-based rendering with proper wall occlusion
   * @private
   */
  _renderCeiling(ctx, scene, playerX, playerY, rayDirs, horizonY, width, height, baseHeightMultiplier, eyeHeight) {
    const sceneLength = scene.length;
    const colWidth = width / sceneLength;
    const ceilH = this.ceilingColor.h;
    const ceilS = this.ceilingColor.s;
    const ceilL = this.ceilingColor.l;
    const useChecker = this.useCheckerboard;
    const checkerDark = this.checkerboardDarkness;
    const litMode = this.lightingEnabled;

    if (!this._wallTops || this._wallTops.length !== sceneLength) {
      this._wallTops = new Float32Array(sceneLength);
    }
    const wallTops = this._wallTops;
    for (let col = 0; col < sceneLength; col++) {
      const wallDist = scene[col].distance;
      if (wallDist === Infinity || wallDist <= 0) {
        wallTops[col] = horizonY;
      } else {
        const wallHeight = baseHeightMultiplier / wallDist;
        const wallParallaxOffset = eyeHeight * wallHeight * PARALLAX_STRENGTH;
        wallTops[col] = horizonY - wallHeight * 0.5 + wallParallaxOffset;
      }
    }

    const rowStep = litMode ? 3 : 2;
    const lightSampleStep = litMode ? 8 : 1;

    const fogLightness = litMode ? (ceilL * 0.02) | 0 : null;
    const fogColor = litMode ? `hsl(${ceilH},${(ceilS * 0.3) | 0}%,${fogLightness}%)` : null;

    for (let screenY = Math.floor(horizonY) - 1; screenY >= 0; screenY -= rowStep) {
      const rowFromCenter = horizonY - screenY;
      if (rowFromCenter <= 0) continue;

      const parallaxFactor = 0.5 - eyeHeight * PARALLAX_STRENGTH;
      const perpDist = (baseHeightMultiplier * Math.abs(parallaxFactor)) / rowFromCenter;

      const isFog = perpDist > MAX_FLOOR_DISTANCE;

      // Very distant lit rows: single dark fog span (beyond any light range)
      if (litMode && isFog) {
        let first = -1, last = -1;
        for (let col = 0; col < sceneLength; col++) {
          if (screenY <= wallTops[col]) {
            if (first < 0) first = col;
            last = col;
          }
        }
        if (first >= 0) {
          ctx.fillStyle = fogColor;
          ctx.fillRect(first * colWidth, screenY, (last - first + 1) * colWidth + 1, rowStep);
        }
        continue;
      }

      const distRatio = Math.min(perpDist / MAX_FLOOR_DISTANCE, 2.0);
      const brightness = Math.max(0.12, 1 - distRatio * 0.35);

      if (isFog) {
        const fogB = brightness * 0.6;
        const fogL2 = (ceilL * fogB) | 0;
        const color = `hsl(${ceilH},${(ceilS * 0.3) | 0}%,${fogL2}%)`;
        let first = -1, last = -1;
        for (let col = 0; col < sceneLength; col++) {
          if (screenY <= wallTops[col]) {
            if (first < 0) first = col;
            last = col;
          }
        }
        if (first >= 0) {
          ctx.fillStyle = color;
          ctx.fillRect(first * colWidth, screenY, (last - first + 1) * colWidth + 1, rowStep);
        }
        continue;
      }

      let spanStart = -1;
      let spanLightness = -1;
      let cachedLitBrightness = 0;

      for (let col = 0; col < sceneLength; col++) {
        if (screenY > wallTops[col]) {
          if (spanStart >= 0) {
            ctx.fillStyle = `hsl(${ceilH},${ceilS}%,${spanLightness}%)`;
            ctx.fillRect(spanStart * colWidth, screenY, (col - spanStart) * colWidth + 1, rowStep);
            spanStart = -1;
          }
          continue;
        }

        const rayDir = rayDirs[col];
        const rayDist = perpDist / rayDir.cos;
        const worldX = playerX + rayDir.x * rayDist;
        const worldY = playerY + rayDir.y * rayDist;

        let pixelBrightness = brightness;
        if (litMode) {
          const sampleStep = perpDist > 500 ? 16 : lightSampleStep;
          if (col % sampleStep === 0) {
            const litBrightness = lightingSystem.calculateBrightnessOnly(worldX, worldY);
            const distFog = perpDist < 50 ? 1 : Math.min(1, 200 / perpDist);
            cachedLitBrightness = litBrightness * distFog;
          }
          pixelBrightness = cachedLitBrightness;
        }

        const tileX = (worldX / FLOOR_TILE_SIZE) | 0;
        const tileY = (worldY / FLOOR_TILE_SIZE) | 0;
        const checkerMod = useChecker && ((tileX + tileY) & 1) === 0 ? checkerDark : 1;
        const lightness = (ceilL * pixelBrightness * checkerMod) | 0;

        if (spanStart >= 0 && lightness !== spanLightness) {
          ctx.fillStyle = `hsl(${ceilH},${ceilS}%,${spanLightness}%)`;
          ctx.fillRect(spanStart * colWidth, screenY, (col - spanStart) * colWidth + 1, rowStep);
          spanStart = col;
        } else if (spanStart < 0) {
          spanStart = col;
        }
        spanLightness = lightness;
      }

      if (spanStart >= 0) {
        ctx.fillStyle = `hsl(${ceilH},${ceilS}%,${spanLightness}%)`;
        ctx.fillRect(spanStart * colWidth, screenY, (sceneLength - spanStart) * colWidth + 1, rowStep);
      }
    }
  }
  
  /**
   * Renders glowing light fixtures on the ceiling at each light source position.
   * Projects world-space light positions to screen-space and draws radial glows.
   * @private
   */
  _renderCeilingFixtures(ctx, scene, playerX, playerY, playerAngle, fov, horizonY, width, height, baseHeightMultiplier, eyeHeight) {
    const lights = lightingSystem.lights;
    if (!lights.length) return;

    const halfFov = fov * 0.5;
    const cosAngle = Math.cos(playerAngle);
    const sinAngle = Math.sin(playerAngle);

    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];

      // Vector from player to light
      const dx = light.x - playerX;
      const dy = light.y - playerY;

      // Distance to light
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1 || dist > 600) continue; // too close or too far

      // Angle from player's forward direction to the light
      const angleToLight = Math.atan2(dy, dx);
      let relAngle = angleToLight - playerAngle;
      // Normalize to [-PI, PI]
      while (relAngle > Math.PI) relAngle -= Math.PI * 2;
      while (relAngle < -Math.PI) relAngle += Math.PI * 2;

      // Skip if outside FOV (with some margin for the fixture size)
      if (Math.abs(relAngle) > halfFov + 0.1) continue;

      // Project to screen X: map relAngle from [-halfFov, halfFov] to [0, width]
      const screenX = ((relAngle + halfFov) / fov) * width;

      // Perpendicular distance (for correct projection height)
      const perpDist = dx * cosAngle + dy * sinAngle;
      if (perpDist < 1) continue; // behind player

      // Project to screen Y: ceiling fixture is at the ceiling plane
      // Use the same projection as ceiling rendering
      const parallaxFactor = 0.5 - eyeHeight * PARALLAX_STRENGTH;
      const screenYFromHorizon = (baseHeightMultiplier * Math.abs(parallaxFactor)) / perpDist;
      const screenY = horizonY - screenYFromHorizon;

      // Skip if off-screen
      if (screenY < -20 || screenY > horizonY || screenX < -30 || screenX > width + 30) continue;

      // Check if a wall is closer (fixture is occluded)
      const colIndex = ((screenX / width) * scene.length) | 0;
      if (colIndex >= 0 && colIndex < scene.length) {
        if (scene[colIndex].distance < perpDist) continue; // wall is in front
      }

      // Projected fixture radius on screen
      const projectedSize = (FIXTURE_GLOW_RADIUS / perpDist) * baseHeightMultiplier * 0.008;
      if (projectedSize < 1) continue; // too small to see

      // Determine fixture color from light color
      const lr = light.color ? light.color.r : 1;
      const lg = light.color ? light.color.g : 0.85;
      const lb = light.color ? light.color.b : 0.6;
      const cr = (lr * 255) | 0;
      const cg = (lg * 255) | 0;
      const cb = (lb * 255) | 0;

      // Draw radial gradient glow
      const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, projectedSize);
      grad.addColorStop(0, `rgba(${Math.min(255, cr + 80)},${Math.min(255, cg + 60)},${Math.min(255, cb + 40)},0.95)`);
      grad.addColorStop(0.3, `rgba(${cr},${cg},${cb},0.6)`);
      grad.addColorStop(0.7, `rgba(${cr},${cg},${cb},0.15)`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(screenX - projectedSize, screenY - projectedSize, projectedSize * 2, projectedSize * 2);

      // Small bright core (the actual "bulb/fixture")
      const coreSize = projectedSize * 0.3;
      ctx.fillStyle = `rgba(${Math.min(255, cr + 120)},${Math.min(255, cg + 100)},${Math.min(255, cb + 80)},0.9)`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, Math.max(1, coreSize), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draws a horizontal ceiling span
   * @private
   */
  _drawCeilingSpan(ctx, startCol, endCol, y, rowHeight, colWidth, brightness) {
    const x = startCol * colWidth;
    const spanWidth = (endCol - startCol) * colWidth;
    
    const { h, s, l } = this.ceilingColor;
    ctx.fillStyle = `hsl(${h}, ${s}%, ${l * brightness}%)`;
    ctx.fillRect(x, y - rowHeight + 1, spanWidth + 1, rowHeight);
  }
  
  /**
   * Draws zone indicators on the minimap
   * @param {CanvasRenderingContext2D} ctx 
   * @param {Function} rotatePoint - Function to convert world coords to minimap coords
   * @param {number} invScale - Inverse scale for line widths
   */
  drawMinimapZones(ctx, rotatePoint, invScale) {
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.004);
    
    for (const zone of this.zones) {
      const pos = rotatePoint(zone.x, zone.y);
      
      let color;
      switch (zone.type) {
        case 'start':
          color = `rgba(0, 200, 255, ${0.5 * pulse})`;
          break;
        case 'goal':
          color = `rgba(0, 255, 100, ${0.55 * pulse})`;
          break;
        case 'jump':
          color = `rgba(0, 220, 255, ${0.4 * pulse})`;
          break;
        case 'danger':
          color = `rgba(255, 50, 50, ${0.5 * pulse})`;
          break;
        case 'pit':
          color = `rgba(50, 0, 0, 0.7)`;
          break;
        case 'warning':
          color = `rgba(255, 200, 0, ${0.4 * pulse})`;
          break;
        default:
          color = `rgba(100, 100, 255, ${0.3 * pulse})`;
      }
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, zone.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Border
      ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.8)');
      ctx.lineWidth = 1.5 * invScale;
      ctx.stroke();
    }
  }
}

// Export singleton instance
const floorCaster = new FloorCaster();
export default floorCaster;
export { FloorCaster };
