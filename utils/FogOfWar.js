import { FogOfWarConfig, PlayerConfig } from "../config/GameConfig.js";

/**
 * FogOfWar - Tracks explored areas on the minimap
 * 
 * Uses a grid-based system to track which cells the player has seen.
 * Exploration is view-based (FOV cone) and respects walls (line of sight).
 * Once an area is explored, it stays visible on the minimap.
 * 
 * Optimizations:
 * - Throttled updates (max ~60fps)
 * - Reduced ray counts for small cells
 * - Deduplication in ray tracing
 */
class FogOfWar {
  /**
   * Creates a fog of war tracker
   * @param {Object} config - Configuration options
   * @param {number} config.cellSize - Size of each exploration cell in world units
   * @param {number} config.mapWidth - Width of the map in world units
   * @param {number} config.mapHeight - Height of the map in world units
   * @param {boolean} config.enabled - Whether fog of war is enabled
   * @param {number} config.rayCount - Number of rays to cast for visibility
   */
  constructor(config = {}) {
    this.cellSize = config.cellSize || FogOfWarConfig.cellSize;
    this.revealDistance = config.revealDistance || FogOfWarConfig.revealDistance;
    this.mapWidth = config.mapWidth || FogOfWarConfig.defaultMapWidth;
    this.mapHeight = config.mapHeight || FogOfWarConfig.defaultMapHeight;
    this.enabled = config.enabled !== undefined ? config.enabled : FogOfWarConfig.enabled;
    this.rayCount = config.rayCount || FogOfWarConfig.rayCount;
    
    // Grid dimensions
    this.gridCols = Math.ceil(this.mapWidth * 2 / this.cellSize) + 1;
    this.gridRows = Math.ceil(this.mapHeight * 2 / this.cellSize) + 1;
    
    // Explored cells (persists until reset)
    this.exploredCells = new Set();
    
    // Seen enemies (persists until reset)
    this.seenEnemies = new Set();
    
    // Boundaries cache (set each frame)
    this.boundaries = [];
    
    // Immediate radius around player (360 degrees, blocked by walls)
    this.immediateRadius = 50;
    this.immediateRayCount = 24; // Reduced for performance
    
    // Throttle exploration updates
    this._lastUpdateTime = 0;
    this._updateInterval = 16; // ~60fps max for exploration updates
  }

  // =========================================
  // COORDINATE CONVERSION
  // =========================================

  /**
   * Converts world coordinates to grid cell
   */
  worldToCell(worldX, worldY) {
    const col = Math.floor((worldX + this.mapWidth) / this.cellSize);
    const row = Math.floor((worldY + this.mapHeight) / this.cellSize);
    return { col, row };
  }

  /**
   * Gets cell key for Set storage
   */
  getCellKey(col, row) {
    return `${col},${row}`;
  }

  // =========================================
  // EXPLORATION UPDATE
  // =========================================

  /**
   * Sets boundaries for line-of-sight checks (call each frame)
   */
  setBoundaries(boundaries) {
    this.boundaries = boundaries;
  }

  /**
   * Updates exploration based on player position and view
   * @param {number} playerX - Player X position
   * @param {number} playerY - Player Y position
   * @param {number} viewDirection - View direction in degrees
   * @param {number} fov - Field of view in degrees
   */
  updateExploration(playerX, playerY, viewDirection = 0, fov = PlayerConfig.baseFov) {
    if (!this.enabled) return;
    
    // Throttle updates for performance (skip throttle on first call)
    const now = performance.now();
    if (this._lastUpdateTime > 0 && now - this._lastUpdateTime < this._updateInterval) return;
    this._lastUpdateTime = now;

    // Reveal immediate surroundings
    this.revealImmediateArea(playerX, playerY);

    // Cast rays within FOV to reveal visible areas
    this.castVisibilityRays(playerX, playerY, viewDirection, fov);
  }

