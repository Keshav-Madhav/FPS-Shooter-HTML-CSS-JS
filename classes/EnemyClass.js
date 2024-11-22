import CameraClass from './CameraClass.js';
import RayClass from './RayClass.js';

class EnemyClass {
  /**
   * Creates an enemy instance with vision and automated movement capabilities
   * @param {Object} options - Enemy configuration
   * @param {number} options.x - Initial x position
   * @param {number} options.y - Initial y position
   * @param {number} options.viewDirection - Initial view direction in degrees
   * @param {number} options.fov - Field of view in degrees
   * @param {number} options.rayCount - Number of rays for vision
   * @param {number} options.visibilityDistance - Maximum distance to detect the user
   * @param {number[]} [options.rotationStops] - Array of angles for rotation animation
   * @param {number} [options.rotationTime=1] - Duration in seconds for each rotation step
   * @param {boolean} [options.repeatRotation=false] - Whether to repeat the rotation animation
   * @param {Array<{x: number, y: number}>} [options.moveStops] - Array of relative movement vectors
   * @param {number} [options.moveTime=1] - Duration in seconds for each movement step
   * @param {boolean} [options.repeatMovement=false] - Whether to repeat the movement pattern
   */
  constructor({
    x,
    y,
    viewDirection = 0,
    fov = 60,
    rayCount = 200,
    visibilityDistance = 300,
    rotationStops = [],
    rotationTime = 1,
    repeatRotation = false,
    moveStops = [],
    moveTime = 1,
    repeatMovement = false
  }) {
    this.pos = { x, y };
    this.initialPos = { x, y };
    this.viewDirection = viewDirection;
    this.initialViewDirection = viewDirection;
    this.fov = fov;
    this.visibilityDistance = visibilityDistance;

    // Rotation animation properties
    this.rotationStops = rotationStops;
    this.rotationTime = rotationTime;
    this.repeatRotation = repeatRotation;
    this.currentRotationIndex = 0;
    this.rotationAccumulatedTime = 0;
    this.lastRotationFrameTime = performance.now() / 1000;
    this.isRotating = rotationStops.length > 0;
    this.currentAngle = viewDirection;
    this.targetAngle = this.calculateNextTargetAngle();

    // Movement animation properties
    this.moveStops = moveStops;
    this.moveTime = moveTime;
    this.repeatMovement = repeatMovement;
    this.currentMoveIndex = 0;
    this.moveAccumulatedTime = 0;
    this.lastMoveFrameTime = performance.now() / 1000;
    this.isMoving = moveStops.length > 0;
    this.currentPos = { ...this.pos };
    this.targetPos = this.calculateNextTargetPosition();

    this.wasDetected = false; // Track if enemy was previously detecting player

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
   * Calculates the next target position based on current movement index
   * @private
   * @returns {Object} The next target position {x, y}
   */
  calculateNextTargetPosition() {
    if (!this.isMoving || this.moveStops.length === 0) {
      return { ...this.pos };
    }

    let accumulatedX = this.initialPos.x;
    let accumulatedY = this.initialPos.y;
    
    for (let i = 0; i <= this.currentMoveIndex; i++) {
      accumulatedX += this.moveStops[i].x;
      accumulatedY += this.moveStops[i].y;
    }
    
    return { x: accumulatedX, y: accumulatedY };
  }

  /**
   * Updates the enemy's position and vision
   * @param {number} normalizedDeltaTime - Normalized delta time from the game loop
   */
  update(normalizedDeltaTime) {
    // Only update movement and rotation if not currently detecting a player
    if (!this.wasDetected) {
      this.updateMovement();
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

    const currentTime = performance.now() / 1000;
    const frameDeltaTime = currentTime - this.lastRotationFrameTime;
    this.rotationAccumulatedTime += frameDeltaTime;
    this.lastRotationFrameTime = currentTime;

    const progress = Math.min(this.rotationAccumulatedTime / this.rotationTime, 1);

    if (progress >= 1) {
      // Complete current rotation
      this.currentAngle = this.targetAngle;
      this.viewDirection = this.currentAngle;
      this.rotationAccumulatedTime = 0;
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
   * Updates the movement animation using real time
   * @private
   */
  updateMovement() {
    if (!this.isMoving) return;

    const currentTime = performance.now() / 1000;
    const frameDeltaTime = currentTime - this.lastMoveFrameTime;
    this.moveAccumulatedTime += frameDeltaTime;
    this.lastMoveFrameTime = currentTime;

    const progress = Math.min(this.moveAccumulatedTime / this.moveTime, 1);

    if (progress >= 1) {
      // Complete current movement
      this.pos = { ...this.targetPos };
      this.currentPos = { ...this.targetPos };
      this.moveAccumulatedTime = 0;
      this.currentMoveIndex++;

      // Check if we should continue moving
      if (this.currentMoveIndex >= this.moveStops.length) {
        if (this.repeatMovement) {
          // Reset to start for repeated animation
          this.currentMoveIndex = 0;
          this.currentPos = { ...this.targetPos };
          this.targetPos = this.calculateNextTargetPosition();
        } else {
          // Stop movement
          this.isMoving = false;
          return;
        }
      } else {
        // Move to next position in sequence
        this.targetPos = this.calculateNextTargetPosition();
      }
    } else {
      // Interpolate between current and target position
      this.pos.x = this.currentPos.x + (this.targetPos.x - this.currentPos.x) * progress;
      this.pos.y = this.currentPos.y + (this.targetPos.y - this.currentPos.y) * progress;
    }
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