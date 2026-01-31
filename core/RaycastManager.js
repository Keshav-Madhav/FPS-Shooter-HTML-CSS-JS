/**
 * RaycastManager - Manages raycasting with optional Web Worker offloading.
 * Provides a unified interface whether using main thread or worker.
 * Falls back gracefully if workers are not available.
 */

import SpatialGrid from '../utils/SpatialGrid.js';
import { DEG_TO_RAD } from '../utils/mathLUT.js';

// Configuration
const WORKER_PATH = './workers/RaycastWorker.js';
const MAX_RENDER_DISTANCE = 2000;
const BATCH_SIZE = 4; // SIMD-like batch size

class RaycastManager {
  /**
   * Creates a RaycastManager
   * @param {Object} options - Configuration options
   * @param {boolean} options.useWorker - Whether to use Web Worker
   * @param {number} options.rayCount - Number of rays
   * @param {number} options.cellSize - Spatial grid cell size
   */
  constructor(options = {}) {
    this.useWorker = options.useWorker ?? true;
    this.rayCount = options.rayCount ?? 1000;
    this.cellSize = options.cellSize ?? 100;
    
    // Worker state
    this.worker = null;
    this.workerReady = false;
    this.workerPending = false;
    
    // Spatial grid for main thread fallback
    this.spatialGrid = new SpatialGrid(this.cellSize);
    
    // Pre-allocated buffers for main thread casting
    this._rayResultArray = new Array(500);
    this._seenSet = new Set();
    
    // Pre-allocated output buffers
    this._distanceBuffer = new Float32Array(this.rayCount);
    this._textureXBuffer = new Float32Array(this.rayCount);
    this._boundaryIndexBuffer = new Int32Array(this.rayCount);
    
    // Ray data buffer for worker communication
    this._rayDirections = new Float32Array(this.rayCount * 2);
    this._cosCache = new Float32Array(this.rayCount);
    
    // Callback for async worker results
    this._pendingCallback = null;
    
    // Stats
    this.stats = {
      lastCastTime: 0,
      avgCastTime: 0,
      castCount: 0,
      usingWorker: false
    };
    
    // Boundaries reference
    this._boundaries = [];
    this._boundariesDirty = true;
    
    // Initialize worker if requested
    if (this.useWorker) {
      this._initWorker();
    }
  }

  /**
   * Initializes the Web Worker
   * @private
   */
  _initWorker() {
    try {
      this.worker = new Worker(WORKER_PATH, { type: 'module' });
      
      this.worker.onmessage = (e) => {
        this._handleWorkerMessage(e.data);
      };
      
      this.worker.onerror = (e) => {
        console.warn('RaycastManager: Worker error, falling back to main thread', e);
        this.useWorker = false;
        this.workerReady = false;
        this.worker = null;
      };
      
      // Send initialization config
      this.worker.postMessage({
        type: 'init',
        data: {
          rayCount: this.rayCount,
          maxRenderDistance: MAX_RENDER_DISTANCE,
          cellSize: this.cellSize
        }
      });
      
    } catch (e) {
      console.warn('RaycastManager: Failed to create worker, using main thread', e);
      this.useWorker = false;
    }
  }

  /**
   * Handles messages from the worker
   * @param {Object} data - Message data
   * @private
   */
  _handleWorkerMessage(data) {
    switch (data.type) {
      case 'loaded':
        console.log('RaycastManager: Worker loaded');
        break;
        
      case 'ready':
        this.workerReady = true;
        this.stats.usingWorker = true;
        console.log('RaycastManager: Worker ready');
        break;
        
      case 'boundariesUpdated':
        console.log(`RaycastManager: Worker updated ${data.count} boundaries`);
        break;
        
      case 'castResult':
        this.workerPending = false;
        this.stats.lastCastTime = data.castTime;
        this._updateAvgCastTime(data.castTime);
        
        // Copy results back (buffers were transferred)
        this._distanceBuffer = new Float32Array(data.distances);
        this._textureXBuffer = new Float32Array(data.textureXs);
        this._boundaryIndexBuffer = new Int32Array(data.boundaryIndices);
        
        if (this._pendingCallback) {
          this._pendingCallback({
            distances: this._distanceBuffer,
            textureXs: this._textureXBuffer,
            boundaryIndices: this._boundaryIndexBuffer
          });
          this._pendingCallback = null;
        }
        break;
    }
  }

  /**
   * Updates average cast time statistic
   * @param {number} time - Latest cast time
   * @private
   */
  _updateAvgCastTime(time) {
    this.stats.castCount++;
    const alpha = 0.1; // Exponential moving average factor
    this.stats.avgCastTime = this.stats.avgCastTime * (1 - alpha) + time * alpha;
  }

