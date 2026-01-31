import RayClass from "./RayClass.js";
import Boundaries from "./BoundariesClass.js";
import { DEG_TO_RAD } from "../utils/mathLUT.js";
import SpatialGrid from "../utils/SpatialGrid.js";

/**
 * @typedef {Object} RayHit
 * @property {number} distance - The perpendicular distance from the camera to the boundary.
 * @property {number} textureX - The normalized x-coordinate on the boundary's texture (0 to 1).
 * @property {HTMLImageElement|null} texture - The texture image of the intersected boundary.
 * @property {string|null} color - Solid color for untextured walls.
 * @property {Boundaries|null} boundary - The intersected boundary object.
 * @property {{x: number, y: number}} point - The intersection point.
 */

/**
 * @typedef {Object} RayIntersection
 * @property {number} distance - The perpendicular distance from the camera to the closest boundary.
 * @property {number} textureX - The normalized x-coordinate on the boundary's texture (0 to 1).
 * @property {HTMLImageElement|null} texture - The texture image of the intersected boundary.
 * @property {string|null} color - Solid color for untextured walls.
 * @property {Boundaries|null} boundary - The intersected boundary object.
 * @property {RayHit[]} [transparentHits] - Array of transparent boundary hits behind this one.
 */

// Maximum render distance for culling
const MAX_RENDER_DISTANCE = 2000;
const MAX_RENDER_DISTANCE_SQ = MAX_RENDER_DISTANCE * MAX_RENDER_DISTANCE;

// Pixels per world unit for texture scaling
const PIXELS_PER_WORLD_UNIT = 4;

// Height scale factor for wall rendering
const HEIGHT_SCALE_FACTOR = 100;

// Spatial grid cell size (tune based on average wall length)
const SPATIAL_GRID_CELL_SIZE = 100;

// SIMD-like batch size for ray processing
const RAY_BATCH_SIZE = 4;

/**
 * Optimized camera class with ray reuse, frustum culling, spatial grid, and depth buffer support.
 * 
 * Optimization features:
 * - Spatial grid for O(1) boundary lookup per cell
 * - Precomputed fisheye correction values
 * - Precomputed height multipliers for faster wall height calculation
 * - SIMD-like batch processing of rays
 * - Pre-allocated result arrays to avoid GC
 */
