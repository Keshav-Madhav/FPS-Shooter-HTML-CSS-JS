/**
 * Web Worker for offloading raycasting calculations.
 * Performs ray-boundary intersection tests in a separate thread.
 * 
 * Communication Protocol:
 * - 'init': Initialize worker with configuration
 * - 'updateBoundaries': Update the boundary data
 * - 'cast': Perform raycasting and return scene data
 */

// Worker state
let config = {
  rayCount: 1000,
  maxRenderDistance: 2000
};

// Boundary data (transferred as typed arrays for performance)
let boundaryData = null;
let boundaryCount = 0;

// Spatial grid implementation (inline to avoid import issues in workers)
class WorkerSpatialGrid {
  constructor(cellSize = 100) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  _getCellKey(cx, cy) {
    return `${cx},${cy}`;
  }

  insert(boundary) {
    const minCellX = Math.floor(boundary.minX * this.invCellSize);
    const maxCellX = Math.floor(boundary.maxX * this.invCellSize);
    const minCellY = Math.floor(boundary.minY * this.invCellSize);
    const maxCellY = Math.floor(boundary.maxY * this.invCellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const key = this._getCellKey(cx, cy);
        if (!this.cells.has(key)) {
          this.cells.set(key, []);
        }
        this.cells.get(key).push(boundary);
      }
    }
  }

  getCell(cx, cy) {
    return this.cells.get(this._getCellKey(cx, cy)) || [];
  }

  getBoundariesAlongRay(originX, originY, dirX, dirY, maxDistance, resultArray, seenSet) {
    seenSet.clear();
    let count = 0;
    
    let cellX = Math.floor(originX * this.invCellSize);
    let cellY = Math.floor(originY * this.invCellSize);
    
    const stepX = dirX > 0 ? 1 : -1;
    const stepY = dirY > 0 ? 1 : -1;
    
    const tDeltaX = dirX !== 0 ? Math.abs(this.cellSize / dirX) : Infinity;
    const tDeltaY = dirY !== 0 ? Math.abs(this.cellSize / dirY) : Infinity;
    
    let tMaxX = dirX > 0 
      ? ((cellX + 1) * this.cellSize - originX) / dirX
      : dirX < 0 ? (cellX * this.cellSize - originX) / dirX : Infinity;
    
    let tMaxY = dirY > 0
      ? ((cellY + 1) * this.cellSize - originY) / dirY
      : dirY < 0 ? (cellY * this.cellSize - originY) / dirY : Infinity;
    
    let t = 0;
    
    // Process starting cell
    const startCell = this.getCell(cellX, cellY);
    for (let i = 0; i < startCell.length; i++) {
      const b = startCell[i];
      if (!seenSet.has(b.id)) {
        seenSet.add(b.id);
        resultArray[count++] = b;
      }
    }
    
    // DDA loop
    while (t < maxDistance) {
      if (tMaxX < tMaxY) {
        t = tMaxX;
        tMaxX += tDeltaX;
        cellX += stepX;
      } else {
        t = tMaxY;
        tMaxY += tDeltaY;
        cellY += stepY;
      }
      
      if (t > maxDistance) break;
      
      const cell = this.getCell(cellX, cellY);
      for (let i = 0; i < cell.length; i++) {
        const b = cell[i];
        if (!seenSet.has(b.id)) {
          seenSet.add(b.id);
          resultArray[count++] = b;
        }
      }
    }
    
    return count;
  }

  buildFromBoundaries(boundaries) {
    this.clear();
    for (let i = 0; i < boundaries.length; i++) {
      this.insert(boundaries[i]);
    }
  }
}

// Spatial grid instance
const spatialGrid = new WorkerSpatialGrid(100);

// Pre-allocated arrays for ray casting
let rayResultArray = new Array(500);
let seenSet = new Set();

// Pre-allocated output buffers
let distanceBuffer = null;
let textureXBuffer = null;
let boundaryIndexBuffer = null;

/**
 * Casts a ray against a straight boundary
 * Returns distance along ray or null if no intersection
 */
