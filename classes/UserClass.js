import CameraClass from './CameraClass.js';
import Boundaries from './BoundariesClass.js';
import { DEG_TO_RAD, HALF_PI, fastSin, fastCos } from '../utils/mathLUT.js';

/**
 * @typedef {Object} RayIntersection
 * @property {number} distance - The perpendicular distance from the camera to the closest boundary.
 * @property {number} textureX - The normalized x-coordinate on the boundary's texture (0 to 1).
 * @property {HTMLImageElement|null} texture - The texture image of the intersected boundary, or `null` if no boundary is hit.
 * @property {Boundaries|null} boundary - The intersected boundary object, or `null` if no intersection occurs.
 */

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
   */
  constructor({ 
    x, 
    y, 
    viewDirection = 0, 
    moveSpeed = 1, 
    fov = 60, 
    rayCount = 1000 
  }) {
    this.pos = { x, y };
    this.viewDirection = viewDirection;
    this.moveSpeed = moveSpeed;
    
    // Movement state
    this.moveForwards = false;
    this.moveBackwards = false;
    this.moveRight = false;
    this.moveLeft = false;

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
   */
  update(deltaTime) {
    this.updatePosition(deltaTime);
    this.camera.update(this.pos, this.viewDirection);
  }

  /**
   * Updates the player's position based on movement state
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
      
      this.pos.x += dx * deltaTime;
      this.pos.y += dy * deltaTime;
    }
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