  /**
   * Reveals small 360-degree area around player (blocked by walls)
   */
  revealImmediateArea(playerX, playerY) {
    // Cast rays in all directions around the player
    for (let i = 0; i < this.immediateRayCount; i++) {
      const angleRad = (i / this.immediateRayCount) * Math.PI * 2;
      
      // Cast ray and get distance to nearest wall
      const hitDist = this.castRay(playerX, playerY, angleRad);
      const rayDist = Math.min(hitDist, this.immediateRadius);
      
      // Reveal cells along this ray
      this.revealAlongRay(playerX, playerY, angleRad, rayDist);
    }
  }

  /**
   * Casts rays within FOV to reveal visible cells
   */
  castVisibilityRays(playerX, playerY, viewDirection, fov) {
    const halfFov = fov / 2;
    const startAngle = viewDirection - halfFov;
    const angleStep = fov / this.rayCount;
    
    for (let i = 0; i <= this.rayCount; i++) {
      const angleDeg = startAngle + i * angleStep;
      const angleRad = angleDeg * Math.PI / 180;
      
      const hitDist = this.castRay(playerX, playerY, angleRad);
      const rayDist = Math.min(hitDist, this.revealDistance);
      
      this.revealAlongRay(playerX, playerY, angleRad, rayDist);
    }
  }

  /**
   * Casts a ray and returns distance to nearest wall
   */
  castRay(startX, startY, angleRad) {
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);
    let closestDist = this.revealDistance;
    
    for (const boundary of this.boundaries) {
      if (boundary.isSprite || boundary.isTransparent) continue;
      
      let hitDist = boundary.isCurved
        ? this.rayArcIntersection(startX, startY, dirX, dirY, boundary)
        : this.rayLineIntersection(startX, startY, dirX, dirY, boundary.a, boundary.b);
      
      if (hitDist !== null && hitDist > 1 && hitDist < closestDist) {
        closestDist = hitDist;
      }
    }
    