function castRayAgainstBoundary(rayPosX, rayPosY, rayDirX, rayDirY, boundary) {
  // Wall endpoints
  const x1 = boundary.ax;
  const y1 = boundary.ay;
  const x2 = boundary.bx;
  const y2 = boundary.by;

  // Wall direction vector
  const wx = x2 - x1;
  const wy = y2 - y1;
  
  // Calculate denominator
  const denominator = wx * rayDirY - wy * rayDirX;
  
  // Parallel check
  if (denominator > -0.0001 && denominator < 0.0001) return null;
  
  // Vector from wall start to ray origin
  const ox = rayPosX - x1;
  const oy = rayPosY - y1;
  
  // Calculate intersection parameters
  const invDenom = 1 / denominator;
  const t = (ox * rayDirY - oy * rayDirX) * invDenom;
  const u = (ox * wy - oy * wx) * invDenom;

  // Check validity
  if (t > 0 && t < 1 && u > 0) {
    return {
      distance: u,
      textureX: t,
      pointX: x1 + t * wx,
      pointY: y1 + t * wy
    };
  }
  
  return null;
}

/**
 * Casts a ray against a curved boundary (arc)
 */
function castRayAgainstCurvedBoundary(rayPosX, rayPosY, rayDirX, rayDirY, boundary) {
  const cx = boundary.centerX;
  const cy = boundary.centerY;
  const radius = boundary.radius;
  
  // Vector from ray origin to circle center
  const ocX = rayPosX - cx;
  const ocY = rayPosY - cy;
  
  // Quadratic coefficients
  const a = rayDirX * rayDirX + rayDirY * rayDirY;
  const b = 2 * (ocX * rayDirX + ocY * rayDirY);
  const c = ocX * ocX + ocY * ocY - radius * radius;
  
  const discriminant = b * b - 4 * a * c;
  
  if (discriminant < 0) return null;
  
  const sqrtDisc = Math.sqrt(discriminant);
  const inv2a = 1 / (2 * a);
  
  // Two possible intersections
  const t1 = (-b - sqrtDisc) * inv2a;
  const t2 = (-b + sqrtDisc) * inv2a;
  
  // Check both intersections against arc range
  const startAngle = boundary.startAngle;
  const endAngle = boundary.endAngle;
  
  let closestT = Infinity;
  let hitAngle = 0;
  
  for (const t of [t1, t2]) {
    if (t > 0.001 && t < closestT) {
      const hitX = rayPosX + rayDirX * t;
      const hitY = rayPosY + rayDirY * t;
      const angle = Math.atan2(hitY - cy, hitX - cx);
      
      // Check if angle is within arc
      let normalizedAngle = angle;
      while (normalizedAngle < startAngle) normalizedAngle += Math.PI * 2;
      while (normalizedAngle > endAngle) normalizedAngle -= Math.PI * 2;
      
      if (normalizedAngle >= startAngle && normalizedAngle <= endAngle) {
        closestT = t;
        hitAngle = angle;
      }
    }
  }
  
  if (closestT < Infinity) {
    // Calculate texture X based on position along arc
    const arcRange = endAngle - startAngle;
    const textureX = (hitAngle - startAngle) / arcRange;
    
    return {
      distance: closestT,
      textureX: textureX < 0 ? textureX + 1 : textureX,
      angle: hitAngle
    };
  }
  
  return null;
}

/**
 * Performs raycasting for a batch of rays
 * Uses SIMD-like processing by handling 4 rays at a time
 */
function castRayBatch(rayData, boundaries, startIdx, batchSize = 4) {
  const results = [];
  
  for (let i = 0; i < batchSize; i++) {
    const rayIdx = startIdx + i;
    if (rayIdx >= rayData.count) break;
    
    const posX = rayData.posX;
    const posY = rayData.posY;
    const dirX = rayData.directions[rayIdx * 2];
    const dirY = rayData.directions[rayIdx * 2 + 1];
    const cosCorrection = rayData.cosCache[rayIdx];
    
    let closestDist = Infinity;
    let closestTextureX = 0;
    let closestBoundaryIdx = -1;
    
    // Get boundaries along this ray using spatial grid
    const boundaryCount = spatialGrid.getBoundariesAlongRay(
      posX, posY, dirX, dirY, 
      config.maxRenderDistance,
      rayResultArray, seenSet
    );
    
    // Test each boundary
    for (let j = 0; j < boundaryCount; j++) {
      const boundary = rayResultArray[j];
      
      let result;
      if (boundary.isCurved) {
        result = castRayAgainstCurvedBoundary(posX, posY, dirX, dirY, boundary);
      } else {
        result = castRayAgainstBoundary(posX, posY, dirX, dirY, boundary);
      }
      
      if (result && result.distance < closestDist) {
        // Apply fisheye correction
        const correctedDist = result.distance * cosCorrection;
        if (correctedDist < closestDist) {
          closestDist = correctedDist;
          closestTextureX = result.textureX;
          closestBoundaryIdx = boundary.id;
        }
      }
    }
    
    results.push({
      distance: closestDist,
      textureX: closestTextureX,
      boundaryIndex: closestBoundaryIdx
    });
  }
  
  return results;
}