class CameraClass {
  /**
   * Creates a camera instance with ray casting capabilities
   * @param {Object} options - Camera configuration
   * @param {number} options.x - Initial x position
   * @param {number} options.y - Initial y position
   * @param {number} options.fov - Field of view in degrees
   * @param {number} options.rayCount - Number of rays to cast
   * @param {number} options.viewDirection - Initial view direction in degrees
   * @param {number} options.eyeHeight - Initial eye height for vertical parallax
   * @param {number} options.canvasHeight - Canvas height for precomputing height multipliers
   */
  constructor({ x, y, fov = 80, rayCount = 1000, viewDirection = 0, eyeHeight = 0, canvasHeight = 1080 }) {
    this.pos = { x, y };
    this.fov = fov;
    this.rayCount = rayCount;
    this.viewDirection = viewDirection;
    this.eyeHeight = eyeHeight; // Vertical position for parallax (-1 to 1, 0 = center)
    this.canvasHeight = canvasHeight;
    
    // Pre-allocate rays array - we'll reuse these instead of recreating
    this.rays = new Array(rayCount);
    for (let i = 0; i < rayCount; i++) {
      this.rays[i] = new RayClass(x, y, 0);
    }
    
    // Pre-calculate angle offsets (relative to view direction) in radians
    this.angleOffsets = new Float32Array(rayCount);
    const fovRad = fov * DEG_TO_RAD;
    const angleStep = fovRad / rayCount;
    const halfFovRad = fovRad * 0.5;
    for (let i = 0; i < rayCount; i++) {
      this.angleOffsets[i] = -halfFovRad + i * angleStep;
    }
    
    // Cache for cos values used in fisheye correction (pre-computed once)
    this.cosCache = new Float32Array(rayCount);
    for (let i = 0; i < rayCount; i++) {
      this.cosCache[i] = Math.cos(this.angleOffsets[i]);
    }
    
    // Precomputed height multipliers: heightMultiplier[i] / distance = wallHeight
    // This combines canvasHeight * HEIGHT_SCALE_FACTOR / cosCache[i] into one multiply
    // Result: wallHeight = heightMultipliers[i] / distance (single division per ray)
    this.heightMultipliers = new Float32Array(rayCount);
    this._updateHeightMultipliers();
    
    // Spatial grid for efficient boundary lookup
    this.spatialGrid = new SpatialGrid(SPATIAL_GRID_CELL_SIZE);
    this._spatialGridDirty = true;
    this._lastBoundaries = null;
    
    // Pre-allocated arrays for spatial grid queries (avoid allocations per ray)
    this._rayBoundaryBuffer = new Array(200); // Max boundaries per ray
    this._rayBoundarySet = new Set();
    
    // Pre-allocate scene result array
    this._sceneResult = new Array(rayCount);
    for (let i = 0; i < rayCount; i++) {
      this._sceneResult[i] = {
        distance: Infinity,
        textureX: 0,
        texture: null,
        color: null,
        boundary: null,
        transparentHits: [],
        heightMultiplier: 0 // Store precomputed multiplier for renderer
      };
    }
    
    // Cache frustum parameters
    this._halfFovRad = halfFovRad;
    this._frustumMargin = halfFovRad + 0.5; // Extra margin for wide walls
    
    this._updateRays();
  }
  
  /**
   * Updates precomputed height multipliers
   * Called when FOV or canvas height changes
   * 
   * NOTE: The distance stored in scene results is ALREADY fisheye-corrected
   * (multiplied by cosCache), so we should NOT divide by cosCache here.
   * The height multiplier is simply: canvasHeight * HEIGHT_SCALE_FACTOR
   * And wall height = heightMultiplier / correctedDistance
   * 
   * @private
   */
  _updateHeightMultipliers() {
    const baseMultiplier = this.canvasHeight * HEIGHT_SCALE_FACTOR;
    for (let i = 0; i < this.rayCount; i++) {
      // Distance in scene is already corrected (rawDist * cosCache)
      // So height multiplier is just the base multiplier
      // wallHeight = baseMultiplier / correctedDistance
      this.heightMultipliers[i] = baseMultiplier;
    }
  }
  
  /**
   * Updates the canvas height and recalculates height multipliers
   * @param {number} height - New canvas height
   */
  setCanvasHeight(height) {
    if (this.canvasHeight !== height) {
      this.canvasHeight = height;
      this._updateHeightMultipliers();
    }
  }

  /**
   * Updates ray positions and angles efficiently
   * Uses pre-computed sin/cos from LUT
   * @private
   */
  _updateRays() {
    const viewDirRad = this.viewDirection * DEG_TO_RAD;
    
    for (let i = 0; i < this.rayCount; i++) {
      const ray = this.rays[i];
      const angle = viewDirRad + this.angleOffsets[i];
      
      ray.pos.x = this.pos.x;
      ray.pos.y = this.pos.y;
      // Use precise Math.cos/sin for ray direction (LUT is for culling)
      ray.dir.x = Math.cos(angle);
      ray.dir.y = Math.sin(angle);
    }
  }

  /**
   * Updates camera position, view direction, and eye height
   * @param {Object} pos - New position {x, y}
   * @param {number} viewDirection - New view direction in degrees
   * @param {number} [eyeHeight=0] - Vertical eye height for parallax
   */
  update(pos, viewDirection, eyeHeight = 0) {
    this.pos = pos;
    this.viewDirection = viewDirection;
    this.eyeHeight = eyeHeight;
    this._updateRays();
  }

