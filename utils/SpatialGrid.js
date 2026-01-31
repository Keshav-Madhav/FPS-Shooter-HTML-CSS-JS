/**
 * Spatial Grid for efficient boundary lookup during raycasting.
 * Divides the world into cells and stores boundaries in each cell they intersect.
 * Uses DDA algorithm for ray marching through grid cells.
 */

// Default cell size - balance between too many cells (memory) and too few (no benefit)
const DEFAULT_CELL_SIZE = 100;

class SpatialGrid {
  /**
   * Creates a spatial grid for boundary lookup
   * @param {number} cellSize - Size of each grid cell in world units
   */
  constructor(cellSize = DEFAULT_CELL_SIZE) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.cells = new Map();
    this.boundaryCount = 0;
    
    // Cache for cell keys to reduce string allocations
    this._keyCache = new Map();
  }

  /**
   * Clears all cells in the grid
   */
  clear() {
    this.cells.clear();
    this._keyCache.clear();
    this.boundaryCount = 0;
  }

  /**
   * Gets or creates a cell key for given cell coordinates
   * @param {number} cx - Cell X coordinate
   * @param {number} cy - Cell Y coordinate
   * @returns {string} Cell key
   * @private
   */
  _getCellKey(cx, cy) {
    // Use bitwise operations for fast key generation
    // Shift cy by 16 bits and combine with cx (supports coords up to ~32k)
    const numKey = ((cy & 0xFFFF) << 16) | (cx & 0xFFFF);
    
    let key = this._keyCache.get(numKey);
    if (!key) {
      key = `${cx},${cy}`;
      this._keyCache.set(numKey, key);
    }
    return key;
  }

  /**
   * Converts world coordinates to cell coordinates
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   * @returns {{cx: number, cy: number}} Cell coordinates
   */
  worldToCell(x, y) {
    return {
      cx: Math.floor(x * this.invCellSize),
      cy: Math.floor(y * this.invCellSize)
    };
  }

  /**
   * Inserts a boundary into all cells it intersects
   * @param {Object} boundary - Boundary object with a, b points or curved wall properties
   */
  insert(boundary) {
    if (boundary.isCurved) {
      this._insertCurvedBoundary(boundary);
    } else {
      this._insertStraightBoundary(boundary);
    }
    this.boundaryCount++;
  }

  /**
   * Inserts a straight boundary into grid cells
   * @param {Object} boundary - Straight boundary with a and b points
   * @private
   */
  _insertStraightBoundary(boundary) {
    const minCellX = Math.floor(Math.min(boundary.a.x, boundary.b.x) * this.invCellSize);
    const maxCellX = Math.floor(Math.max(boundary.a.x, boundary.b.x) * this.invCellSize);
    const minCellY = Math.floor(Math.min(boundary.a.y, boundary.b.y) * this.invCellSize);
    const maxCellY = Math.floor(Math.max(boundary.a.y, boundary.b.y) * this.invCellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        this._addToCell(cx, cy, boundary);
      }
    }
  }

  /**
   * Inserts a curved boundary into grid cells
   * @param {Object} boundary - Curved boundary with center, radius, startAngle, endAngle
   * @private
   */
  _insertCurvedBoundary(boundary) {
    // Use bounding box of the arc
    const minX = boundary.centerX - boundary.radius;
    const maxX = boundary.centerX + boundary.radius;
    const minY = boundary.centerY - boundary.radius;
    const maxY = boundary.centerY + boundary.radius;

    const minCellX = Math.floor(minX * this.invCellSize);
    const maxCellX = Math.floor(maxX * this.invCellSize);
    const minCellY = Math.floor(minY * this.invCellSize);
    const maxCellY = Math.floor(maxY * this.invCellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        this._addToCell(cx, cy, boundary);
      }
    }
  }

  /**
   * Adds a boundary to a specific cell
   * @param {number} cx - Cell X coordinate
   * @param {number} cy - Cell Y coordinate
   * @param {Object} boundary - Boundary to add
   * @private
   */
  _addToCell(cx, cy, boundary) {
    const key = this._getCellKey(cx, cy);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    // Avoid duplicates in same cell
    if (!cell.includes(boundary)) {
      cell.push(boundary);
    }
  }

  /**
   * Gets all boundaries in a specific cell
   * @param {number} cx - Cell X coordinate
   * @param {number} cy - Cell Y coordinate
   * @returns {Array} Array of boundaries in this cell
   */
  getCell(cx, cy) {
    const key = this._getCellKey(cx, cy);
    return this.cells.get(key) || [];
  }

  /**
   * Gets all unique boundaries along a ray using DDA algorithm.
   * This is the key optimization - instead of testing all boundaries,
   * we only test boundaries in cells the ray passes through.
   * 
   * @param {number} originX - Ray origin X
   * @param {number} originY - Ray origin Y
   * @param {number} dirX - Ray direction X (normalized)
   * @param {number} dirY - Ray direction Y (normalized)
   * @param {number} maxDistance - Maximum ray distance
   * @returns {Set<Object>} Set of unique boundaries to test
   */
  getBoundariesAlongRay(originX, originY, dirX, dirY, maxDistance) {
    const boundaries = new Set();
    
    // Starting cell
    let cellX = Math.floor(originX * this.invCellSize);
    let cellY = Math.floor(originY * this.invCellSize);
    
    // Direction signs
    const stepX = dirX > 0 ? 1 : -1;
    const stepY = dirY > 0 ? 1 : -1;
    
    // Distance to next cell boundary
    const tDeltaX = dirX !== 0 ? Math.abs(this.cellSize / dirX) : Infinity;
    const tDeltaY = dirY !== 0 ? Math.abs(this.cellSize / dirY) : Infinity;
    
    // Calculate initial t values to first cell boundaries
    let tMaxX, tMaxY;
    if (dirX > 0) {
      tMaxX = ((cellX + 1) * this.cellSize - originX) / dirX;
    } else if (dirX < 0) {
      tMaxX = (cellX * this.cellSize - originX) / dirX;
    } else {
      tMaxX = Infinity;
    }
    
    if (dirY > 0) {
      tMaxY = ((cellY + 1) * this.cellSize - originY) / dirY;
    } else if (dirY < 0) {
      tMaxY = (cellY * this.cellSize - originY) / dirY;
    } else {
      tMaxY = Infinity;
    }
    
    // Track current distance along ray
    let t = 0;
    
    // Add boundaries from starting cell
    const startCell = this.getCell(cellX, cellY);
    for (let i = 0; i < startCell.length; i++) {
      boundaries.add(startCell[i]);
    }
    
    // DDA loop - step through cells until we exceed max distance
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
      
      // Add boundaries from this cell
      const cell = this.getCell(cellX, cellY);
      for (let i = 0; i < cell.length; i++) {
        boundaries.add(cell[i]);
      }
    }
    
    return boundaries;
  }

  /**
   * Optimized version that returns an array instead of Set for faster iteration.
   * Uses a temporary array that's reused to avoid allocations.
   * 
   * @param {number} originX - Ray origin X
   * @param {number} originY - Ray origin Y
   * @param {number} dirX - Ray direction X (normalized)
   * @param {number} dirY - Ray direction Y (normalized)
   * @param {number} maxDistance - Maximum ray distance
   * @param {Array} resultArray - Pre-allocated array to store results
   * @param {Set} seenSet - Pre-allocated Set to track seen boundaries
   * @returns {number} Number of boundaries found
   */
  getBoundariesAlongRayFast(originX, originY, dirX, dirY, maxDistance, resultArray, seenSet) {
    seenSet.clear();
    let count = 0;
    
    // Starting cell
    let cellX = Math.floor(originX * this.invCellSize);
    let cellY = Math.floor(originY * this.invCellSize);
    
    // Direction signs
    const stepX = dirX > 0 ? 1 : -1;
    const stepY = dirY > 0 ? 1 : -1;
    
    // Distance to next cell boundary
    const tDeltaX = dirX !== 0 ? Math.abs(this.cellSize / dirX) : Infinity;
    const tDeltaY = dirY !== 0 ? Math.abs(this.cellSize / dirY) : Infinity;
    
    // Calculate initial t values
    let tMaxX, tMaxY;
    if (dirX > 0) {
      tMaxX = ((cellX + 1) * this.cellSize - originX) / dirX;
    } else if (dirX < 0) {
      tMaxX = (cellX * this.cellSize - originX) / dirX;
    } else {
      tMaxX = Infinity;
    }
    
    if (dirY > 0) {
      tMaxY = ((cellY + 1) * this.cellSize - originY) / dirY;
    } else if (dirY < 0) {
      tMaxY = (cellY * this.cellSize - originY) / dirY;
    } else {
      tMaxY = Infinity;
    }
    
    let t = 0;
    
    // Process starting cell
    const startCell = this.getCell(cellX, cellY);
    for (let i = 0; i < startCell.length; i++) {
      const b = startCell[i];
      if (!seenSet.has(b)) {
        seenSet.add(b);
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
        if (!seenSet.has(b)) {
          seenSet.add(b);
          resultArray[count++] = b;
        }
      }
    }
    
    return count;
  }

  /**
   * Builds the grid from an array of boundaries
   * @param {Array} boundaries - Array of boundary objects
   */
  buildFromBoundaries(boundaries) {
    this.clear();
    for (let i = 0; i < boundaries.length; i++) {
      this.insert(boundaries[i]);
    }
  }

  /**
   * Gets statistics about the grid
   * @returns {Object} Grid statistics
   */
  getStats() {
    let totalBoundariesInCells = 0;
    let maxBoundariesPerCell = 0;
    let cellCount = this.cells.size;
    
    for (const cell of this.cells.values()) {
      totalBoundariesInCells += cell.length;
      if (cell.length > maxBoundariesPerCell) {
        maxBoundariesPerCell = cell.length;
      }
    }
    
    return {
      cellSize: this.cellSize,
      cellCount,
      boundaryCount: this.boundaryCount,
      avgBoundariesPerCell: cellCount > 0 ? (totalBoundariesInCells / cellCount).toFixed(2) : 0,
      maxBoundariesPerCell,
      memoryEstimate: `${((cellCount * 50 + totalBoundariesInCells * 8) / 1024).toFixed(2)} KB`
    };
  }
}

export default SpatialGrid;
