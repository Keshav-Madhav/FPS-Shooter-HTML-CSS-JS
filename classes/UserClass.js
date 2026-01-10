import CameraClass from './CameraClass.js';
import Boundaries from './BoundariesClass.js';
import { DEG_TO_RAD, HALF_PI, TWO_PI, fastSin, fastCos, normalizeAngle } from '../utils/mathLUT.js';

/**
 * @typedef {Object} RayIntersection
 * @property {number} distance - The perpendicular distance from the camera to the closest boundary.
 * @property {number} textureX - The normalized x-coordinate on the boundary's texture (0 to 1).
 * @property {HTMLImageElement|null} texture - The texture image of the intersected boundary, or `null` if no boundary is hit.
 * @property {Boundaries|null} boundary - The intersected boundary object, or `null` if no intersection occurs.
 */

// Collision constants
const PLAYER_RADIUS = 12; // Player collision radius
const COLLISION_MARGIN = 0.5; // Small margin to prevent floating point issues

class Player {
  /**
   * Creates a player instance with an attached camera
   * @param {Object} options - The configuration object
   * @param {number} options.x - Initial x position
   * @param {number} options.y - Initial y position
   * @param {number} options.viewDirection - Initial view direction in degrees
   * @param {number} options.moveSpeed - Movement speed multiplier
   * @param {number} options.fov - Field of view in degrees
   * @param {number} options.rayCount - Number of rays to cast
   * @param {number} options.collisionRadius - Player collision radius
   */
  constructor({ 
    x, 
    y, 
    viewDirection = 0, 
    moveSpeed = 1, 
    fov = 60, 
    rayCount = 1000,
    collisionRadius = PLAYER_RADIUS
  }) {
    this.pos = { x, y };
    this.viewDirection = viewDirection;
    this.moveSpeed = moveSpeed;
    this.collisionRadius = collisionRadius;
    
    // Movement state
    this.moveForwards = false;
    this.moveBackwards = false;
    this.moveRight = false;
    this.moveLeft = false;
    
    // Boundaries reference for collision detection
    this._boundaries = [];

    // Cached direction values (updated when view direction changes)
    this._cachedViewDirRad = viewDirection * DEG_TO_RAD;
    this._cachedCosView = Math.cos(this._cachedViewDirRad);
    this._cachedSinView = Math.sin(this._cachedViewDirRad);
    this._cachedCosStrafe = Math.cos(this._cachedViewDirRad + HALF_PI);
    this._cachedSinStrafe = Math.sin(this._cachedViewDirRad + HALF_PI);

    // Player's camera
    this.camera = new CameraClass({
      x,
      y,
      fov,
      rayCount,
      viewDirection
    });
  }

  /**
   * Updates cached direction values when view direction changes
   * Uses precise Math.sin/cos for movement accuracy
   * @private
   */
  _updateDirectionCache() {
    this._cachedViewDirRad = this.viewDirection * DEG_TO_RAD;
    this._cachedCosView = Math.cos(this._cachedViewDirRad);
    this._cachedSinView = Math.sin(this._cachedViewDirRad);
    this._cachedCosStrafe = Math.cos(this._cachedViewDirRad + HALF_PI);
    this._cachedSinStrafe = Math.sin(this._cachedViewDirRad + HALF_PI);
  }

  /**
   * Updates the player's position and camera based on movement state
   * @param {number} deltaTime - Time elapsed since last frame
   * @param {Array} [boundaries] - Optional boundaries array for collision detection
   */
  update(deltaTime, boundaries) {
    if (boundaries) {
      this._boundaries = boundaries;
    }
    this.updatePosition(deltaTime);
    
    // Always check for collisions (handles moving walls pushing the player)
    this._resolveStaticCollisions();
    
    this.camera.update(this.pos, this.viewDirection);
  }
  