/**
 * Main raycasting function - processes all rays
 */
function performRaycasting(rayData) {
  const rayCount = rayData.count;
  
  // Ensure output buffers are allocated
  if (!distanceBuffer || distanceBuffer.length !== rayCount) {
    distanceBuffer = new Float32Array(rayCount);
    textureXBuffer = new Float32Array(rayCount);
    boundaryIndexBuffer = new Int32Array(rayCount);
  }
  
  // Process rays in batches of 4 (SIMD-like)
  const BATCH_SIZE = 4;
  
  for (let i = 0; i < rayCount; i += BATCH_SIZE) {
    const batchResults = castRayBatch(rayData, boundaryData, i, BATCH_SIZE);
    
    for (let j = 0; j < batchResults.length; j++) {
      const idx = i + j;
      distanceBuffer[idx] = batchResults[j].distance;
      textureXBuffer[idx] = batchResults[j].textureX;
      boundaryIndexBuffer[idx] = batchResults[j].boundaryIndex;
    }
  }
  
  return {
    distances: distanceBuffer,
    textureXs: textureXBuffer,
    boundaryIndices: boundaryIndexBuffer
  };
}

/**
 * Converts boundary objects to a format suitable for worker processing
 */
function processBoundaryData(boundaries) {
  boundaryData = boundaries.map((b, idx) => {
    if (b.isCurved) {
      return {
        id: idx,
        isCurved: true,
        centerX: b.centerX,
        centerY: b.centerY,
        radius: b.radius,
        startAngle: b.startAngle,
        endAngle: b.endAngle,
        minX: b.centerX - b.radius,
        maxX: b.centerX + b.radius,
        minY: b.centerY - b.radius,
        maxY: b.centerY + b.radius,
        isTransparent: b.isTransparent || false
      };
    } else {
      return {
        id: idx,
        isCurved: false,
        ax: b.a.x,
        ay: b.a.y,
        bx: b.b.x,
        by: b.b.y,
        minX: Math.min(b.a.x, b.b.x),
        maxX: Math.max(b.a.x, b.b.x),
        minY: Math.min(b.a.y, b.b.y),
        maxY: Math.max(b.a.y, b.b.y),
        isTransparent: b.isTransparent || false
      };
    }
  });
  
  boundaryCount = boundaryData.length;
  spatialGrid.buildFromBoundaries(boundaryData);
}

// Message handler
self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'init':
      config = { ...config, ...data };
      self.postMessage({ type: 'ready' });
      break;
      
    case 'updateBoundaries':
      processBoundaryData(data.boundaries);
      self.postMessage({ 
        type: 'boundariesUpdated',
        count: boundaryCount,
        gridStats: {
          cellCount: spatialGrid.cells.size
        }
      });
      break;
      
    case 'cast':
      const { rayData } = data;
      const startTime = performance.now();
      
      const result = performRaycasting(rayData);
      
      const castTime = performance.now() - startTime;
      
      // Transfer buffers for zero-copy performance
      self.postMessage({
        type: 'castResult',
        distances: result.distances,
        textureXs: result.textureXs,
        boundaryIndices: result.boundaryIndices,
        castTime
      }, [
        result.distances.buffer,
        result.textureXs.buffer,
        result.boundaryIndices.buffer
      ]);
      break;
      
    case 'ping':
      self.postMessage({ type: 'pong', timestamp: performance.now() });
      break;
  }
};

// Signal that worker is loaded
self.postMessage({ type: 'loaded' });
