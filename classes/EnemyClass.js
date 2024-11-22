import CameraClass from './CameraClass.js';
import RayClass from './RayClass.js';

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
   * @param {number[]} [options.rotationStops] - Array of angles for rotation animation
   * @param {number} [options.rotationTime=1] - Duration in seconds for each rotation step
   * @param {boolean} [options.repeatRotation=false] - Whether to repeat the rotation animation
   */
  constructor({
    x,
    y,
    viewDirection = 0,
    fov = 60,
    rayCount = 200,
    visibilityDistance = 300,
    moveSpeed = 0,
    rotationStops = [],
    rotationTime = 1,
    repeatRotation = false
  }) {
    this.pos = { x, y };
    this.viewDirection = viewDirection;
    this.initialViewDirection = viewDirection;
    this.fov = fov;
    this.visibilityDistance = visibilityDistance;
    this.moveSpeed = moveSpeed;

    // Rotation animation properties
    this.rotationStops = rotationStops;
    this.rotationTime = rotationTime;
    this.repeatRotation = repeatRotation;
    this.currentRotationIndex = 0;
    this.accumulatedTime = 0;
    this.lastFrameTime = performance.now() / 1000; // Convert to seconds
    this.isRotating = rotationStops.length > 0;
    this.currentAngle = viewDirection;
    this.targetAngle = this.calculateNextTargetAngle();
    this.wasDetected = false; // Track if enemy was previously detecting player

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
   * Calculates the next target angle based on current rotation index
   * @private
   * @returns {number} The next target angle
   */
  calculateNextTargetAngle() {
    if (!this.isRotating || this.rotationStops.length === 0) {
      return this.viewDirection;
    }

    let accumulatedAngle = this.initialViewDirection;
    for (let i = 0; i <= this.currentRotationIndex; i++) {
      accumulatedAngle += this.rotationStops[i];
    }
    return accumulatedAngle;
  }

  /**
   * Updates the enemy's position and vision
   * @param {number} normalizedDeltaTime - Normalized delta time from the game loop
   */
  update(normalizedDeltaTime) {
    this.updatePosition(normalizedDeltaTime);
    
    // Only update rotation if not currently detecting a player
    if (!this.wasDetected) {
      this.updateRotation();
    }
    
    this.camera.update(this.pos, this.viewDirection);
  }

  /**
   * Updates the rotation animation using real time
   * @private
   */
  updateRotation() {
    if (!this.isRotating) return;

    const currentTime = performance.now() / 1000; // Convert to seconds
    const frameDeltaTime = currentTime - this.lastFrameTime;
    this.accumulatedTime += frameDeltaTime;
    this.lastFrameTime = currentTime;

    const progress = Math.min(this.accumulatedTime / this.rotationTime, 1);

    if (progress >= 1) {
      // Complete current rotation
      this.currentAngle = this.targetAngle;
      this.viewDirection = this.currentAngle;
      this.accumulatedTime = 0;
      this.currentRotationIndex++;

      // Check if we should continue rotating
      if (this.currentRotationIndex >= this.rotationStops.length) {
        if (this.repeatRotation) {
          // Reset to start for repeated animation
          this.currentRotationIndex = 0;
          this.currentAngle = this.targetAngle;
          this.targetAngle = this.calculateNextTargetAngle();
        } else {
          // Stop rotation
          this.isRotating = false;
          return;
        }
      } else {
        // Move to next angle in sequence
        this.targetAngle = this.calculateNextTargetAngle();
      }
    } else {
      // Interpolate between current and target angle
      const angleDiff = this.targetAngle - this.currentAngle;
      this.viewDirection = this.currentAngle + (angleDiff * progress);
    }
  }

  /**
   * Updates the enemy's position based on movement state
   * @param {number} normalizedDeltaTime - Normalized delta time from the game loop
   * @private
   */
  updatePosition(normalizedDeltaTime) {
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

    this.pos.x += dx * normalizedDeltaTime;
    this.pos.y += dy * normalizedDeltaTime;
  }

  /**
   * Detects if the player is visible to the enemy.
   * @param {Player} player - The player object to check for detection.
   * @param {Array<Boundaries>} boundaries - Array of boundary objects for the scene.
   * @returns {EnemyDetection} Detection result.
   */
  detectPlayer(player, boundaries) {
    const dx = player.pos.x - this.pos.x;
    const dy = player.pos.y - this.pos.y;
    const distance = Math.hypot(dx, dy);

    // Check if the player is within visibility distance
    if (distance > this.visibilityDistance) {
      this.wasDetected = false;
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
        this.wasDetected = true;
        return {
          isDetected: true,
          distance,
          userPosition: player.pos,
          relativeAngle
        };
      }
    }

    // Player not detected
    this.wasDetected = false;
    return { isDetected: false, distance: null, userPosition: null, relativeAngle: null };
  }
}

export default EnemyClass;