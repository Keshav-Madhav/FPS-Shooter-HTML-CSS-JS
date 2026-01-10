import { DEG_TO_RAD, fastSin, fastCos, distanceSquared, distance } from '../utils/mathLUT.js';

/**
 * Represents a boundary (wall) in the game.
 * Supports animation for movement and rotation.
 */
class Boundaries {
  /**
   * Creates a new boundary.
   * 
   * @param {Object} setUp - The configuration object.
   * @param {number} setUp.x1 - The x-coordinate of point A.
   * @param {number} setUp.y1 - The y-coordinate of point A.
   * @param {number} setUp.x2 - The x-coordinate of point B.
   * @param {number} setUp.y2 - The y-coordinate of point B.
   * @param {HTMLImageElement} setUp.texture - The texture image of the boundary.
   * @param {Object} [setUp.options] - Additional options.
   * @param {string} [setUp.options.uniqueID] - A unique identifier for the boundary.
   * @param {boolean} [setUp.options.isTransparent] - Whether this boundary has transparent texture (sprites).
   * @param {boolean} [setUp.options.isSprite] - Whether this boundary is a sprite (always faces player).
   * @param {number[]} [setUp.options.rotationStops] - Array of angles for rotation animation (degrees).
   * @param {number} [setUp.options.rotationTime=1] - Duration in seconds for each rotation step.
   * @param {boolean} [setUp.options.repeatRotation=false] - Whether to repeat the rotation animation.
   * @param {Array<{x: number, y: number}>} [setUp.options.moveStops] - Array of relative movement vectors.
   * @param {number} [setUp.options.moveTime=1] - Duration in seconds for each movement step.
   * @param {boolean} [setUp.options.repeatMovement=false] - Whether to repeat the movement pattern.
   */
  constructor({ x1, y1, x2, y2, texture, options = {} }) {
    this.a = { x: x1, y: y1 }; // Point A of the boundary
    this.b = { x: x2, y: y2 }; // Point B of the boundary
    this.originalA = { x: x1, y: y1 }; // Original point A for rotation
    this.originalB = { x: x2, y: y2 }; // Original point B for rotation
    this.angle = 0; // Rotation angle
    this.texture = texture; // Boundary texture (can be null for solid color)
    this.color = options.color || null; // Solid color (used when texture is null)
    this.uniqueID = options.uniqueID || null; // Unique identifier
    this.isTransparent = options.isTransparent || false; // For sprites with transparency
    this.isSprite = options.isSprite || false; // Billboard sprites
    this.isCurved = false; // Flag to identify this is not a curved wall
    
    // Store initial center position for animations
    this._initialCenterX = (x1 + x2) * 0.5;
    this._initialCenterY = (y1 + y2) * 0.5;
    
    // Rotation animation properties
    this.rotationStops = options.rotationStops || [];
    this.rotationTime = options.rotationTime || 1;
    this.repeatRotation = options.repeatRotation || false;
    this.currentRotationIndex = 0;
    this.rotationAccumulatedTime = 0;
    this.lastRotationFrameTime = performance.now() * 0.001;
    this.isRotating = this.rotationStops.length > 0;
    this.currentAngle = 0;
    this.initialAngle = 0;
    this.targetAngle = this._calculateNextTargetAngle();

    // Movement animation properties
    this.moveStops = options.moveStops || [];
    this.moveTime = options.moveTime || 1;
    this.repeatMovement = options.repeatMovement || false;
    this.currentMoveIndex = 0;
    this.moveAccumulatedTime = 0;
    this.lastMoveFrameTime = performance.now() * 0.001;
    this.isMoving = this.moveStops.length > 0;
    this.currentPos = { x: this._initialCenterX, y: this._initialCenterY };
    this.targetPos = this._calculateNextTargetPosition();
    
    // Track if this boundary needs updates
    this.isAnimated = this.isRotating || this.isMoving;
    
    // Cache the wall length for texture mapping
    this._updateCache();
  }
  
  /**
   * Calculates the next target angle based on current rotation index
   * @private
   * @returns {number} The next target angle in degrees
   */
  _calculateNextTargetAngle() {
    if (!this.isRotating || this.rotationStops.length === 0) {
      return this.angle;
    }

    let accumulatedAngle = this.initialAngle;
    for (let i = 0; i <= this.currentRotationIndex; i++) {
      accumulatedAngle += this.rotationStops[i];
    }
    return accumulatedAngle;
  }

