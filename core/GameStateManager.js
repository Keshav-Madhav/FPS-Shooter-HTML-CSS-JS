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
   * DETECTION_PENALTY = detectionCount × 300
   *   - Each time you get detected costs 300 points
   *
   * PATH_BONUS = 2000 if path was NOT used, 0 otherwise
   *
   * ALERT_BONUS = (alertRemaining / alertMax) × 2500
   *   - More alert bar remaining = more points (0-2500)
   *
   * TIME_MULTIPLIER: Based on completion time (relaxed for darker gameplay)
   *   - Under 90s:  2.0x (speed demon)
   *   - 90-180s:    1.5x (fast)
   *   - 180-300s:   1.0x (good pace)
   *   - 300-420s:   0.8x (normal)
   *   - 420-600s:   0.6x (slow)
   *   - Over 600s:  0.5x (minimum)
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
    
    // Detection penalty (each detection costs points - reduced for darker/harder maps)
    const detectionPenalty = this.detectionCount * 300;

    // Path ability bonus (didn't use the cheat = bonus)
    const pathBonus = this.pathUsedOnce ? 0 : 2000;

    // Alert remaining bonus (more alert = more points)
    const alertPercent = this.detectionTimer / this.detectionTimerMax;
    const alertBonus = Math.floor(alertPercent * 2500);
    
    // Calculate raw score before time multiplier
    const rawScore = completionBonus + pathBonus + alertBonus - detectionPenalty;
    
    // Calculate time multiplier based on completion time (relaxed for darker/harder gameplay)
    let timeMultiplier;
    if (completionTimeSec < 90) {
      // Under 1.5 minutes: 2.0x
      timeMultiplier = 2.0;
    } else if (completionTimeSec < 180) {
      // 1.5-3 minutes: interpolate from 2.0 to 1.5
      timeMultiplier = 2.0 - ((completionTimeSec - 90) / 90) * 0.5;
    } else if (completionTimeSec < 300) {
      // 3-5 minutes: interpolate from 1.5 to 1.0
      timeMultiplier = 1.5 - ((completionTimeSec - 180) / 120) * 0.5;
    } else if (completionTimeSec < 420) {
      // 5-7 minutes: interpolate from 1.0 to 0.8
      timeMultiplier = 1.0 - ((completionTimeSec - 300) / 120) * 0.2;
    } else if (completionTimeSec < 600) {
      // 7-10 minutes: interpolate from 0.8 to 0.6
      timeMultiplier = 0.8 - ((completionTimeSec - 420) / 180) * 0.2;
    } else {
      // Over 10 minutes: 0.5x minimum
      timeMultiplier = Math.max(0.5, 0.6 - ((completionTimeSec - 600) / 300) * 0.1);
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
