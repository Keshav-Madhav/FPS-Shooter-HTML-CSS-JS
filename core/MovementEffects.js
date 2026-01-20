import { PlayerConfig } from '../config/GameConfig.js';

/**
 * MovementEffects - Handles FOV changes and visual effects based on movement
 */
class MovementEffects {
  /**
   * Creates movement effects handler
   * @param {Object} [config={}] - Configuration
   */
  constructor(config = {}) {
    this.baseFov = config.baseFov || PlayerConfig.baseFov;
    this.slowFov = config.slowFov || PlayerConfig.slowFov;
    this.fastFov = config.fastFov || PlayerConfig.fastFov;
    this.fovLerpSpeed = config.fovLerpSpeed || PlayerConfig.fovLerpSpeed;
    
    this.currentFov = this.baseFov;
    this.targetFov = this.baseFov;
    
    // Speed modifiers
    this.crouchSpeedMult = PlayerConfig.crouchSpeedMultiplier;
    this.sprintSpeedMult = PlayerConfig.sprintSpeedMultiplier;
    this.jumpSpeedMult = PlayerConfig.jumpSpeedMultiplier;
  }

  /**
   * Updates FOV based on movement state
   * @param {number} deltaTime - Time since last frame
   * @param {Object} moveState - Movement state object
   * @param {boolean} moveState.isMoving - Whether player is moving
   * @param {boolean} moveState.isSprinting - Whether player is sprinting
   * @param {boolean} moveState.isCrouching - Whether player is crouching
   */
  updateFov(deltaTime, { isMoving, isSprinting, isCrouching }) {
    // Determine target FOV
    if (isMoving && isSprinting) {
      this.targetFov = this.fastFov;
    } else if (isMoving && isCrouching) {
      this.targetFov = this.slowFov;
    } else {
      this.targetFov = this.baseFov;
    }

    // Lerp to target
    const fovDiff = this.targetFov - this.currentFov;
    if (Math.abs(fovDiff) > 0.1) {
      this.currentFov += fovDiff * this.fovLerpSpeed * deltaTime;
    } else {
      this.currentFov = this.targetFov;
    }
  }

  /**
   * Gets the current FOV
   * @returns {number} Current FOV value
   */
  getCurrentFov() {
    return this.currentFov;
  }

  /**
   * Calculates the movement speed multiplier
   * @param {Object} state - Player state
   * @param {boolean} state.isCrouching - Whether crouching
   * @param {boolean} state.isSprinting - Whether sprinting
   * @param {boolean} state.isJumping - Whether jumping
   * @returns {number} Speed multiplier
   */
  getSpeedMultiplier({ isCrouching, isSprinting, isJumping }) {
    if (isCrouching) {
      return this.crouchSpeedMult;
    } else if (isSprinting) {
      return this.sprintSpeedMult;
    } else if (isJumping) {
      return this.jumpSpeedMult;
    }
    return 1.0;
  }

  /**
   * Resets to base FOV
   */
  reset() {
    this.currentFov = this.baseFov;
    this.targetFov = this.baseFov;
  }
}

export default MovementEffects;
