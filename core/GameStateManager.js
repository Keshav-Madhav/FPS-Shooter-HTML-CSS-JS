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
    this.isWin = false;
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
    
    // Scoring state
    this.gameStartTime = 0;
    this.gameEndTime = 0;
    this.detectionCount = 0;
    this.wasDetectedThisFrame = false;
    this.finalScore = 0;
    this.scoreBreakdown = null;
    
    // Callbacks
    this.onGameOver = null;
    this.onWin = null;
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
    if (!isMazeMap || this.isGameOver || this.isWin) return;

    // Track detection count (increment when detection starts, not every frame)
    if (isDetected && !this.wasDetectedThisFrame) {
      this.detectionCount++;
    }
    this.wasDetectedThisFrame = isDetected;
    
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
    this.gameEndTime = performance.now();
    this.calculateScore(false);
    if (this.onGameOver) {
      this.onGameOver();
    }
  }

  /**
   * Triggers win state when player reaches goal
   */
  triggerWin() {
    if (this.isWin || this.isGameOver) return;
    
    this.isWin = true;
    this.gameEndTime = performance.now();
    this.calculateScore(true);
    if (this.onWin) {
      this.onWin();
    }
  }

  /**
   * Calculates the final score based on multiple factors
   * 
   * Score Formula:
   * RAW_SCORE = COMPLETION_BONUS + PATH_BONUS + ALERT_BONUS - DETECTION_PENALTY
   * FINAL_SCORE = RAW_SCORE × TIME_MULTIPLIER
   * 
   * COMPLETION_BONUS = 5000 (only if won, 0 if lost)
   * 
   * DETECTION_PENALTY = detectionCount × 500
   *   - Each time you get detected costs 500 points
   * 
   * PATH_BONUS = 1500 if path was NOT used, 0 otherwise
   * 
   * ALERT_BONUS = (alertRemaining / alertMax) × 2000
   *   - More alert bar remaining = more points (0-2000)
   * 
   * TIME_MULTIPLIER: Based on completion time
   *   - Under 60s:  2.0x (speed demon)
   *   - 60-120s:    1.5x (fast)
   *   - 120-180s:   1.2x (good pace)
   *   - 180-240s:   1.0x (normal)
   *   - 240-360s:   0.8x (slow)
   *   - 360-480s:   0.6x (very slow)
   *   - Over 480s:  0.4x (too slow)
   * 
   * The multiplier amplifies both positive AND negative scores:
   * - Fast + good play = very high score
   * - Fast + bad play = very negative score
   * - Slow + good play = reduced positive score
   * - Slow + bad play = less negative score
   * 
   * @param {boolean} isWin - Whether the player won
   */
  calculateScore(isWin) {
    const completionTimeMs = this.gameEndTime - this.gameStartTime;
    const completionTimeSec = completionTimeMs / 1000;
    
    // Completion bonus (only awarded for winning)
    const completionBonus = isWin ? 5000 : 0;
    
    // Detection penalty (each detection costs points)
    const detectionPenalty = this.detectionCount * 500;
    
    // Path ability bonus (didn't use the cheat = bonus)
    const pathBonus = this.pathUsedOnce ? 0 : 1500;
    
    // Alert remaining bonus (more alert = more points)
    const alertPercent = this.detectionTimer / this.detectionTimerMax;
    const alertBonus = Math.floor(alertPercent * 2000);
    
    // Calculate raw score before time multiplier
    const rawScore = completionBonus + pathBonus + alertBonus - detectionPenalty;
    
    // Calculate time multiplier based on completion time
    let timeMultiplier;
    if (completionTimeSec < 60) {
      // Under 1 minute: 2.0x
      timeMultiplier = 2.0;
    } else if (completionTimeSec < 120) {
      // 1-2 minutes: interpolate from 2.0 to 1.5
      timeMultiplier = 2.0 - ((completionTimeSec - 60) / 60) * 0.5;
    } else if (completionTimeSec < 180) {
      // 2-3 minutes: interpolate from 1.5 to 1.2
      timeMultiplier = 1.5 - ((completionTimeSec - 120) / 60) * 0.3;
    } else if (completionTimeSec < 240) {
      // 3-4 minutes: interpolate from 1.2 to 1.0
      timeMultiplier = 1.2 - ((completionTimeSec - 180) / 60) * 0.2;
    } else if (completionTimeSec < 360) {
      // 4-6 minutes: interpolate from 1.0 to 0.8
      timeMultiplier = 1.0 - ((completionTimeSec - 240) / 120) * 0.2;
    } else if (completionTimeSec < 480) {
      // 6-8 minutes: interpolate from 0.8 to 0.6
      timeMultiplier = 0.8 - ((completionTimeSec - 360) / 120) * 0.2;
    } else {
      // Over 8 minutes: 0.4x minimum
      timeMultiplier = Math.max(0.4, 0.6 - ((completionTimeSec - 480) / 300) * 0.2);
    }
    
    // Round multiplier to 2 decimal places for display
    timeMultiplier = Math.round(timeMultiplier * 100) / 100;
    
    // Calculate final score (can be negative!)
    this.finalScore = Math.round(rawScore * timeMultiplier);
    
    // Store breakdown for display
    this.scoreBreakdown = {
      completionTime: completionTimeSec,
      isWin,
      completionBonus,
      detectionCount: this.detectionCount,
      detectionPenalty,
      pathUsed: this.pathUsedOnce,
      pathBonus,
      alertPercent,
      alertBonus,
      rawScore,
      timeMultiplier,
      finalScore: this.finalScore
    };
    
    return this.finalScore;
  }

  /**
   * Gets the completion time in seconds
   * @returns {number} Time in seconds
   */
  getCompletionTime() {
    if (this.gameEndTime === 0) return 0;
    return (this.gameEndTime - this.gameStartTime) / 1000;
  }

  /**
   * Formats time as MM:SS.ms
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted time string
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  /**
   * Starts the game timer (called when instructions are dismissed)
   */
  startTimer() {
    this.gameStartTime = performance.now();
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
    this.isWin = false;
    this.showPath = false;
    this.currentPath = null;
    this.pathUsedOnce = false;
    this.pathRevealTime = 0;
    this.pathRegenerated = false;
    this.showInstructions = showInstructions;
    
    // Reset scoring state
    this.gameStartTime = 0;
    this.gameEndTime = 0;
    this.detectionCount = 0;
    this.wasDetectedThisFrame = false;
    this.finalScore = 0;
    this.scoreBreakdown = null;
  }

  /**
   * Dismisses instructions
   */
  dismissInstructions() {
    this.showInstructions = false;
  }

  /**
   * Checks if game should be paused (instructions/game over/win)
   * @returns {boolean} True if game logic should pause
   */
  shouldPauseGameLogic() {
    return this.showInstructions || this.isGameOver || this.isWin || this.isPaused;
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
