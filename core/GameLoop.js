import { GameLoopConfig } from '../config/GameConfig.js';

/**
 * GameLoop - Manages the game loop with options for vsync or uncapped FPS
 */
class GameLoop {
  /**
   * Creates a game loop
   * @param {Function} updateCallback - Function to call each frame
   * @param {Object} [config={}] - Configuration options
   */
  constructor(updateCallback, config = {}) {
    this.updateCallback = updateCallback;
    this.isRunning = false;
    this.uncappedFps = config.uncappedFps ?? GameLoopConfig.uncappedFps;
    
    // Frame timing
    this.lastFrameTime = 0;
    this.targetFps = config.targetFps || GameLoopConfig.targetFps;
    
    // Bound methods for RAF
    this._vsyncLoop = this._vsyncLoop.bind(this);
    
    // Message channel for uncapped loop
    this._channel = null;
  }

  /**
   * Starts the game loop
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    
    if (this.uncappedFps) {
      this._startUncappedLoop();
    } else {
      this._startVsyncLoop();
    }
  }

  /**
   * Stops the game loop
   */
  stop() {
    this.isRunning = false;
    
    if (this._channel) {
      this._channel.port1.onmessage = null;
      this._channel = null;
    }
  }

  /**
   * Starts vsync-locked loop using requestAnimationFrame
   * @private
   */
  _startVsyncLoop() {
    requestAnimationFrame(this._vsyncLoop);
  }

  /**
   * Vsync loop callback
   * @private
   */
  _vsyncLoop() {
    if (!this.isRunning) return;
    
    this.updateCallback();
    requestAnimationFrame(this._vsyncLoop);
  }

  /**
   * Starts uncapped loop using MessageChannel
   * @private
   */
  _startUncappedLoop() {
    this._channel = new MessageChannel();
    
    this._channel.port1.onmessage = () => {
      if (!this.isRunning) return;
      
      this.updateCallback();
      this._channel.port2.postMessage(null);
    };
    
    this._channel.port2.postMessage(null);
  }

  /**
   * Gets normalized delta time for consistent physics
   * @returns {number} Delta time normalized to target FPS
   */
  getDeltaTime() {
    const currentTime = performance.now();
    const delta = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    
    // Normalize delta to target FPS (e.g., 120)
    const targetFrameTime = 1000 / this.targetFps;
    return delta / targetFrameTime;
  }

  /**
   * Gets raw delta time in seconds
   * @returns {number} Delta time in seconds
   */
  getRealDeltaSeconds() {
    const currentTime = performance.now();
    const delta = currentTime - this.lastFrameTime;
    // Don't update lastFrameTime here - getDeltaTime does that
    return delta / 1000;
  }

  /**
   * Sets whether to use uncapped FPS
   * @param {boolean} uncapped - Whether to use uncapped FPS
   */
  setUncapped(uncapped) {
    if (this.uncappedFps === uncapped) return;
    
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.stop();
    }
    
    this.uncappedFps = uncapped;
    
    if (wasRunning) {
      this.start();
    }
  }
}

export default GameLoop;