  /**
   * Updates the field of view dynamically
   * Recalculates angle offsets, cos cache, and height multipliers
   * @param {number} newFov - New field of view in degrees
   */
  setFov(newFov) {
    if (this.fov === newFov) return;
    
    this.fov = newFov;
    const fovRad = newFov * DEG_TO_RAD;
    const angleStep = fovRad / this.rayCount;
    const halfFovRad = fovRad * 0.5;
    
    // Recalculate angle offsets
    for (let i = 0; i < this.rayCount; i++) {
      this.angleOffsets[i] = -halfFovRad + i * angleStep;
    }
    
    // Recalculate cos cache for fisheye correction
    for (let i = 0; i < this.rayCount; i++) {
      this.cosCache[i] = Math.cos(this.angleOffsets[i]);
    }
    
    // Recalculate height multipliers (depends on cos cache)
    this._updateHeightMultipliers();
    
    // Update frustum parameters
    this._halfFovRad = halfFovRad;
    this._frustumMargin = halfFovRad + 0.5;
    
    // Update rays with new angles
    this._updateRays();
  }

  /**
   * Quick check if a boundary could possibly be visible
   * Uses conservative culling to avoid false negatives
   * @param {Boundaries|CurvedWall} boundary - The boundary to check
   * @returns {boolean} True if the boundary might be visible
   * @private
   */
  _isInViewFrustum(boundary) {
    const posX = this.pos.x;
    const posY = this.pos.y;
    
    // For curved walls, use a simple distance check from center
    if (boundary.isCurved) {
      const dx = boundary.centerX - posX;
      const dy = boundary.centerY - posY;
      const distSq = dx * dx + dy * dy;
      // Include if within max render distance + radius (conservative)
      const threshold = MAX_RENDER_DISTANCE + boundary.radius;
      return distSq <= threshold * threshold;
    }
    
    // For straight walls, check if any part could be visible
    // Use a simple bounding box + distance check (conservative approach)
    
    // First: quick distance check using wall center
    const centerX = (boundary.a.x + boundary.b.x) * 0.5;
    const centerY = (boundary.a.y + boundary.b.y) * 0.5;
    const dx = centerX - posX;
    const dy = centerY - posY;
    const centerDistSq = dx * dx + dy * dy;
    
    // Get half-length of wall for conservative distance check
    const halfLength = boundary.length * 0.5;
    const threshold = MAX_RENDER_DISTANCE + halfLength;
    
    // If center is too far even accounting for wall length, skip
    if (centerDistSq > threshold * threshold) {
      return false;
    }
    
    // For walls reasonably close, always include them
    // This is conservative but avoids the bug where walls spanning the view are culled
    // The cost of a few extra intersection tests is small compared to missing walls
    return true;
  }

  /**
   * Updates the spatial grid with new boundaries
   * Only rebuilds if boundaries array has changed
   * @param {Array<Boundaries>} boundaries - Array of boundary objects
   * @private
   */
  _updateSpatialGrid(boundaries) {
    // Only rebuild if boundaries changed
    if (boundaries !== this._lastBoundaries) {
      this.spatialGrid.buildFromBoundaries(boundaries);
      this._lastBoundaries = boundaries;
      this._spatialGridDirty = false;
    }
  }