  /**
   * Updates the boundaries for raycasting
   * @param {Array} boundaries - Array of boundary objects
   */
  updateBoundaries(boundaries) {
    this._boundaries = boundaries;
    this._boundariesDirty = true;
    
    // Update spatial grid for main thread
    this.spatialGrid.buildFromBoundaries(boundaries);
    
    // Send to worker if available
    if (this.workerReady && this.worker) {
      // Serialize boundaries for worker
      const serialized = boundaries.map((b, idx) => ({
        id: idx,
        isCurved: b.isCurved || false,
        isTransparent: b.isTransparent || false,
        isSprite: b.isSprite || false,
        // Straight wall
        a: b.a ? { x: b.a.x, y: b.a.y } : null,
        b: b.b ? { x: b.b.x, y: b.b.y } : null,
        // Curved wall
        centerX: b.centerX,
        centerY: b.centerY,
        radius: b.radius,
        startAngle: b.startAngle,
        endAngle: b.endAngle
      }));
      
      this.worker.postMessage({
        type: 'updateBoundaries',
        data: { boundaries: serialized }
      });
    }
  }

  /**
   * Casts a single ray against a boundary (main thread)
   * @param {number} rayPosX - Ray origin X
   * @param {number} rayPosY - Ray origin Y
   * @param {number} rayDirX - Ray direction X
   * @param {number} rayDirY - Ray direction Y
   * @param {Object} boundary - Boundary to test
   * @returns {Object|null} Intersection result or null
   * @private
   */
  _castRayAgainstBoundary(rayPosX, rayPosY, rayDirX, rayDirY, boundary) {
    if (boundary.isCurved) {
      return this._castAgainstCurved(rayPosX, rayPosY, rayDirX, rayDirY, boundary);
    }
    
    // Straight wall intersection
    const x1 = boundary.a.x;
    const y1 = boundary.a.y;
    const x2 = boundary.b.x;
    const y2 = boundary.b.y;

    const wx = x2 - x1;
    const wy = y2 - y1;
    
    const denominator = wx * rayDirY - wy * rayDirX;
    
    if (denominator > -0.0001 && denominator < 0.0001) return null;
    
    const ox = rayPosX - x1;
    const oy = rayPosY - y1;
    
    const invDenom = 1 / denominator;
    const t = (ox * rayDirY - oy * rayDirX) * invDenom;
    const u = (ox * wy - oy * wx) * invDenom;

    if (t > 0 && t < 1 && u > 0) {
      return {
        distance: u,
        textureX: t,
        point: { x: x1 + t * wx, y: y1 + t * wy },
        boundary
      };
    }
    
    return null;
  }

  /**
   * Casts ray against curved boundary
   * @private
   */
  _castAgainstCurved(rayPosX, rayPosY, rayDirX, rayDirY, boundary) {
    const cx = boundary.centerX;
    const cy = boundary.centerY;
    const radius = boundary.radius;
    
    const ocX = rayPosX - cx;
    const ocY = rayPosY - cy;
    
    const a = rayDirX * rayDirX + rayDirY * rayDirY;
    const b = 2 * (ocX * rayDirX + ocY * rayDirY);
    const c = ocX * ocX + ocY * ocY - radius * radius;
    
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) return null;
    
    const sqrtDisc = Math.sqrt(discriminant);
    const inv2a = 1 / (2 * a);
    
    const t1 = (-b - sqrtDisc) * inv2a;
    const t2 = (-b + sqrtDisc) * inv2a;
    
    const TWO_PI = Math.PI * 2;
    let closestT = Infinity;
    let hitAngle = 0;
    
    for (const t of [t1, t2]) {
      if (t > 0.001 && t < closestT) {
        const hitX = rayPosX + rayDirX * t;
        const hitY = rayPosY + rayDirY * t;
        let angle = Math.atan2(hitY - cy, hitX - cx);
        
        // Normalize angle to arc range
        let normalizedAngle = angle;
        while (normalizedAngle < boundary.startAngle) normalizedAngle += TWO_PI;
        while (normalizedAngle > boundary.endAngle) normalizedAngle -= TWO_PI;
        
        if (normalizedAngle >= boundary.startAngle && normalizedAngle <= boundary.endAngle) {
          closestT = t;
          hitAngle = angle;
        }
      }
    }
    
    if (closestT < Infinity) {
      const arcRange = boundary.endAngle - boundary.startAngle;
      let textureX = (hitAngle - boundary.startAngle) / arcRange;
      if (textureX < 0) textureX += 1;
      
      return {
        distance: closestT,
        textureX,
        angle: hitAngle,
        boundary
      };
    }
    