  /**
   * Resolves collisions with walls even when player is not moving.
   * This handles moving walls that push into the player.
   * @private
   */
  _resolveStaticCollisions() {
    if (this._boundaries.length === 0) return;
    
    // Iterative collision resolution (max 5 iterations for moving walls)
    for (let iter = 0; iter < 5; iter++) {
      let totalPushX = 0;
      let totalPushY = 0;
      let collisionCount = 0;

      for (const boundary of this._boundaries) {
        // Skip transparent boundaries (sprites, etc.)
        if (boundary.isTransparent || boundary.isSprite) continue;

        const collision = boundary.isCurved
          ? this._checkCurvedWallCollision(this.pos.x, this.pos.y, boundary)
          : this._checkStraightWallCollision(this.pos.x, this.pos.y, boundary);

        if (collision) {
          totalPushX += collision.pushX;
          totalPushY += collision.pushY;
          collisionCount++;
        }
      }

      if (collisionCount === 0) break;

      // Apply push to resolve penetration
      this.pos.x += totalPushX;
      this.pos.y += totalPushY;
    }
  }

  /**
   * Updates the player's position based on movement state with collision detection
   * Optimized with cached trig values
   * @param {number} deltaTime - Time elapsed since last frame
   * @private
   */
  updatePosition(deltaTime) {
    let dx = 0;
    let dy = 0;

    // Use cached trig values for movement
    if (this.moveForwards) {
      dx += this._cachedCosView;
      dy += this._cachedSinView;
    }
    if (this.moveBackwards) {
      dx -= this._cachedCosView;
      dy -= this._cachedSinView;
    }
    if (this.moveRight) {
      dx += this._cachedCosStrafe;
      dy += this._cachedSinStrafe;
    }
    if (this.moveLeft) {
      dx -= this._cachedCosStrafe;
      dy -= this._cachedSinStrafe;
    }

    // Only normalize and move if there's actual movement
    if (dx !== 0 || dy !== 0) {
      // Normalize diagonal movement
      const lengthSq = dx * dx + dy * dy;
      if (lengthSq > 1.01) { // Only normalize if moving diagonally
        const invLength = 1 / Math.sqrt(lengthSq);
        dx *= invLength * this.moveSpeed;
        dy *= invLength * this.moveSpeed;
      } else {
        dx *= this.moveSpeed;
        dy *= this.moveSpeed;
      }

      // Apply delta time to get actual movement
      dx *= deltaTime;
      dy *= deltaTime;

      // Calculate new position with collision detection
      const newPos = this._resolveCollision(this.pos.x, this.pos.y, dx, dy);
      this.pos.x = newPos.x;
      this.pos.y = newPos.y;
    }
  }

  /**
   * Resolves collision with walls and returns the final position
   * Uses iterative collision response for smooth wall sliding
   * @param {number} startX - Starting X position
   * @param {number} startY - Starting Y position
   * @param {number} dx - Movement delta X
   * @param {number} dy - Movement delta Y
   * @returns {{x: number, y: number}} The resolved position
   * @private
   */
  _resolveCollision(startX, startY, dx, dy) {
    if (this._boundaries.length === 0) {
      return { x: startX + dx, y: startY + dy };
    }

    let newX = startX + dx;
    let newY = startY + dy;
    
    // Iterative collision resolution (max 3 iterations for complex corners)
    for (let iter = 0; iter < 3; iter++) {
      let totalPushX = 0;
      let totalPushY = 0;
      let collisionCount = 0;

      for (const boundary of this._boundaries) {
        // Skip transparent boundaries (sprites, etc.)
        if (boundary.isTransparent || boundary.isSprite) continue;

        const collision = boundary.isCurved
          ? this._checkCurvedWallCollision(newX, newY, boundary)
          : this._checkStraightWallCollision(newX, newY, boundary);

        if (collision) {
          totalPushX += collision.pushX;
          totalPushY += collision.pushY;
          collisionCount++;
        }
      }

      if (collisionCount === 0) break;

      // Apply averaged push to resolve penetration
      newX += totalPushX;
      newY += totalPushY;
    }

    return { x: newX, y: newY };
  }

  /**
   * Checks collision with a straight wall and returns push vector if colliding
   * @param {number} px - Player X position
   * @param {number} py - Player Y position
   * @param {Boundaries} wall - The wall to check
   * @returns {{pushX: number, pushY: number}|null} Push vector or null if no collision
   * @private
   */
  _checkStraightWallCollision(px, py, wall) {
    // Get wall endpoints
    const ax = wall.a.x;
    const ay = wall.a.y;
    const bx = wall.b.x;
    const by = wall.b.y;

    // Vector from A to B
    const abx = bx - ax;
    const aby = by - ay;
    
    // Vector from A to player
    const apx = px - ax;
    const apy = py - ay;

    // Project player position onto the line segment
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq === 0) return null; // Degenerate wall
    
