import Boundaries from './BoundariesClass.js';
import CameraClass from './CameraClass.js';
import RayClass from './RayClass.js';
import { DEG_TO_RAD, RAD_TO_DEG } from '../utils/mathLUT.js';

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
   * @param {HTMLImageElement} [options.texture=null] - The texture image for the enemy
   * @param {Object} [options.spriteSheet=null] - Sprite sheet configuration for 8-directional sprites (legacy)
   * @param {number} [options.spriteSheet.columns=8] - Number of columns in sprite sheet
   * @param {number} [options.spriteSheet.rows=6] - Number of rows in sprite sheet
   * @param {number} [options.spriteSheet.uniqueFrames=5] - Number of unique direction frames
   * @param {HTMLImageElement[]} [options.directionalSprites=null] - Array of 5 individual sprite images for 8-directional rendering
   * @param {number} [options.id] - The unique identifier for the enemy
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
    repeatMovement = false,
    texture = null,
    spriteSheet = null,
    directionalSprites = null,
    id
  }) {
    this.pos = { x, y };
    this.initialPos = { x, y };
    this.viewDirection = viewDirection;
    this.initialViewDirection = viewDirection;
    this.fov = fov;
    this.visibilityDistance = visibilityDistance;
    this._visibilityDistanceSq = visibilityDistance * visibilityDistance; // Pre-compute squared

    // Rotation animation properties
    this.rotationStops = rotationStops;
    this.rotationTime = rotationTime;
    this.repeatRotation = repeatRotation;
    this.currentRotationIndex = 0;
    this.rotationAccumulatedTime = 0;
    this.lastRotationFrameTime = performance.now() * 0.001; // Convert to seconds once
    this.isRotating = rotationStops.length > 0;
    this.currentAngle = viewDirection;
    this.targetAngle = this.calculateNextTargetAngle();

    // Movement animation properties
    this.moveStops = moveStops;
    this.moveTime = moveTime;
    this.repeatMovement = repeatMovement;
    this.currentMoveIndex = 0;
    this.moveAccumulatedTime = 0;
    this.lastMoveFrameTime = performance.now() * 0.001;
    this.isMoving = moveStops.length > 0;
    this.currentPos = { ...this.pos };
    this.targetPos = this.calculateNextTargetPosition();

    this.wasDetected = false;

    // Vision system - use fewer rays for enemies to save performance
    this.camera = new CameraClass({
      x,
      y,
      fov,
      rayCount,
      viewDirection
    });

    this.skin = new Boundaries({
      x1: x, 
      y1: y - 20,
      x2: x,
      y2: y + 20,
      texture,
      options: { 
        uniqueID: id,
        isTransparent: true,
        isSprite: true,
        spriteSheet: spriteSheet,
        directionalSprites: directionalSprites
      }
    });
    this.id = id;
    
    // Store sprite config for reference
    this.spriteSheet = spriteSheet;
    this.directionalSprites = directionalSprites;
    
    // Pre-compute half FOV in degrees for detection
    this._halfFov = fov * 0.5;
  }

  /**
   * Calculates the next target angle based on current rotation index
   * @private
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
    const currentTime = performance.now() * 0.001;
    
    if (!this.wasDetected) {
      this.updateMovement(currentTime);
      this.updateRotation(currentTime);
    } else {
      // Keep frame times updated so animation resumes smoothly when detection ends
      this.lastMoveFrameTime = currentTime;
      this.lastRotationFrameTime = currentTime;
    }
    
    this.camera.update(this.pos, this.viewDirection);
  }

  /**
   * Updates the rotation animation using real time
   * @param {number} currentTime - Current time in seconds
   * @private
   */
  updateRotation(currentTime) {
    if (!this.isRotating) return;

    const frameDeltaTime = currentTime - this.lastRotationFrameTime;
    this.rotationAccumulatedTime += frameDeltaTime;
    this.lastRotationFrameTime = currentTime;

    const progress = Math.min(this.rotationAccumulatedTime / this.rotationTime, 1);

    if (progress >= 1) {
      this.currentAngle = this.targetAngle;
      this.viewDirection = this.currentAngle;
      this.rotationAccumulatedTime = 0;
      this.currentRotationIndex++;

      if (this.currentRotationIndex >= this.rotationStops.length) {
        if (this.repeatRotation) {
          this.currentRotationIndex = 0;
          this.currentAngle = this.targetAngle % 360;
          this.targetAngle = this.calculateNextTargetAngle();
        } else {
          this.isRotating = false;
          return;
        }
      } else {
        this.targetAngle = this.calculateNextTargetAngle();
      }
    } else {
      let angleDiff = this.targetAngle - this.currentAngle;
      
      // Ensure shortest rotation direction
      if (angleDiff > 180) angleDiff -= 360;
      else if (angleDiff < -180) angleDiff += 360;
      
      this.viewDirection = (this.currentAngle + (angleDiff * progress)) % 360;
    }
  }

  /**
   * Updates the movement animation using real time
   * @param {number} currentTime - Current time in seconds
   * @private
   */
  updateMovement(currentTime) {
    if (!this.isMoving) return;

    const frameDeltaTime = currentTime - this.lastMoveFrameTime;
    this.moveAccumulatedTime += frameDeltaTime;
    this.lastMoveFrameTime = currentTime;

    const progress = Math.min(this.moveAccumulatedTime / this.moveTime, 1);

    if (progress >= 1) {
      this.pos.x = this.targetPos.x;
      this.pos.y = this.targetPos.y;
      this.currentPos.x = this.targetPos.x;
      this.currentPos.y = this.targetPos.y;
      this.moveAccumulatedTime = 0;
      this.currentMoveIndex++;

      if (this.currentMoveIndex >= this.moveStops.length) {
        if (this.repeatMovement) {
          this.currentMoveIndex = 0;
          this.currentPos.x = this.targetPos.x;
          this.currentPos.y = this.targetPos.y;
          this.targetPos = this.calculateNextTargetPosition();
        } else {
          this.isMoving = false;
          return;
        }
      } else {
        this.targetPos = this.calculateNextTargetPosition();
      }
    } else {
      // Linear interpolation
      this.pos.x = this.currentPos.x + (this.targetPos.x - this.currentPos.x) * progress;
      this.pos.y = this.currentPos.y + (this.targetPos.y - this.currentPos.y) * progress;
    }
  }

  /**
   * Calculates the effective visibility distance based on angle from center of view.
   * Creates a cone-shaped detection area:
   * - Center 20%: Full distance
   * - Next 20% on each side: Reduces from 100% to 40%
   * - Outer 20% on each side: Remains at 40%
   * @param {number} angleFromCenter - Angle in degrees from the center of view (0 to halfFov)
   * @param {number} halfFov - Half of the field of view in degrees
   * @param {number} maxDistance - Maximum visibility distance (at center)
   * @returns {number} The effective visibility distance at this angle
   */
  getEffectiveVisibilityDistance(angleFromCenter, halfFov, maxDistance) {
    if (halfFov === 0) return maxDistance;
    
    // Normalize angle to 0-1 range (0 = center, 1 = edge)
    const normalizedAngle = Math.min(Math.abs(angleFromCenter) / halfFov, 1);
    
    // Cone-shaped falloff zones:
    // 0.0 - 0.2: Full distance (center 20%)
    // 0.2 - 0.4: Transition from 100% to 40% (20% on each side)
    // 0.4 - 1.0: Remain at 40% (outer 20% on each side)
    const fullDistanceThreshold = 0.2;
    const transitionEnd = 0.4;
    const minMultiplier = 0.4;
    
    if (normalizedAngle <= fullDistanceThreshold) {
      // Center zone - full distance
      return maxDistance;
    } else if (normalizedAngle <= transitionEnd) {
      // Transition zone - smooth reduction from 100% to 40%
      const transitionProgress = (normalizedAngle - fullDistanceThreshold) / (transitionEnd - fullDistanceThreshold);
      // Use quadratic falloff for smooth but noticeable reduction
      const falloff = 1 - (transitionProgress * transitionProgress);
      const multiplier = minMultiplier + (1 - minMultiplier) * falloff;
      return maxDistance * multiplier;
    } else {
      // Outer zone - remain at minimum (40%)
      return maxDistance * minMultiplier;
    }
  }

  /**
   * Detects if the player is visible to the enemy.
   * Optimized with squared distance checks and early exits.
   * Crouching reduces detection range to 75% and disables proximity detection.
   * Jumping recently increases detection range by 1.2x.
   * Sprinting decreases detection range to 80% but increases FOV by 1.3x.
   * Visibility distance tapers off towards the edges of the FOV.
   * Also includes 360° proximity detection at 15% of main distance for close encounters.
   * @param {Player} player - The player object to check for detection.
   * @param {Array<Boundaries>} boundaries - Array of boundary objects for the scene.
   * @returns {{isDetected: boolean, distance: number|null, userPosition: Object|null, relativeAngle: number|null}}
   */
  detectPlayer(player, boundaries) {
    const dx = player.pos.x - this.pos.x;
    const dy = player.pos.y - this.pos.y;

    // Crouching/sneaking reduces front detection to 75% and disables proximity detection
    const crouchMultiplier = player.isCrouching ? 0.75 : 1.0;
    // Jumping recently increases detection range by 1.2x (player is more visible)
    const jumpMultiplier = (player.hasRecentlyJumped && player.hasRecentlyJumped()) ? 1.2 : 1.0;
    // Sprinting increases both detection range and FOV (player is more visible and makes more noise)
    const sprintRangeMultiplier = player.isSprinting ? 1.2 : 1.0;
    const sprintFovMultiplier = player.isSprinting ? 1.3 : 1.0;
    
    const effectiveMaxVisibilityDist = this.visibilityDistance * crouchMultiplier * jumpMultiplier * sprintRangeMultiplier;
    const effectiveHalfFov = this._halfFov * sprintFovMultiplier; // FOV increases when player is sprinting
    
    // Proximity detection distance (15% of main visibility distance, covers full 360°)
    // Disabled when crouching (0 distance means no proximity detection)
    // Affected by jump and sprint multipliers
    const proximityDistance = player.isCrouching ? 0 : this.visibilityDistance * 0.15 * jumpMultiplier * sprintRangeMultiplier;

    // Quick squared distance check against maximum possible distance (avoids sqrt for far objects)
    const distSq = dx * dx + dy * dy;
    const maxDistSq = effectiveMaxVisibilityDist * effectiveMaxVisibilityDist;
    if (distSq > maxDistSq) {
      this.wasDetected = false;
      return { isDetected: false, distance: null, userPosition: null, relativeAngle: null };
    }

    const distance = Math.sqrt(distSq);

    // Calculate angle to player
    const angleToPlayer = Math.atan2(dy, dx) * RAD_TO_DEG;
    const normalizedAngle = ((angleToPlayer % 360) + 360) % 360;

    // Normalize relative angle to get angle from center of view
    let relativeAngle = ((normalizedAngle - this.viewDirection + 360) % 360);
    
    // Convert to angle from center (-halfFov to +halfFov range)
    let angleFromCenter = relativeAngle;
    if (angleFromCenter > 180) {
      angleFromCenter = angleFromCenter - 360; // Convert 270-360 to -90-0
    }

    // Check if within primary FOV
    if (Math.abs(angleFromCenter) <= effectiveHalfFov) {
      // Calculate tapered visibility distance based on angle from center
      const effectiveVisibilityDist = this.getEffectiveVisibilityDistance(
        angleFromCenter, 
        effectiveHalfFov, 
        effectiveMaxVisibilityDist
      );
      
      // Check if player is within the tapered distance
      if (distance > effectiveVisibilityDist) {
        this.wasDetected = false;
        return { isDetected: false, distance: null, userPosition: null, relativeAngle: null };
      }
      
      // Cast ray to check for obstructions
      const ray = new RayClass(this.pos.x, this.pos.y, angleToPlayer * DEG_TO_RAD);
      
      // Check only opaque boundaries for obstruction
      for (let i = 0; i < boundaries.length; i++) {
        const boundary = boundaries[i];
        
        // Skip transparent boundaries (sprites)
        if (boundary.isTransparent) continue;
        
        const result = ray.cast(boundary);
        if (result) {
          const bdx = result.point.x - this.pos.x;
          const bdy = result.point.y - this.pos.y;
          const boundaryDist = Math.sqrt(bdx * bdx + bdy * bdy);

          // If boundary is closer than player, visibility is blocked
          if (boundaryDist < distance) {
            this.wasDetected = false;
            return { isDetected: false, distance: null, userPosition: null, relativeAngle: null };
          }
        }
      }

      // No obstruction - player is visible in primary FOV
      this.wasDetected = true;
      return {
        isDetected: true,
        distance,
        userPosition: player.pos,
        relativeAngle
      };
    }
    
    // Not in primary FOV - check proximity detection (360° awareness)
    if (distance <= proximityDistance) {
      // Cast ray to check for obstructions
      const ray = new RayClass(this.pos.x, this.pos.y, angleToPlayer * DEG_TO_RAD);
      
      // Check only opaque boundaries for obstruction
      for (let i = 0; i < boundaries.length; i++) {
        const boundary = boundaries[i];
        
        // Skip transparent boundaries (sprites)
        if (boundary.isTransparent) continue;
        
        const result = ray.cast(boundary);
        if (result) {
          const bdx = result.point.x - this.pos.x;
          const bdy = result.point.y - this.pos.y;
          const boundaryDist = Math.sqrt(bdx * bdx + bdy * bdy);

          // If boundary is closer than player, visibility is blocked
          if (boundaryDist < distance) {
            this.wasDetected = false;
            return { isDetected: false, distance: null, userPosition: null, relativeAngle: null };
          }
        }
      }

      // No obstruction - player detected via proximity (360° awareness)
      this.wasDetected = true;
      return {
        isDetected: true,
        distance,
        userPosition: player.pos,
        relativeAngle
      };
    }

    this.wasDetected = false;
    return { isDetected: false, distance: null, userPosition: null, relativeAngle: null };
  }
}

export default EnemyClass;
