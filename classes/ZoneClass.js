/**
 * Base Zone class representing a circular area in the game world
 * Used for start zones, goal zones, checkpoints, etc.
 */
class Zone {
  /**
   * Creates a new zone
   * @param {Object} config - Zone configuration
   * @param {number} config.x - X coordinate of zone center
   * @param {number} config.y - Y coordinate of zone center
   * @param {number} config.radius - Radius of the zone
   * @param {string} [config.color='#ffffff'] - Primary color for rendering
   * @param {string} [config.glowColor='#ffffff'] - Glow color for effects
   * @param {number} [config.pulseSpeed=0.003] - Speed of pulse animation
   */
  constructor({ x, y, radius, color = '#ffffff', glowColor = null, pulseSpeed = 0.003 }) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.glowColor = glowColor || color;
    this.pulseSpeed = pulseSpeed;
  }

  /**
   * Checks if a position is within this zone
   * @param {number} x - X coordinate to check
   * @param {number} y - Y coordinate to check
   * @returns {boolean} True if position is in zone
   */
  containsPoint(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    return (dx * dx + dy * dy) <= (this.radius * this.radius);
  }

  /**
   * Gets the distance from a point to the zone center
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {number} Distance to center
   */
  distanceToCenter(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Gets the current pulse value (for animations)
   * @returns {number} Pulse value between 0.7 and 1.0
   */
  getPulse() {
    return 0.7 + 0.3 * Math.sin(performance.now() * this.pulseSpeed);
  }

  /**
   * Returns zone data as a plain object
   * @returns {Object} Zone data
   */
  toObject() {
    return {
      x: this.x,
      y: this.y,
      radius: this.radius
    };
  }
}

export default Zone;
