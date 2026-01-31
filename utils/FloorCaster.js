import { RenderConfig } from "../config/GameConfig.js";

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
    
    // Animation time for effects
    this._animTime = 0;
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
   */
  render(ctx, scene, playerX, playerY, playerAngle, fov, eyeHeight = 0) {
    if (!this.enabled) return;
    
    this._animTime = performance.now();
    
    const width = this._width;
    const height = this._height;
    const halfHeight = this._halfHeight;
    const sceneLength = scene.length;
    
    // Base height multiplier (same as wall rendering)
    const baseHeightMultiplier = height * HEIGHT_SCALE_FACTOR;
    
    // Pre-calculate ray directions for each column (matching camera exactly)
    const halfFov = fov * 0.5;
    const rayDirs = new Array(sceneLength);
    for (let i = 0; i < sceneLength; i++) {
      const angleOffset = -halfFov + i * (fov / sceneLength);
      const rayAngle = playerAngle + angleOffset;
      rayDirs[i] = {
        x: Math.cos(rayAngle),
        y: Math.sin(rayAngle),
        cos: Math.cos(angleOffset) // For fisheye correction
      };
    }
    
    // Render floor (below horizon)
    if (this.enabled) {
      this._renderFloor(ctx, scene, playerX, playerY, rayDirs, halfHeight, width, height, baseHeightMultiplier, eyeHeight);
    }
    
    // Render ceiling (above horizon)
    if (this.ceilingEnabled) {
      this._renderCeiling(ctx, scene, playerX, playerY, rayDirs, halfHeight, width, height, baseHeightMultiplier, eyeHeight);
    }
  }
  
  /**
   * Renders the floor with perspective and zones
   * Row-based rendering with proper wall occlusion
   * @private
   */
  _renderFloor(ctx, scene, playerX, playerY, rayDirs, halfHeight, width, height, baseHeightMultiplier, eyeHeight) {
    const sceneLength = scene.length;
    const colWidth = width / sceneLength;
    
    // Pre-calculate wall bottom positions for each column
    const wallBottoms = new Float32Array(sceneLength);
    for (let col = 0; col < sceneLength; col++) {
      const wallDist = scene[col].distance;
      if (wallDist === Infinity || wallDist <= 0) {
        wallBottoms[col] = halfHeight;
      } else {
        const wallHeight = baseHeightMultiplier / wallDist;
        const wallParallaxOffset = eyeHeight * wallHeight * PARALLAX_STRENGTH;
        const wallY = halfHeight - wallHeight * 0.5 + wallParallaxOffset;
        wallBottoms[col] = wallY + wallHeight;
      }
    }
    
    // Render floor row by row (every 2 pixels for performance)
    const rowStep = 2;
    
    for (let screenY = Math.floor(halfHeight) + 1; screenY < height; screenY += rowStep) {
      const rowFromCenter = screenY - halfHeight;
      if (rowFromCenter <= 0) continue;
      
      // Calculate floor distance and brightness for this row
      const parallaxFactor = 0.5 + eyeHeight * PARALLAX_STRENGTH;
      const perpDist = (baseHeightMultiplier * parallaxFactor) / rowFromCenter;
      
      const distRatio = Math.min(perpDist / MAX_FLOOR_DISTANCE, 2.0);
      const brightness = Math.max(0.08, 1 - distRatio * 0.45);
      
      const isFog = perpDist > MAX_FLOOR_DISTANCE;
      
      // Draw spans across this row
      let spanStart = -1;
      let spanColor = null;
      
      for (let col = 0; col < sceneLength; col++) {
        // Check if wall occludes this pixel
        if (screenY < wallBottoms[col]) {
          // Wall covers this pixel - end any current span
          if (spanStart >= 0) {
            ctx.fillStyle = spanColor;
            ctx.fillRect(spanStart * colWidth, screenY, (col - spanStart) * colWidth + 1, rowStep);
            spanStart = -1;
          }
          continue;
        }
        
        // Calculate color for this pixel
        let color;
        
        if (isFog) {
          const { h, s, l } = this.floorColor;
          color = `hsl(${h}, ${s * 0.3}%, ${l * brightness * 0.5}%)`;
        } else {
          // Calculate world position
          const rayDir = rayDirs[col];
          const rayDist = perpDist / rayDir.cos;
          const worldX = playerX + rayDir.x * rayDist;
          const worldY = playerY + rayDir.y * rayDist;
          
          // Check for zone
          const zone = this.getZoneAt(worldX, worldY);
          
          if (zone) {
            color = this._getZoneColor(zone, brightness);
          } else {
            // Checkerboard
            const tileX = Math.floor(worldX / FLOOR_TILE_SIZE);
            const tileY = Math.floor(worldY / FLOOR_TILE_SIZE);
            const isChecker = (tileX + tileY) % 2 === 0;
            
            const { h, s, l } = this.floorColor;
            const checkerMod = this.useCheckerboard && isChecker ? this.checkerboardDarkness : 1;
            color = `hsl(${h}, ${s}%, ${l * brightness * checkerMod}%)`;
          }
        }
        
        // Start new span or continue if same color
        if (spanStart < 0) {
          spanStart = col;
          spanColor = color;
        } else if (color !== spanColor) {
          // Color changed - draw current span and start new
          ctx.fillStyle = spanColor;
          ctx.fillRect(spanStart * colWidth, screenY, (col - spanStart) * colWidth + 1, rowStep);
          spanStart = col;
          spanColor = color;
        }
      }
      
      // Draw final span
      if (spanStart >= 0) {
        ctx.fillStyle = spanColor;
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
  _renderCeiling(ctx, scene, playerX, playerY, rayDirs, halfHeight, width, height, baseHeightMultiplier, eyeHeight) {
    const sceneLength = scene.length;
    const colWidth = width / sceneLength;
    
    // Pre-calculate wall top positions for each column
    const wallTops = new Float32Array(sceneLength);
    for (let col = 0; col < sceneLength; col++) {
      const wallDist = scene[col].distance;
      if (wallDist === Infinity || wallDist <= 0) {
        wallTops[col] = halfHeight;
      } else {
        const wallHeight = baseHeightMultiplier / wallDist;
        const wallParallaxOffset = eyeHeight * wallHeight * PARALLAX_STRENGTH;
        wallTops[col] = halfHeight - wallHeight * 0.5 + wallParallaxOffset;
      }
    }
    
    // Render ceiling row by row (every 2 pixels for performance)
    const rowStep = 2;
    
    for (let screenY = Math.floor(halfHeight) - 1; screenY >= 0; screenY -= rowStep) {
      const rowFromCenter = halfHeight - screenY;
      if (rowFromCenter <= 0) continue;
      
      // Calculate ceiling distance and brightness for this row
      const parallaxFactor = 0.5 - eyeHeight * PARALLAX_STRENGTH;
      const perpDist = (baseHeightMultiplier * Math.abs(parallaxFactor)) / rowFromCenter;
      
      const distRatio = Math.min(perpDist / MAX_FLOOR_DISTANCE, 2.0);
      const brightness = Math.max(0.12, 1 - distRatio * 0.35);
      
      const isFog = perpDist > MAX_FLOOR_DISTANCE;
      
      // Draw spans across this row
      let spanStart = -1;
      let spanColor = null;
      
      for (let col = 0; col < sceneLength; col++) {
        // Check if wall occludes this pixel
        if (screenY > wallTops[col]) {
          // Wall covers this pixel - end any current span
          if (spanStart >= 0) {
            ctx.fillStyle = spanColor;
            ctx.fillRect(spanStart * colWidth, screenY, (col - spanStart) * colWidth + 1, rowStep);
            spanStart = -1;
          }
          continue;
        }
        
        // Calculate color for this pixel
        let color;
        
        if (isFog) {
          const { h, s, l } = this.ceilingColor;
          color = `hsl(${h}, ${s * 0.3}%, ${l * brightness * 0.6}%)`;
        } else {
          // Calculate world position for checkerboard
          const rayDir = rayDirs[col];
          const rayDist = perpDist / rayDir.cos;
          const worldX = playerX + rayDir.x * rayDist;
          const worldY = playerY + rayDir.y * rayDist;
          
          // Checkerboard pattern (same tile size as floor)
          const tileX = Math.floor(worldX / FLOOR_TILE_SIZE);
          const tileY = Math.floor(worldY / FLOOR_TILE_SIZE);
          const isChecker = (tileX + tileY) % 2 === 0;
          
          const { h, s, l } = this.ceilingColor;
          const checkerMod = this.useCheckerboard && isChecker ? this.checkerboardDarkness : 1;
          color = `hsl(${h}, ${s}%, ${l * brightness * checkerMod}%)`;
        }
        
        // Start new span or continue if same color
        if (spanStart < 0) {
          spanStart = col;
          spanColor = color;
        } else if (color !== spanColor) {
          // Color changed - draw current span and start new
          ctx.fillStyle = spanColor;
          ctx.fillRect(spanStart * colWidth, screenY, (col - spanStart) * colWidth + 1, rowStep);
          spanStart = col;
          spanColor = color;
        }
      }
      
      // Draw final span
      if (spanStart >= 0) {
        ctx.fillStyle = spanColor;
        ctx.fillRect(spanStart * colWidth, screenY, (sceneLength - spanStart) * colWidth + 1, rowStep);
      }
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