  /**
   * Processes a batch of rays (SIMD-like optimization)
   * @param {number} startIdx - Starting ray index
   * @param {number} batchSize - Number of rays to process
   * @param {Array} opaqueBoundaries - Pre-filtered opaque boundaries (fallback)
   * @param {Array} transparentBoundaries - Pre-filtered transparent boundaries
   * @param {boolean} useSpatialGrid - Whether to use spatial grid
   * @private
   */
  _processRayBatch(startIdx, batchSize, opaqueBoundaries, transparentBoundaries, useSpatialGrid) {
    const scene = this._sceneResult;
    const posX = this.pos.x;
    const posY = this.pos.y;
    
    for (let b = 0; b < batchSize; b++) {
      const i = startIdx + b;
      if (i >= this.rayCount) break;
      
      const ray = this.rays[i];
      const cosCorrection = this.cosCache[i];
      const heightMult = this.heightMultipliers[i];
      
      let closestDist = Infinity;
      let closestHit = null;
      let textureX = 0;
      let texture = null;
      let color = null;
      let hitBoundary = null;
      
      // Get boundaries to test - either from spatial grid or pre-filtered list
      let boundariesToTest;
      let boundaryCount;
      
      if (useSpatialGrid) {
        // Use spatial grid DDA to get only relevant boundaries
        boundaryCount = this.spatialGrid.getBoundariesAlongRayFast(
          posX, posY,
          ray.dir.x, ray.dir.y,
          MAX_RENDER_DISTANCE,
          this._rayBoundaryBuffer,
          this._rayBoundarySet
        );
        boundariesToTest = this._rayBoundaryBuffer;
      } else {
        boundariesToTest = opaqueBoundaries;
        boundaryCount = opaqueBoundaries.length;
      }
      
      // Check opaque boundaries - find closest
      for (let j = 0; j < boundaryCount; j++) {
        const boundary = boundariesToTest[j];
        
        // Skip transparent in opaque pass
        if (boundary.isTransparent) continue;
        
        const result = ray.cast(boundary);
        
        if (result) {
          const { point, boundary: hitBound, angle, distance: rawDist } = result;
          
          // Calculate actual distance if not provided (curved walls provide it)
          let dist;
          if (rawDist !== undefined) {
            dist = rawDist;
          } else {
            const dx = posX - point.x;
            const dy = posY - point.y;
            dist = Math.sqrt(dx * dx + dy * dy);
          }
          
          // Apply fisheye correction
          const correctedDist = dist * cosCorrection;

          if (correctedDist < closestDist) {
            closestDist = correctedDist;
            closestHit = point;
            texture = hitBound.texture;
            color = hitBound.color || null;
            hitBoundary = hitBound;
            const texResult = this._calculateTextureX(hitBound, point, angle);
            // Handle directional sprites that return an object
            if (typeof texResult === 'object' && texResult.isDirectional) {
              textureX = texResult.textureX;
            } else {
              textureX = texResult;
            }
          }
        }
      }
      
      // Collect transparent hits that are closer than the closest opaque hit
      const transparentHits = [];
      
      if (transparentBoundaries.length > 0) {
        for (let j = 0; j < transparentBoundaries.length; j++) {
          const boundary = transparentBoundaries[j];
          const result = ray.cast(boundary);
          
          if (result) {
            const { point, boundary: hitBound, angle, distance: rawDist } = result;
            
            let dist;
            if (rawDist !== undefined) {
              dist = rawDist;
            } else {
              const dx = posX - point.x;
              const dy = posY - point.y;
              dist = Math.sqrt(dx * dx + dy * dy);
            }
            
            const correctedDist = dist * cosCorrection;
            
            // Only include if closer than the closest opaque wall
            if (correctedDist < closestDist) {
              const texResult = this._calculateTextureX(hitBound, point, angle);
              let hitTextureX;
              let spriteTexture = null;
              let mirrored = false;
              
              if (typeof texResult === 'object' && texResult.isDirectional) {
                hitTextureX = texResult.textureX;
                spriteTexture = texResult.spriteTexture || null;
                mirrored = texResult.mirrored || false;
              } else {
                hitTextureX = texResult;
              }
              
              transparentHits.push({
                distance: correctedDist,
                textureX: hitTextureX,
                texture: hitBound.texture,
                color: hitBound.color || null,
                boundary: hitBound,
                point,
                spriteTexture,
                mirrored
              });
            }
          }
        }
        
        // Sort by distance (closest first)
        if (transparentHits.length > 1) {
          transparentHits.sort((a, b) => a.distance - b.distance);
        }
      }
      
      // Update scene result (reuse objects to avoid allocation)
      const sceneItem = scene[i];
      sceneItem.distance = closestDist;
      sceneItem.textureX = textureX;
      sceneItem.texture = texture;
      sceneItem.color = color;
      sceneItem.boundary = hitBoundary;
      sceneItem.transparentHits = transparentHits;
      sceneItem.heightMultiplier = heightMult; // Pass to renderer
    }
  }

