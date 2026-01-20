import Zone from './ZoneClass.js';

/**
 * StartZone - Represents the spawn/start area in a level
 * Typically rendered with cyan/blue coloring
 */
class StartZone extends Zone {
  /**
   * Creates a start zone
   * @param {Object} config - Zone configuration
   * @param {number} config.x - X coordinate
   * @param {number} config.y - Y coordinate
   * @param {number} config.radius - Zone radius
   * @param {number} [config.spawnDirection=0] - Direction player faces when spawning
   */
  constructor({ x, y, radius, spawnDirection = 0 }) {
    super({
      x,
      y,
      radius,
      color: 'rgba(0, 200, 255, 0.8)',
      glowColor: 'rgba(0, 200, 255, 0.5)',
      pulseSpeed: 0.003
    });
    this.spawnDirection = spawnDirection;
    this.type = 'start';
  }

  /**
   * Draws the start zone on a minimap
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} drawX - X position on minimap
   * @param {number} drawY - Y position on minimap
   * @param {number} invScale - Inverse of minimap scale
   */
  drawOnMinimap(ctx, drawX, drawY, invScale) {
    const pulse = this.getPulse();

    // Outer glow
    const gradient = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, this.radius * 1.5);
    gradient.addColorStop(0, `rgba(0, 200, 255, ${0.5 * pulse})`);
    gradient.addColorStop(0.7, `rgba(0, 200, 255, ${0.25 * pulse})`);
    gradient.addColorStop(1, 'rgba(0, 200, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(drawX, drawY, this.radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Ring
    ctx.strokeStyle = `rgba(0, 200, 255, ${pulse})`;
    ctx.lineWidth = 2 * invScale;
    ctx.beginPath();
    ctx.arc(drawX, drawY, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Center marker
    ctx.fillStyle = `rgba(0, 200, 255, ${0.8 * pulse})`;
    ctx.beginPath();
    ctx.arc(drawX, drawY, 4 * invScale, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default StartZone;
