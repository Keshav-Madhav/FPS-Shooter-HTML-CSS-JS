import { TWO_PI, normalizeAngle, fastSin, fastCos, distanceSquared } from '../utils/mathLUT.js';

/**
 * Represents a curved wall boundary (arc) in the game.
 * Supports animation for movement and rotation.
 */
class CurvedWall {
  /**
   * Creates a new curved wall.
   * 
   * @param {Object} config - The configuration object.
   * @param {number} config.centerX - The x-coordinate of the circle's center.
   * @param {number} config.centerY - The y-coordinate of the circle's center.
   * @param {number} config.radius - The radius of the circular arc.
   * @param {number} config.startAngle - The starting angle in radians.
   * @param {number} config.endAngle - The ending angle in radians.
   * @param {HTMLImageElement} config.texture - The texture image of the boundary.
   * @param {Object} [config.options] - Additional options.
   * @param {string} [config.options.uniqueID] - A unique identifier for the curved wall.
   * @param {boolean} [config.options.isTransparent] - Whether this boundary has transparent texture.
   * @param {number[]} [config.options.rotationStops] - Array of angles for rotation animation (radians).
   * @param {number} [config.options.rotationTime=1] - Duration in seconds for each rotation step.
   * @param {boolean} [config.options.repeatRotation=false] - Whether to repeat the rotation animation.
   * @param {Array<{x: number, y: number}>} [config.options.moveStops] - Array of relative movement vectors.
   * @param {number} [config.options.moveTime=1] - Duration in seconds for each movement step.
   * @param {boolean} [config.options.repeatMovement=false] - Whether to repeat the movement pattern.
   */
  constructor({ centerX, centerY, radius, startAngle, endAngle, texture, options = {} }) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius = radius;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
    this.texture = texture;
    this.uniqueID = options.uniqueID || null;
    this.isTransparent = options.isTransparent || false;
    this.isCurved = true; // Flag to identify curved walls
    
    // Store initial values for animations
    this._initialCenterX = centerX;
    this._initialCenterY = centerY;
    this._initialStartAngle = startAngle;
    this._initialEndAngle = endAngle;
    
    // Rotation animation properties (rotates the arc around its center)
    this.rotationStops = options.rotationStops || [];
    this.rotationTime = options.rotationTime || 1;
    this.repeatRotation = options.repeatRotation || false;
    this.currentRotationIndex = 0;
    this.rotationAccumulatedTime = 0;
    this.lastRotationFrameTime = performance.now() * 0.001;
    this.isRotating = this.rotationStops.length > 0;
    this.currentRotationAngle = 0;
    this.initialRotationAngle = 0;
    this.targetRotationAngle = this._calculateNextTargetAngle();

    // Movement animation properties
    this.moveStops = options.moveStops || [];
    this.moveTime = options.moveTime || 1;
    this.repeatMovement = options.repeatMovement || false;
    this.currentMoveIndex = 0;
    this.moveAccumulatedTime = 0;
    this.lastMoveFrameTime = performance.now() * 0.001;
    this.isMoving = this.moveStops.length > 0;
    this.currentPos = { x: centerX, y: centerY };
    this.targetPos = this._calculateNextTargetPosition();
    
    // Track if this boundary needs updates
    this.isAnimated = this.isRotating || this.isMoving;
    