    return null;
  }

  /**
   * Casts a batch of rays (SIMD-like processing)
   * @param {number} posX - Camera X position
   * @param {number} posY - Camera Y position
   * @param {Array} rays - Array of ray objects
   * @param {Float32Array} cosCache - Fisheye correction values
   * @param {number} startIdx - Starting ray index
   * @param {number} batchSize - Number of rays to process
   * @private
   */
  _castRayBatch(posX, posY, rays, cosCache, startIdx, batchSize) {
    for (let b = 0; b < batchSize; b++) {
      const rayIdx = startIdx + b;
      if (rayIdx >= rays.length) break;
      
      const ray = rays[rayIdx];
      const dirX = ray.dir.x;
      const dirY = ray.dir.y;
      const cosCorrection = cosCache[rayIdx];
      
      let closestDist = Infinity;
      let closestTextureX = 0;
      let closestBoundaryIdx = -1;
      
      // Get boundaries along ray using spatial grid
      const boundaryCount = this.spatialGrid.getBoundariesAlongRayFast(
        posX, posY, dirX, dirY,
        MAX_RENDER_DISTANCE,
        this._rayResultArray,
        this._seenSet
      );
      
      // Test each boundary
      for (let j = 0; j < boundaryCount; j++) {
        const boundary = this._rayResultArray[j];
        
        // Skip transparent for opaque pass
        if (boundary.isTransparent) continue;
        
        const result = this._castRayAgainstBoundary(posX, posY, dirX, dirY, boundary);
        
        if (result) {
          const correctedDist = result.distance * cosCorrection;
          if (correctedDist < closestDist) {
            closestDist = correctedDist;
            closestTextureX = result.textureX;
            closestBoundaryIdx = this._boundaries.indexOf(boundary);
          }
        }
      }
      
      this._distanceBuffer[rayIdx] = closestDist;
      this._textureXBuffer[rayIdx] = closestTextureX;
      this._boundaryIndexBuffer[rayIdx] = closestBoundaryIdx;
    }
  }

  /**
   * Performs synchronous raycasting on main thread
   * @param {Object} camera - Camera object with rays and position
   * @returns {Object} Raycasting results
   */
  castSync(camera) {
    const startTime = performance.now();
    
    const posX = camera.pos.x;
    const posY = camera.pos.y;
    const rays = camera.rays;
    const cosCache = camera.cosCache;
    const rayCount = rays.length;
    
    // Ensure buffers are correct size
    if (this._distanceBuffer.length !== rayCount) {
      this._distanceBuffer = new Float32Array(rayCount);
      this._textureXBuffer = new Float32Array(rayCount);
      this._boundaryIndexBuffer = new Int32Array(rayCount);
    }
    
    // Process rays in batches (SIMD-like)
    for (let i = 0; i < rayCount; i += BATCH_SIZE) {
      this._castRayBatch(posX, posY, rays, cosCache, i, BATCH_SIZE);
    }
    
    const castTime = performance.now() - startTime;
    this.stats.lastCastTime = castTime;
    this._updateAvgCastTime(castTime);
    
    return {
      distances: this._distanceBuffer,
      textureXs: this._textureXBuffer,
      boundaryIndices: this._boundaryIndexBuffer,
      boundaries: this._boundaries
    };
  }

  /**
   * Performs asynchronous raycasting using Web Worker
   * @param {Object} camera - Camera object
   * @param {Function} callback - Callback for results
   */
  castAsync(camera, callback) {
    if (!this.workerReady || this.workerPending) {
      // Fall back to sync if worker not ready or busy
      const result = this.castSync(camera);
      callback(result);
      return;
    }
    
    this.workerPending = true;
    this._pendingCallback = callback;
    
    // Prepare ray data for transfer
    const rays = camera.rays;
    const rayCount = rays.length;
    
    for (let i = 0; i < rayCount; i++) {
      this._rayDirections[i * 2] = rays[i].dir.x;
      this._rayDirections[i * 2 + 1] = rays[i].dir.y;
      this._cosCache[i] = camera.cosCache[i];
    }
    
    // Send to worker
    this.worker.postMessage({
      type: 'cast',
      data: {
        rayData: {
          posX: camera.pos.x,
          posY: camera.pos.y,
          count: rayCount,
          directions: this._rayDirections,
          cosCache: this._cosCache
        }
      }
    });
  }

  /**
   * Gets the spatial grid statistics
   * @returns {Object} Grid statistics
   */
  getGridStats() {
    return this.spatialGrid.getStats();
  }

  /**
   * Gets performance statistics
   * @returns {Object} Performance stats
   */
  getStats() {
    return {
      ...this.stats,
      gridStats: this.getGridStats()
    };
  }

  /**
   * Destroys the manager and terminates worker
   */
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.workerReady = false;
  }
}

export default RaycastManager;