  /**
   * Calculates the next target position based on current movement index
   * @private
   * @returns {{x: number, y: number}} The next target position
   */
  _calculateNextTargetPosition() {
    if (!this.isMoving || this.moveStops.length === 0) {
      return { x: this._initialCenterX, y: this._initialCenterY };
    }

    let accumulatedX = this._initialCenterX;
    let accumulatedY = this._initialCenterY;
    
    for (let i = 0; i <= this.currentMoveIndex; i++) {
      accumulatedX += this.moveStops[i].x;
      accumulatedY += this.moveStops[i].y;
    }
    
    return { x: accumulatedX, y: accumulatedY };
  }

  /**
   * Updates the boundary's animation state (movement and rotation)
   * Call this every frame for animated walls
   */
  update() {
    if (!this.isAnimated) return;
    
    if (this.isMoving) {
      this._updateMovement();
    }
    
    if (this.isRotating) {
      this._updateRotation();
    }
  }

  /**
   * Updates the rotation animation using real time
   * @private
   */
  _updateRotation() {
    if (!this.isRotating) return;

    const currentTime = performance.now() * 0.001;
    const frameDeltaTime = currentTime - this.lastRotationFrameTime;
    this.rotationAccumulatedTime += frameDeltaTime;
    this.lastRotationFrameTime = currentTime;

    const progress = Math.min(this.rotationAccumulatedTime / this.rotationTime, 1);

    if (progress >= 1) {
      // Complete current rotation
      this.currentAngle = this.targetAngle;
      this.rotateBoundary(this.currentAngle);
      this.rotationAccumulatedTime = 0;
      this.currentRotationIndex++;

      if (this.currentRotationIndex >= this.rotationStops.length) {
        if (this.repeatRotation) {
          // Reset to start for repeated animation
          this.currentRotationIndex = 0;
          this.currentAngle = this.targetAngle % 360;
          this.targetAngle = this._calculateNextTargetAngle();
        } else {
          // Stop rotation
          this.isRotating = false;
          this._updateAnimatedFlag();
          return;
        }
      } else {
        // Move to next angle in sequence
        this.targetAngle = this._calculateNextTargetAngle();
      }
    } else {
      // Interpolate between current and target angle
      let angleDiff = this.targetAngle - this.currentAngle;
      
      // Ensure shortest rotation direction
      if (angleDiff > 180) angleDiff -= 360;
      else if (angleDiff < -180) angleDiff += 360;
      
      const interpolatedAngle = (this.currentAngle + angleDiff * progress) % 360;
      this.rotateBoundary(interpolatedAngle);
    }
  }

  /**
   * Updates the movement animation using real time
   * @private
   */
  _updateMovement() {
    if (!this.isMoving) return;

    const currentTime = performance.now() * 0.001;
    const frameDeltaTime = currentTime - this.lastMoveFrameTime;
    this.moveAccumulatedTime += frameDeltaTime;
    this.lastMoveFrameTime = currentTime;

    const progress = Math.min(this.moveAccumulatedTime / this.moveTime, 1);

    if (progress >= 1) {
      // Complete current movement
      this.updatePosition(this.targetPos.x, this.targetPos.y);
      this.currentPos.x = this.targetPos.x;
      this.currentPos.y = this.targetPos.y;
      this.moveAccumulatedTime = 0;
      this.currentMoveIndex++;

      if (this.currentMoveIndex >= this.moveStops.length) {
        if (this.repeatMovement) {
          // Reset to start for repeated animation
          this.currentMoveIndex = 0;
          this.currentPos.x = this.targetPos.x;
          this.currentPos.y = this.targetPos.y;
          this.targetPos = this._calculateNextTargetPosition();
        } else {
          // Stop movement
          this.isMoving = false;
          this._updateAnimatedFlag();
          return;
        }
      } else {
        // Move to next position in sequence
        this.targetPos = this._calculateNextTargetPosition();
      }
    } else {
      // Linear interpolation
      const newX = this.currentPos.x + (this.targetPos.x - this.currentPos.x) * progress;
      const newY = this.currentPos.y + (this.targetPos.y - this.currentPos.y) * progress;
      this.updatePosition(newX, newY);
    }
  }

  /**
   * Updates the isAnimated flag based on current animation state
   * @private
   */
  _updateAnimatedFlag() {
    this.isAnimated = this.isRotating || this.isMoving;
  }