    return closestDist;
  }

  /**
   * Reveals cells along a ray path (optimized with deduplication)
   */
  revealAlongRay(startX, startY, angleRad, distance) {
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);
    const stepSize = this.cellSize * 0.5;
    const steps = Math.ceil(distance / stepSize);
    
    let lastKey = '';
    for (let i = 0; i <= steps; i++) {
      const dist = i * stepSize;
      if (dist > distance) break;
      
      const cell = this.worldToCell(startX + dirX * dist, startY + dirY * dist);
      const key = this.getCellKey(cell.col, cell.row);
      
      // Skip if same cell as last step (avoids redundant Set adds)
      if (key !== lastKey) {
        this.exploredCells.add(key);
        lastKey = key;
      }
    }
  }

  // =========================================
  // RAY INTERSECTION HELPERS
  // =========================================

  /**
   * Ray-line segment intersection
   */
  rayLineIntersection(rayX, rayY, dirX, dirY, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    
    const denom = dirX * dy - dirY * dx;
    if (Math.abs(denom) < 0.0001) return null;
    
    const t = ((a.x - rayX) * dy - (a.y - rayY) * dx) / denom;
    const u = ((a.x - rayX) * dirY - (a.y - rayY) * dirX) / denom;
    
    return (t > 0 && u >= 0 && u <= 1) ? t : null;
  }

  /**
   * Ray-arc intersection for curved walls
   */
  rayArcIntersection(rayX, rayY, dirX, dirY, boundary) {
    const { centerX: cx, centerY: cy, radius: r, startAngle, endAngle } = boundary;
    
    const ox = rayX - cx;
    const oy = rayY - cy;
    
    const a = dirX * dirX + dirY * dirY;
    const b = 2 * (ox * dirX + oy * dirY);
    const c = ox * ox + oy * oy - r * r;
    
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    
    const sqrtDisc = Math.sqrt(discriminant);
    const candidates = [(-b - sqrtDisc) / (2 * a), (-b + sqrtDisc) / (2 * a)].filter(t => t > 0);
    
    for (const t of candidates) {
      const hitX = rayX + dirX * t;
      const hitY = rayY + dirY * t;
      
      if (this.isAngleInArc(Math.atan2(hitY - cy, hitX - cx), startAngle, endAngle)) {
        return t;
      }
    }
    
    return null;
  }

  /**
   * Checks if an angle is within an arc range (angles in radians)
   */
  isAngleInArc(angle, startAngle, endAngle) {
    const TWO_PI = Math.PI * 2;
    const normalize = a => ((a % TWO_PI) + TWO_PI) % TWO_PI;
    
    const hitAngle = normalize(angle);
    const start = normalize(startAngle);
    const end = normalize(endAngle);
    
    let arcRange = end - start;
    if (arcRange < 0) arcRange += TWO_PI;
    
    let angleDist = hitAngle - start;
    if (angleDist < 0) angleDist += TWO_PI;
    
    return angleDist <= arcRange + 0.01;
  }

  // =========================================
  // VISIBILITY CHECKS
  // =========================================

  /**
   * Checks if a world position is explored
   */
  isExplored(worldX, worldY) {
    if (!this.enabled) return true;
    const cell = this.worldToCell(worldX, worldY);
    return this.exploredCells.has(this.getCellKey(cell.col, cell.row));
  }

  /**
   * Checks if a wall should be visible (either endpoint explored)
   */
  isBoundaryExplored(boundary) {
    if (!this.enabled) return true;
    
    if (boundary.isCurved) {
      return this.isExplored(boundary.centerX, boundary.centerY);
    }
    
    return this.isExplored(boundary.a.x, boundary.a.y) || 
           this.isExplored(boundary.b.x, boundary.b.y);
  }

  /**
   * Checks if an enemy should be visible on minimap
   */
  isEnemyVisible(enemy, player, boundaries) {
    if (!this.enabled) return true;
    
    const inExploredCell = this.isExplored(enemy.pos.x, enemy.pos.y);
    const hasLOS = this.hasLineOfSight(player.pos, enemy.pos, boundaries);
    
    if (hasLOS) {
      this.seenEnemies.add(enemy.id);
      return true;
    }
    
    return inExploredCell && this.seenEnemies.has(enemy.id);
  }

  /**
   * Simple line of sight check between two points
   */
  hasLineOfSight(from, to, boundaries) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return true;
    
    const dirX = dx / dist;
    const dirY = dy / dist;
    
    for (const boundary of boundaries) {
      if (boundary.isSprite || boundary.isTransparent || boundary.isCurved) continue;
      
      const hitDist = this.rayLineIntersection(from.x, from.y, dirX, dirY, boundary.a, boundary.b);
      if (hitDist !== null && hitDist < dist) {
        return false;
      }
    }
    
    return true;
  }

  // =========================================
  // STATE MANAGEMENT
  // =========================================

  /**
   * Resets exploration state
   */
  reset() {
    this.exploredCells.clear();
    this.seenEnemies.clear();
    this.boundaries = [];
    this._lastUpdateTime = 0; // Allow immediate update after reset
  }

  /**
   * Reconfigures for new map dimensions
   */
  configure(mapWidth, mapHeight) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    // Map extends from -mapWidth to +mapWidth, so total is 2x
    this.gridCols = Math.ceil(this.mapWidth * 2 / this.cellSize) + 1;
    this.gridRows = Math.ceil(this.mapHeight * 2 / this.cellSize) + 1;
    this.reset();
  }

  /**
   * Sets reveal distance
   */
  setRevealDistance(distance) {
    this.revealDistance = distance;
  }

  /**
   * Enables/disables fog of war
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Gets stats for debugging
   */
  getStats() {
    return {
      enabled: this.enabled,
      cellSize: this.cellSize,
      revealDistance: this.revealDistance,
      rayCount: this.rayCount,
      exploredCells: this.exploredCells.size,
      totalCells: this.gridCols * this.gridRows,
      percentExplored: ((this.exploredCells.size / (this.gridCols * this.gridRows)) * 100).toFixed(1) + '%',
      seenEnemies: this.seenEnemies.size
    };
  }
}

export default FogOfWar;
