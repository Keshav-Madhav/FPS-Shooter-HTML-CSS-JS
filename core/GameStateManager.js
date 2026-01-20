import { DetectionConfig } from '../config/GameConfig.js';

/**
 * GameStateManager - Manages game state, detection timer, and game flow
 */
class GameStateManager {
  /**
   * Creates a game state manager
   * @param {Object} [config={}] - Configuration options
   */
  constructor(config = {}) {
    // Detection timer state
    this.detectionTimerMax = config.detectionTimerMax || DetectionConfig.timerMax;
    this.detectionTimer = this.detectionTimerMax;
    this.detectionDrainRate = config.drainRate || DetectionConfig.drainRate;
    this.detectionRegenRate = config.regenRate || DetectionConfig.regenRate;
    this.detectionRegenDelay = config.regenDelay || DetectionConfig.regenDelay;
    
    // Detection state
    this.isPlayerDetected = false;
    this.timeSinceLastDetection = 0;
    
    // Game state
    this.isGameOver = false;
    this.isPaused = false;
    this.showInstructions = false;
    
    // Path reveal state
    this.showPath = false;
    this.pathUsedOnce = false;
    this.pathRevealTime = 0;
    this.pathRegenerated = false;
    this.pathDisplayDuration = DetectionConfig.pathDisplayDuration;
    this.criticalAlertThreshold = DetectionConfig.criticalAlertThreshold;
    
    // Current path data
    this.currentPath = null;
    
    // Callbacks
    this.onGameOver = null;
    this.onPathReveal = null;
    this.onCriticalAlert = null;
  }

  /**
   * Updates the game state
   * @param {number} deltaSeconds - Real time delta in seconds
   * @param {boolean} isDetected - Whether player is currently detected
   * @param {boolean} isCrouching - Whether player is crouching
   * @param {boolean} isMazeMap - Whether current map is a maze map
   */
  update(deltaSeconds, isDetected, isCrouching, isMazeMap) {
    if (!isMazeMap || this.isGameOver) return;

    this.isPlayerDetected = isDetected;

    if (isDetected) {
      // Drain timer when detected
      this.detectionTimer -= this.detectionDrainRate * deltaSeconds;
      this.timeSinceLastDetection = 0;
      
      if (this.detectionTimer <= 0) {
        this.detectionTimer = 0;
        this.triggerGameOver();
      }
      
      // Check for critical alert level
      if (this.detectionTimer <= this.criticalAlertThreshold && !this.pathRegenerated) {
        this.triggerCriticalAlert();
      }
    } else {
      // Track time since last detection
      this.timeSinceLastDetection += deltaSeconds;
      
      // Regenerate after delay and not crouching
      if (this.timeSinceLastDetection >= this.detectionRegenDelay && !isCrouching) {
        this.detectionTimer += this.detectionRegenRate * deltaSeconds;
        if (this.detectionTimer > this.detectionTimerMax) {
          this.detectionTimer = this.detectionTimerMax;
        }
      }
    }

    // Update path expiry
    if (this.showPath) {
      if (performance.now() - this.pathRevealTime >= this.pathDisplayDuration) {
        this.showPath = false;
        this.currentPath = null;
      }
    }
  }

  /**
   * Triggers game over state
   * @private
   */
  triggerGameOver() {
    this.isGameOver = true;
    if (this.onGameOver) {
      this.onGameOver();
    }
  }

  /**
   * Triggers critical alert (auto path reveal)
   * @private
   */
  triggerCriticalAlert() {
    this.pathRegenerated = true;
    this.showPath = true;
    this.pathRevealTime = performance.now();
    
    if (this.onCriticalAlert) {
      this.onCriticalAlert();
    }
  }

  /**
   * Attempts to reveal the path (player action)
   * @returns {boolean} True if path was revealed
   */
  tryRevealPath() {
    if (!this.pathUsedOnce) {
      this.showPath = true;
      this.pathUsedOnce = true;
      this.pathRevealTime = performance.now();
      
      if (this.onPathReveal) {
        this.onPathReveal();
      }
      return true;
    }
    return false;
  }

  /**
   * Sets the current path
   * @param {Array} path - Path points array
   */
  setPath(path) {
    this.currentPath = path;
  }

  /**
   * Gets remaining path display time in seconds
   * @returns {number} Time remaining
   */
  getPathTimeRemaining() {
    if (!this.showPath) return 0;
    const elapsed = performance.now() - this.pathRevealTime;
    return Math.max(0, (this.pathDisplayDuration - elapsed) / 1000);
  }

  /**
   * Gets detection timer percentage
   * @returns {number} Value between 0 and 1
   */
  getDetectionTimerPercent() {
    return this.detectionTimer / this.detectionTimerMax;
  }

  /**
   * Resets the game state for a new game/map
   * @param {boolean} showInstructions - Whether to show instructions
   */
  reset(showInstructions = false) {
    this.detectionTimer = this.detectionTimerMax;
    this.isPlayerDetected = false;
    this.timeSinceLastDetection = 0;
    this.isGameOver = false;
    this.showPath = false;
    this.currentPath = null;
    this.pathUsedOnce = false;
    this.pathRevealTime = 0;
    this.pathRegenerated = false;
    this.showInstructions = showInstructions;
  }

  /**
   * Dismisses instructions
   */
  dismissInstructions() {
    this.showInstructions = false;
  }

  /**
   * Checks if game should be paused (instructions/game over)
   * @returns {boolean} True if game logic should pause
   */
  shouldPauseGameLogic() {
    return this.showInstructions || this.isGameOver || this.isPaused;
  }

  /**
   * Pauses the game
   */
  pause() {
    this.isPaused = true;
  }

  /**
   * Unpauses the game
   */
  unpause() {
    this.isPaused = false;
  }

  /**
   * Serializes state for saving
   * @returns {Object} Serialized state
   */
  serialize() {
    return {
      detectionTimer: this.detectionTimer,
      isGameOver: this.isGameOver,
      pathUsedOnce: this.pathUsedOnce,
      pathRegenerated: this.pathRegenerated
    };
  }

  /**
   * Deserializes saved state
   * @param {Object} data - Saved state data
   */
  deserialize(data) {
    if (data) {
      this.detectionTimer = data.detectionTimer ?? this.detectionTimerMax;
      this.isGameOver = data.isGameOver ?? false;
      this.pathUsedOnce = data.pathUsedOnce ?? false;
      this.pathRegenerated = data.pathRegenerated ?? false;
    }
  }
}

export default GameStateManager;
