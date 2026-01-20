import Zone from './ZoneClass.js';

/**
 * GoalZone - Represents the objective/goal area in a level
 * Typically rendered with green coloring
 */
class GoalZone extends Zone {
  /**
   * Creates a goal zone
   * @param {Object} config - Zone configuration
   * @param {number} config.x - X coordinate
   * @param {number} config.y - Y coordinate
   * @param {number} config.radius - Zone radius
   * @param {Function} [config.onReached] - Callback when player reaches goal
   */
  constructor({ x, y, radius, onReached = null }) {
    super({
      x,
      y,
      radius,
      color: 'rgba(0, 255, 100, 0.8)',
      glowColor: 'rgba(0, 255, 100, 0.6)',
      pulseSpeed: 0.004
    });
    this.onReached = onReached;
    this.type = 'goal';
    this.isReached = false;
  }

  /**
   * Checks if a player has reached this goal
   * @param {number} x - Player X coordinate
   * @param {number} y - Player Y coordinate
   * @returns {boolean} True if player is in goal zone
   */
  checkReached(x, y) {
    if (!this.isReached && this.containsPoint(x, y)) {
      this.isReached = true;
      if (this.onReached) {
        this.onReached();
      }
      return true;
    }
    return this.isReached;
  }

  /**
   * Resets the goal state
   */
  reset() {
    this.isReached = false;
  }

  /**
   * Draws the goal zone on a minimap
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} drawX - X position on minimap
   * @param {number} drawY - Y position on minimap
   * @param {number} invScale - Inverse of minimap scale
   */
  drawOnMinimap(ctx, drawX, drawY, invScale) {
    const pulse = this.getPulse();

    // Outer glow
    const gradient = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, this.radius * 1.5);
    gradient.addColorStop(0, `rgba(0, 255, 100, ${0.6 * pulse})`);
    gradient.addColorStop(0.7, `rgba(0, 255, 100, ${0.3 * pulse})`);
    gradient.addColorStop(1, 'rgba(0, 255, 100, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(drawX, drawY, this.radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Ring
    ctx.strokeStyle = `rgba(0, 255, 100, ${pulse})`;
    ctx.lineWidth = 2 * invScale;
    ctx.beginPath();
    ctx.arc(drawX, drawY, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Center marker
    ctx.fillStyle = `rgba(0, 255, 100, ${0.8 * pulse})`;
    ctx.beginPath();
    ctx.arc(drawX, drawY, 4 * invScale, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default GoalZone;