    // Pre-calculate and cache values
    this._updateCache();
  }

  /**
   * Calculates the next target rotation angle based on current rotation index
   * @private
   * @returns {number} The next target angle in radians
   */
  _calculateNextTargetAngle() {
    if (!this.isRotating || this.rotationStops.length === 0) {
      return this.currentRotationAngle;
    }

    let accumulatedAngle = this.initialRotationAngle;
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
   * Updates the curved wall's animation state (movement and rotation)
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
   * Rotates the arc around its center by adjusting start/end angles
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
      this.currentRotationAngle = this.targetRotationAngle;
      this._applyRotation(this.currentRotationAngle);
      this.rotationAccumulatedTime = 0;
      this.currentRotationIndex++;

      if (this.currentRotationIndex >= this.rotationStops.length) {
        if (this.repeatRotation) {
          // Reset to start for repeated animation
          this.currentRotationIndex = 0;
          this.currentRotationAngle = normalizeAngle(this.targetRotationAngle);
          this.targetRotationAngle = this._calculateNextTargetAngle();
        } else {
          // Stop rotation
          this.isRotating = false;
          this._updateAnimatedFlag();
          return;
        }
      } else {
        // Move to next angle in sequence
        this.targetRotationAngle = this._calculateNextTargetAngle();
      }
    } else {
      // Interpolate between current and target angle
      let angleDiff = this.targetRotationAngle - this.currentRotationAngle;
      
      // Ensure shortest rotation direction
      if (angleDiff > Math.PI) angleDiff -= TWO_PI;
      else if (angleDiff < -Math.PI) angleDiff += TWO_PI;
      
      const interpolatedAngle = this.currentRotationAngle + angleDiff * progress;
      this._applyRotation(interpolatedAngle);
    }
  }

  /**
   * Applies a rotation offset to the arc angles
   * @private
   * @param {number} rotationOffset - The rotation offset in radians
   */
  _applyRotation(rotationOffset) {
    this.startAngle = this._initialStartAngle + rotationOffset;
    this.endAngle = this._initialEndAngle + rotationOffset;
    this._updateCache();
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
      this.centerX = this.targetPos.x;
      this.centerY = this.targetPos.y;
      this.currentPos.x = this.targetPos.x;
      this.currentPos.y = this.targetPos.y;
      this._updateCache();
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
      this.centerX = this.currentPos.x + (this.targetPos.x - this.currentPos.x) * progress;
      this.centerY = this.currentPos.y + (this.targetPos.y - this.currentPos.y) * progress;
      this._updateCache();
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
    this.centerX = this._initialCenterX;
    this.centerY = this._initialCenterY;
    this.currentPos = { x: this._initialCenterX, y: this._initialCenterY };
    
    // Reset rotation
    this.startAngle = this._initialStartAngle;
    this.endAngle = this._initialEndAngle;
    this.currentRotationAngle = 0;
    
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
    this.targetRotationAngle = this._calculateNextTargetAngle();
    
    this._updateAnimatedFlag();
    this._updateCache();
  }

  /**
   * Updates all cached values
   * @private
   */
  _updateCache() {
    // Normalize angles once
    this._normalizedStart = normalizeAngle(this.startAngle);
    this._normalizedEnd = normalizeAngle(this.endAngle);
    
    // Calculate arc range (how much of the circle this arc covers)
    let arcRange = this._normalizedEnd - this._normalizedStart;
    if (arcRange < 0) arcRange += TWO_PI; // Arc wraps around 0
    this._arcRange = arcRange;
    
    // Pre-calculate arc length for texture mapping
    this.arcLength = this.radius * arcRange;
    
    // Pre-calculate squared radius for intersection tests
    this._radiusSq = this.radius * this.radius;
    
    // Calculate bounding box for frustum culling
    this._calculateBoundingBox();
  }
  
  /**
   * Calculates an axis-aligned bounding box for the arc
   * @private
   */
  _calculateBoundingBox() {
    // Start with the endpoints
    const startX = this.centerX + this.radius * fastCos(this.startAngle);
    const startY = this.centerY + this.radius * fastSin(this.startAngle);
    const endX = this.centerX + this.radius * fastCos(this.endAngle);
    const endY = this.centerY + this.radius * fastSin(this.endAngle);
    
    let minX = Math.min(startX, endX);
    let maxX = Math.max(startX, endX);
    let minY = Math.min(startY, endY);
    let maxY = Math.max(startY, endY);
    
    // Check if arc crosses cardinal directions (0, π/2, π, 3π/2)
    const cardinals = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
    for (const cardinal of cardinals) {
      if (this._isAngleInArcFast(cardinal)) {
        const x = this.centerX + this.radius * fastCos(cardinal);
        const y = this.centerY + this.radius * fastSin(cardinal);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    
    this.minX = minX;
    this.maxX = maxX;
    this.minY = minY;
    this.maxY = maxY;
    
    // Bounding sphere (for quick distance checks)
    this.boundingRadius = this.radius;
  }

  /**
   * Finds the intersection point of a ray with this curved wall.
   * Uses quadratic formula to solve ray-circle intersection.
   * Optimized with early exits and cached values.
   * 
   * @param {RayClass} ray - The ray to test
   * @returns {{point: {x: number, y: number}, distance: number, angle: number}|undefined}
   */
  rayIntersection(ray) {
    const rayX = ray.pos.x;
    const rayY = ray.pos.y;
    const dirX = ray.dir.x;
    const dirY = ray.dir.y;
    
    // Translate ray origin relative to circle center
    const fx = rayX - this.centerX;
    const fy = rayY - this.centerY;
    
    // For unit direction vectors (which rays should have), a = 1
    // But we calculate anyway for robustness
    const a = dirX * dirX + dirY * dirY;
    const b = 2 * (fx * dirX + fy * dirY);
    const c = (fx * fx + fy * fy) - this._radiusSq;
    
    // Calculate discriminant
    const discriminant = b * b - 4 * a * c;
    
    // No intersection with circle at all
    if (discriminant < 0) return undefined;
    
    // Find intersection parameters
    const sqrtDisc = Math.sqrt(discriminant);
    const inv2a = 0.5 / a;
    const t1 = (-b - sqrtDisc) * inv2a;
    const t2 = (-b + sqrtDisc) * inv2a;
    
    // Check t1 first (closer intersection)
    if (t1 > 0.001) {
      const intX = rayX + dirX * t1;
      const intY = rayY + dirY * t1;
      const angle = Math.atan2(intY - this.centerY, intX - this.centerX);
      
      if (this._isAngleInArcFast(angle)) {
        return {
          point: { x: intX, y: intY },
          distance: t1,
          angle: angle
        };
      }
    }
    
    // Check t2 (further intersection) only if t1 wasn't valid
    if (t2 > 0.001 && Math.abs(t2 - t1) > 0.001) {
      const intX = rayX + dirX * t2;
      const intY = rayY + dirY * t2;
      const angle = Math.atan2(intY - this.centerY, intX - this.centerX);
      
      if (this._isAngleInArcFast(angle)) {
        return {
          point: { x: intX, y: intY },
          distance: t2,
          angle: angle
        };
      }
    }
    
    return undefined;
  }

  /**
   * Fast check if an angle is within the arc's angular range
   * Uses pre-computed normalized values
   * @private
   */
  _isAngleInArcFast(angle) {
    // Normalize the test angle
    let normalizedAngle = normalizeAngle(angle);
    
    // Calculate how far the test angle is from start
    let angleDist = normalizedAngle - this._normalizedStart;
    if (angleDist < 0) angleDist += TWO_PI;
    
    // Check if angle is within the arc (with small tolerance)
    return angleDist <= this._arcRange + 0.001;
  }

  /**
   * Checks if an angle is within the arc's angular range (legacy method)
   * @private
   */
  _isAngleInArc(angle) {
    return this._isAngleInArcFast(angle);
  }

  /**
   * Calculates texture X coordinate based on intersection angle
   * Optimized with pre-computed values
   * @param {number} angle - The angle at intersection point
   * @returns {number} Normalized texture coordinate (0 to 1)
   */
  getTextureX(angle) {
    // Normalize the angle
    let normalizedAngle = normalizeAngle(angle);
    
    // Calculate how far along the arc we are from start
    let angleDist = normalizedAngle - this._normalizedStart;
    if (angleDist < 0) angleDist += TWO_PI;
    
    // Handle wraparound
    if (this._arcRange < Math.PI && angleDist > Math.PI) {
      angleDist -= TWO_PI;
    }
    
    // Clamp to [0, 1]
    const result = angleDist / this._arcRange;
    return result < 0 ? 0 : (result > 1 ? 1 : result);
  }
  
  /**
   * Fast check if a point is potentially near this curved wall
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
    const maxDist = Math.sqrt(maxDistSq);
    const minDist = this.radius - maxDist;
    const maxDistFromCenter = this.radius + maxDist;
    return distSq <= maxDistFromCenter * maxDistFromCenter;
  }
}

export default CurvedWall;