  /**
   * Resets the animation to its initial state
   */
  resetAnimation() {
    // Reset position
    this.updatePosition(this._initialCenterX, this._initialCenterY);
    this.currentPos = { x: this._initialCenterX, y: this._initialCenterY };
    
    // Reset rotation
    this.rotateBoundary(0);
    this.currentAngle = 0;
    
    // Reset movement animation state
    this.currentMoveIndex = 0;
    this.moveAccumulatedTime = 0;
    this.lastMoveFrameTime = performance.now() * 0.001;
    this.isMoving = this.moveStops.length > 0;
    this.targetPos = this._calculateNextTargetPosition();
    
    // Reset rotation animation state
    this.currentRotationIndex = 0;
    this.rotationAccumulatedTime = 0;
    this.lastRotationFrameTime = performance.now() * 0.001;
    this.isRotating = this.rotationStops.length > 0;
    this.targetAngle = this._calculateNextTargetAngle();
    
    this._updateAnimatedFlag();
  }
  
  /**
   * Updates all cached values (length, bounding box, center, etc.)
   * @private
   */
  _updateCache() {
    const dx = this.b.x - this.a.x;
    const dy = this.b.y - this.a.y;
    this.length = Math.sqrt(dx * dx + dy * dy);
    
    // Pre-compute bounding box for frustum culling
    this.minX = Math.min(this.a.x, this.b.x);
    this.maxX = Math.max(this.a.x, this.b.x);
    this.minY = Math.min(this.a.y, this.b.y);
    this.maxY = Math.max(this.a.y, this.b.y);
    
    // Pre-compute center point for distance checks
    this.centerX = (this.a.x + this.b.x) * 0.5;
    this.centerY = (this.a.y + this.b.y) * 0.5;
    
    // Pre-compute max distance from center to any point on wall
    // (half the diagonal of bounding box)
    const halfWidth = (this.maxX - this.minX) * 0.5;
    const halfHeight = (this.maxY - this.minY) * 0.5;
    this.boundingRadius = Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight);
    
    // Pre-compute wall direction for intersection tests
    this.dx = dx;
    this.dy = dy;
  }

  /**
   * Updates the position of the boundary by putting center at (x, y).
   * @param {number} x - New center X position
   * @param {number} y - New center Y position
   */ 
  updatePosition(x, y) {
    // Calculate the offset to move the center to (x, y)
    const dx = x - this.centerX;
    const dy = y - this.centerY;

    // Update the positions of points A and B
    this.a.x += dx;
    this.a.y += dy;
    this.b.x += dx;
    this.b.y += dy;

    // Update the original positions
    this.originalA.x += dx;
    this.originalA.y += dy;
    this.originalB.x += dx;
    this.originalB.y += dy;
    
    this._updateCache();
  }

  /**
   * Rotates the boundary around its center by a specified angle.
   * 
   * @param {number} angle - The angle of rotation in degrees.
   */
  rotateBoundary(angle) {
    // Convert angle to radians
    const angleRad = angle * DEG_TO_RAD;
    
    // Use fast trig lookups
    const cosA = fastCos(angleRad);
    const sinA = fastSin(angleRad);

    // Calculate the center point
    const centerX = (this.originalA.x + this.originalB.x) * 0.5;
    const centerY = (this.originalA.y + this.originalB.y) * 0.5;

    // Rotate point A
    const dxA = this.originalA.x - centerX;
    const dyA = this.originalA.y - centerY;
    this.a.x = centerX + dxA * cosA - dyA * sinA;
    this.a.y = centerY + dxA * sinA + dyA * cosA;

    // Rotate point B
    const dxB = this.originalB.x - centerX;
    const dyB = this.originalB.y - centerY;
    this.b.x = centerX + dxB * cosA - dyB * sinA;
    this.b.y = centerY + dxB * sinA + dyB * cosA;

    // Store the current rotation angle
    this.angle = angle;
    
    this._updateCache();
  }
  
  /**
   * Fast check if a point is potentially near this boundary
   * Uses squared distance to avoid sqrt
   * @param {number} x - Point X
   * @param {number} y - Point Y
   * @param {number} maxDistSq - Maximum squared distance
   * @returns {boolean} True if point is within range
   */
  isNearPoint(x, y, maxDistSq) {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    const distSq = dx * dx + dy * dy;
    const totalRadius = this.boundingRadius + Math.sqrt(maxDistSq);
    return distSq < totalRadius * totalRadius;
  }
}

export default Boundaries;