    // Clamp t to [0, 1] to stay within segment
    let t = (apx * abx + apy * aby) / abLenSq;
    t = Math.max(0, Math.min(1, t));

    // Closest point on segment
    const closestX = ax + t * abx;
    const closestY = ay + t * aby;

    // Distance from player to closest point
    const distX = px - closestX;
    const distY = py - closestY;
    const distSq = distX * distX + distY * distY;
    const minDist = this.collisionRadius + COLLISION_MARGIN;

    if (distSq < minDist * minDist && distSq > 0.0001) {
      // Collision detected - calculate push vector
      const dist = Math.sqrt(distSq);
      const penetration = minDist - dist;
      
      // Normalize and scale by penetration
      const pushX = (distX / dist) * penetration;
      const pushY = (distY / dist) * penetration;

      return { pushX, pushY };
    }

    return null;
  }

  /**
   * Checks collision with a curved wall and returns push vector if colliding
   * @param {number} px - Player X position
   * @param {number} py - Player Y position
   * @param {Object} wall - The curved wall to check
   * @returns {{pushX: number, pushY: number}|null} Push vector or null if no collision
   * @private
   */
  _checkCurvedWallCollision(px, py, wall) {
    // Vector from center to player
    const dx = px - wall.centerX;
    const dy = py - wall.centerY;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);

    if (distFromCenter < 0.0001) {
      // Player is exactly at center - push in any direction
      return { pushX: wall.radius + this.collisionRadius, pushY: 0 };
    }

    // Calculate angle to player
    const angleToPlayer = Math.atan2(dy, dx);
    
    // Check if player's angle is within the arc's range
    if (!this._isAngleInArc(angleToPlayer, wall)) {
      return null;
    }

    // Distance from player to the arc surface
    const distToArc = Math.abs(distFromCenter - wall.radius);
    const minDist = this.collisionRadius + COLLISION_MARGIN;

    if (distToArc < minDist) {
      // Collision detected - calculate push vector
      const penetration = minDist - distToArc;
      
      // Normalize direction from center
      const normX = dx / distFromCenter;
      const normY = dy / distFromCenter;

      // Push direction depends on which side of the arc we're on
      if (distFromCenter < wall.radius) {
        // Player is inside the arc - push outward
        return {
          pushX: -normX * penetration,
          pushY: -normY * penetration
        };
      } else {
        // Player is outside the arc - push outward from arc surface
        return {
          pushX: normX * penetration,
          pushY: normY * penetration
        };
      }
    }

    return null;
  }

  /**
   * Checks if an angle is within a curved wall's arc range
   * @param {number} angle - The angle to check
   * @param {Object} wall - The curved wall
   * @returns {boolean} True if angle is in arc
   * @private
   */
  _isAngleInArc(angle, wall) {
    // Normalize the angle to [0, 2π)
    let normalizedAngle = angle;
    while (normalizedAngle < 0) normalizedAngle += TWO_PI;
    while (normalizedAngle >= TWO_PI) normalizedAngle -= TWO_PI;

    // Normalize start angle
    let normalizedStart = wall.startAngle;
    while (normalizedStart < 0) normalizedStart += TWO_PI;
    while (normalizedStart >= TWO_PI) normalizedStart -= TWO_PI;

    // Calculate arc range
    let arcRange = wall.endAngle - wall.startAngle;
    if (arcRange < 0) arcRange += TWO_PI;

    // Calculate how far the test angle is from start
    let angleDist = normalizedAngle - normalizedStart;
    if (angleDist < 0) angleDist += TWO_PI;

    return angleDist <= arcRange + 0.01;
  }

  /**
   * Updates the player's view direction and camera
   * @param {number} newDirection - New view direction in degrees
   */
  updateViewDirection(newDirection) {
    // Normalize to 0-360 range
    this.viewDirection = ((newDirection % 360) + 360) % 360;
    this._updateDirectionCache();
    this.camera.update(this.pos, this.viewDirection);
  }

  /**
   * Gets the scene data from the camera
   * @param {Array<Boundaries>} boundaries - Array of boundary objects
   * @returns {Array<RayIntersection>} Scene intersection data
   */
  getScene(boundaries) {
    return this.camera.spread(boundaries);
  }
}

export default Player;