  /**
   * Casts rays and detects intersections with boundaries.
   * Optimized with:
   * - Spatial grid for O(log n) boundary lookup per ray
   * - SIMD-like batch processing (4 rays at a time)
   * - Precomputed height multipliers
   * - Pre-allocated result arrays
   * 
   * @param {Array<Boundaries>} boundaries - Array of boundary objects
   * @param {boolean} [useSpatialGrid=true] - Whether to use spatial grid optimization
   * @returns {Array<RayIntersection>} Scene intersection data
   */
  spread(boundaries, useSpatialGrid = true) {
    const scene = this._sceneResult;
    
    // Update spatial grid if needed
    if (useSpatialGrid) {
      this._updateSpatialGrid(boundaries);
    }
    
    // Pre-filter boundaries using frustum culling
    // Separate opaque and transparent for correct rendering order
    const visibleBoundaries = [];
    const transparentBoundaries = [];
    
    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i];
      if (this._isInViewFrustum(boundary)) {
        if (boundary.isTransparent) {
          transparentBoundaries.push(boundary);
        } else if (!useSpatialGrid) {
          // Only add to visible list if not using spatial grid
          visibleBoundaries.push(boundary);
        }
      }
    }
    
    // Process rays in batches (SIMD-like)
    for (let i = 0; i < this.rayCount; i += RAY_BATCH_SIZE) {
      this._processRayBatch(i, RAY_BATCH_SIZE, visibleBoundaries, transparentBoundaries, useSpatialGrid);
    }
    
    return scene;
  }

  /**
   * Legacy spread method for compatibility - processes rays individually
   * @param {Array<Boundaries>} boundaries - Array of boundary objects
   * @returns {Array<RayIntersection>} Scene intersection data
   * @deprecated Use spread() instead
   */
  spreadLegacy(boundaries) {
    const scene = this._sceneResult;
    
    // Pre-filter boundaries using frustum culling
    const visibleBoundaries = [];
    const transparentBoundaries = [];
    
    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i];
      if (this._isInViewFrustum(boundary)) {
        if (boundary.isTransparent) {
          transparentBoundaries.push(boundary);
        } else {
          visibleBoundaries.push(boundary);
        }
      }
    }
    
    const numOpaque = visibleBoundaries.length;
    const numTransparent = transparentBoundaries.length;
    
    // Process each ray
    for (let i = 0; i < this.rayCount; i++) {
      const ray = this.rays[i];
      const cosCorrection = this.cosCache[i];
      
      let closestDist = Infinity;
      let closestHit = null;
      let textureX = 0;
      let texture = null;
      let color = null;
      let hitBoundary = null;
      
      // Check opaque boundaries - find closest
      for (let j = 0; j < numOpaque; j++) {
        const boundary = visibleBoundaries[j];
        const result = ray.cast(boundary);
        
        if (result) {
          const { point, boundary: hitBound, angle, distance: rawDist } = result;
          
          // Calculate actual distance if not provided (curved walls provide it)
          let dist;
          if (rawDist !== undefined) {
            dist = rawDist;
          } else {
            const dx = this.pos.x - point.x;
            const dy = this.pos.y - point.y;
            dist = Math.sqrt(dx * dx + dy * dy);
          }
          
          // Apply fisheye correction
          const correctedDist = dist * cosCorrection;

          if (correctedDist < closestDist) {
            closestDist = correctedDist;
            closestHit = point;
            texture = hitBound.texture;
            color = hitBound.color || null;
            hitBoundary = hitBound;
            const texResult = this._calculateTextureX(hitBound, point, angle);
            // Handle directional sprites that return an object
            if (typeof texResult === 'object' && texResult.isDirectional) {
              textureX = texResult.textureX;
            } else {
              textureX = texResult;
            }
          }
        }
      }
      
      // Collect transparent hits that are closer than the closest opaque hit
      const transparentHits = [];
      
      if (numTransparent > 0) {
        for (let j = 0; j < numTransparent; j++) {
          const boundary = transparentBoundaries[j];
          const result = ray.cast(boundary);
          
          if (result) {
            const { point, boundary: hitBound, angle, distance: rawDist } = result;
            
            let dist;
            if (rawDist !== undefined) {
              dist = rawDist;
            } else {
              const dx = this.pos.x - point.x;
              const dy = this.pos.y - point.y;
              dist = Math.sqrt(dx * dx + dy * dy);
            }
            
            const correctedDist = dist * cosCorrection;
            
            // Only include if closer than the closest opaque wall
            if (correctedDist < closestDist) {
              const texResult = this._calculateTextureX(hitBound, point, angle);
              // Handle directional sprites that return an object
              let hitTextureX;
              let spriteTexture = null;
              let mirrored = false;
              
              if (typeof texResult === 'object' && texResult.isDirectional) {
                hitTextureX = texResult.textureX;
                spriteTexture = texResult.spriteTexture || null;
                mirrored = texResult.mirrored || false;
              } else {
                hitTextureX = texResult;
              }
              
              transparentHits.push({
                distance: correctedDist,
                textureX: hitTextureX,
                texture: hitBound.texture,
                color: hitBound.color || null,
                boundary: hitBound,
                point,
                spriteTexture,
                mirrored
              });
            }
          }
        }
        
        // Sort by distance (closest first) - only if we have multiple
        if (transparentHits.length > 1) {
          transparentHits.sort((a, b) => a.distance - b.distance);
        }
      }

      // Reuse scene result objects to avoid allocation
      const sceneItem = scene[i];
      sceneItem.distance = closestDist;
      sceneItem.textureX = textureX;
      sceneItem.texture = texture;
      sceneItem.color = color;
      sceneItem.boundary = hitBoundary;
      sceneItem.transparentHits = transparentHits;
    }
    
    return scene;
  }
  
  /**
   * Calculates the texture X coordinate for a hit point on a boundary
   * Handles both straight walls and curved walls with automatic tiling
   * Also handles 8-directional sprites with frame selection and mirroring
   * @param {Boundaries|CurvedWall} boundary - The hit boundary
   * @param {{x: number, y: number}} point - The intersection point
   * @param {number} [angle] - For curved walls, the angle at intersection
   * @returns {number|{textureX: number, mirrored: boolean, spriteTexture: HTMLImageElement|null, isDirectional: boolean}} The texture X coordinate (0 to 1) or object with directional info
   * @private
   */
  _calculateTextureX(boundary, point, angle) {
    // 8-directional sprites with individual images (new system)
    if (boundary.directionalSprites && boundary.isSprite) {
      // Use vector projection to get the correct position along the boundary
      const abx = boundary.b.x - boundary.a.x;
      const aby = boundary.b.y - boundary.a.y;
      const apx = point.x - boundary.a.x;
      const apy = point.y - boundary.a.y;
      
      const dotAB = abx * abx + aby * aby;
      const dotAP_AB = apx * abx + apy * aby;
      let localX = dotAP_AB / dotAB;
      
      if (localX < 0) localX = 0;
      if (localX > 1) localX = 1;
      
      // Get directional frame info based on player position
      const frameInfo = boundary.getDirectionalSpriteFrame(this.pos.x, this.pos.y);
      
      // Return object with individual sprite texture and mirroring info
      return { 
        textureX: localX, 
        mirrored: frameInfo.mirrored, 
        spriteTexture: frameInfo.spriteTexture,
        isDirectional: true 
      };
    }
    
    // 8-directional sprites with sprite sheet (legacy system)
    if (boundary.spriteSheet && boundary.isSprite) {
      // Use vector projection to get the correct position along the boundary
      // This handles rotated boundaries correctly
      const abx = boundary.b.x - boundary.a.x;
      const aby = boundary.b.y - boundary.a.y;
      const apx = point.x - boundary.a.x;
      const apy = point.y - boundary.a.y;
      
      // Project point onto the line from A to B
      // t = (AP · AB) / (AB · AB) where t is the parameter along the line
      const dotAB = abx * abx + aby * aby;
      const dotAP_AB = apx * abx + apy * aby;
      let localX = dotAP_AB / dotAB;
      
      // Clamp to 0-1 range
      if (localX < 0) localX = 0;
      if (localX > 1) localX = 1;
      
      // Get directional frame info based on player position
      const frameInfo = boundary.getDirectionalSpriteFrame(this.pos.x, this.pos.y);
      
      // If mirrored, flip the local X coordinate
      if (frameInfo.mirrored) {
        localX = 1 - localX;
      }
      
      // Calculate texture coordinates for the selected frame
      // Each frame occupies 1/columns of the texture width
      const columns = boundary.spriteSheet.columns;
      const frameIndex = frameInfo.frameIndex;
      
      // Calculate pixel positions for this frame
      // Frame starts at (frameIndex / columns) and ends at ((frameIndex + 1) / columns)
      const frameStart = frameIndex / columns;
      const frameEnd = (frameIndex + 1) / columns;
      
      // Map localX (0-1) to the frame range with small inset to avoid edge bleeding
      const inset = boundary.spriteSheet.frameInset || 0.02;
      const insetStart = frameStart + inset / columns;
      const insetEnd = frameEnd - inset / columns;
      
      const textureX = insetStart + localX * (insetEnd - insetStart);
      
      // Return object with mirroring info for the renderer
      return { textureX, mirrored: frameInfo.mirrored, spriteTexture: null, isDirectional: true };
    }
    
    // Sprites/transparent textures always stretch (no tiling)
    if (boundary.isSprite || boundary.isTransparent) {
      if (boundary.isCurved) {
        return boundary.getTextureX(angle);
      }
      
      const dx = point.x - boundary.a.x;
      const dy = point.y - boundary.a.y;
      const distFromA = Math.sqrt(dx * dx + dy * dy);
      
      let textureX = distFromA / boundary.length;
      if (textureX < 0) textureX = 0;
      if (textureX > 1) textureX -= Math.floor(textureX);
      
      return textureX;
    }
    
    // Regular walls use tiling based on texture size
    if (!boundary.texture || !boundary.texture.complete) {
      return 0;
    }
    
    const textureWidth = boundary.texture.width;
    const textureWorldWidth = textureWidth / PIXELS_PER_WORLD_UNIT;
    
    // Handle curved walls
    if (boundary.isCurved) {
      const normalizedPos = boundary.getTextureX(angle);
      const repeatCount = boundary.arcLength / textureWorldWidth;
      let tiledX = normalizedPos * repeatCount;
      tiledX = tiledX - Math.floor(tiledX); // Faster than modulo for positive numbers
      return tiledX;
    }
    
    // Handle straight walls
    const dx = point.x - boundary.a.x;
    const dy = point.y - boundary.a.y;
    const distFromA = Math.sqrt(dx * dx + dy * dy);
    
    const repeatCount = boundary.length / textureWorldWidth;
    let textureX = (distFromA / boundary.length) * repeatCount;
    textureX = textureX - Math.floor(textureX);
    
    return textureX;
  }
}

export default CameraClass;
