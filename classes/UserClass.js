import CameraClass from './CameraClass.js';
import Boundaries from './BoundariesClass.js';

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
   * Updates the player's position and camera based on movement state
   * @param {number} deltaTime - Time elapsed since last frame
   */
  update(deltaTime) {
    this.updatePosition(deltaTime);
    this.camera.update(this.pos, this.viewDirection);
  }

  /**
   * Updates the player's position based on movement state
   * @param {number} deltaTime - Time elapsed since last frame
   * @private
   */
  updatePosition(deltaTime) {
    const moveDirection = Math.atan2(
      Math.sin((this.viewDirection * Math.PI) / 180),
      Math.cos((this.viewDirection * Math.PI) / 180)
    );
    const strafeDirection = moveDirection + Math.PI / 2;

    let dx = 0;
    let dy = 0;

    if (this.moveForwards) {
      dx += this.moveSpeed * Math.cos(moveDirection);
      dy += this.moveSpeed * Math.sin(moveDirection);
    }
    if (this.moveBackwards) {
      dx -= this.moveSpeed * Math.cos(moveDirection);
      dy -= this.moveSpeed * Math.sin(moveDirection);
    }
    if (this.moveRight) {
      dx += this.moveSpeed * Math.cos(strafeDirection);
      dy += this.moveSpeed * Math.sin(strafeDirection);
    }
    if (this.moveLeft) {
      dx -= this.moveSpeed * Math.cos(strafeDirection);
      dy -= this.moveSpeed * Math.sin(strafeDirection);
    }

    this.pos.x += dx * deltaTime;
    this.pos.y += dy * deltaTime;
  }

  /**
   * Updates the player's view direction and camera
   * @param {number} newDirection - New view direction in degrees
   */
  updateViewDirection(newDirection) {
    this.viewDirection = ((newDirection % 360) + 360) % 360;
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