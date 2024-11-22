import CameraClass from './CameraClass.js';
import RayClass from './RayClass.js';

/**
 * @typedef {Object} EnemyDetection
 * @property {boolean} isDetected - Whether the user is detected.
 * @property {number|null} distance - The distance to the user if detected, or `null` otherwise.
 * @property {Object|null} userPosition - The user's position {x, y} if detected, or `null` otherwise.
 */

class EnemyClass {
  /**
   * Creates an enemy instance with vision and movement capabilities
   * @param {Object} options - Enemy configuration
   * @param {number} options.x - Initial x position
   * @param {number} options.y - Initial y position
   * @param {number} options.viewDirection - Initial view direction in degrees
   * @param {number} options.fov - Field of view in degrees
   * @param {number} options.rayCount - Number of rays for vision
   * @param {number} options.visibilityDistance - Maximum distance to detect the user
   * @param {number} options.moveSpeed - Movement speed multiplier
   */
  constructor({
    x,
    y,
    viewDirection = 0,
    fov = 60,
    rayCount = 200,
    visibilityDistance = 300,
    moveSpeed = 0
  }) {
    this.pos = { x, y };
    this.viewDirection = viewDirection;
    this.fov = fov;
    this.visibilityDistance = visibilityDistance;
    this.moveSpeed = moveSpeed;

    // Movement state
    this.moveForwards = false;
    this.moveBackwards = false;
    this.moveRight = false;
    this.moveLeft = false;

    // Vision system
    this.camera = new CameraClass({
      x,
      y,
      fov,
      rayCount,
      viewDirection
    });
  }

  /**
   * Updates the enemy's position and vision
   * @param {number} deltaTime - Time elapsed since the last frame
   */
  update(deltaTime) {
    this.updatePosition(deltaTime);
    this.camera.update(this.pos, this.viewDirection);
  }

  /**
   * Updates the enemy's position based on movement state
   * @param {number} deltaTime - Time elapsed since the last frame
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
   * Updates the enemy's view direction
   * @param {number} newDirection - New view direction in degrees
   */
  updateViewDirection(newDirection) {
    this.viewDirection = ((newDirection % 360) + 360) % 360;
    this.camera.update(this.pos, this.viewDirection);
  }

  /**
   * Detects if the player is visible to the enemy.
   * @param {Player} player - The player object to check for detection.
   * @param {Array<Boundaries>} boundaries - Array of boundary objects for the scene.
   * @param {CameraClass} camera - Camera instance for raycasting.
   * @returns {EnemyDetection} Detection result.
   */
  detectPlayer(player, boundaries, camera) {
    const dx = player.pos.x - this.pos.x;
    const dy = player.pos.y - this.pos.y;
    const distance = Math.hypot(dx, dy);

    // Check if the player is within visibility distance
    if (distance > this.visibilityDistance) {
      return { isDetected: false, distance: null, userPosition: null, relativeAngle: null };
    }

    // Calculate the angle to the player
    const angleToPlayer = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;

    // Normalize the relative angle to the enemy's view
    const relativeAngle = ((angleToPlayer - this.viewDirection + 360) % 360);

    // Check if the player is within the field of view
    if (relativeAngle <= this.fov / 2 || relativeAngle >= 360 - this.fov / 2) {
      // Create a ray to the player and check for boundary intersections
      const ray = new RayClass(this.pos.x, this.pos.y, (angleToPlayer * Math.PI) / 180);
      let closestBoundary = null;

      for (const boundary of boundaries) {
        const result = ray.cast(boundary);

        if (result) {
          const boundaryDistance = Math.hypot(
            result.point.x - this.pos.x,
            result.point.y - this.pos.y
          );

          // If a boundary is closer than the player, visibility is blocked
          if (boundaryDistance < distance) {
            closestBoundary = result;
            break;
          }
        }
      }

      // If no closer boundary, the player is visible
      if (!closestBoundary) {
        return {
          isDetected: true,
          distance,
          userPosition: player.pos,
          relativeAngle
        };
      }
    }

    // Player not detected
    return { isDetected: false, distance: null, userPosition: null, relativeAngle: null };
  }
}

export default EnemyClass;
