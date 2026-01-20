import UIComponent from './UIComponent.js';

/**
 * GameOverScreen - Displays the game over overlay
 */
class GameOverScreen extends UIComponent {
  /**
   * Creates the game over screen
   * @param {Object} config - Configuration
   * @param {string} [config.title='CAUGHT'] - Main title text
   * @param {string} [config.subtitle='You were detected for too long!'] - Subtitle text
   * @param {string} [config.instructions='Press R to restart'] - Instructions text
   */
  constructor({
    title = 'CAUGHT',
    subtitle = 'You were detected for too long!',
    instructions = 'Press R to restart'
  } = {}) {
    super({ visible: false });
    this.title = title;
    this.subtitle = subtitle;
    this.instructions = instructions;
  }

  /**
   * Draws the game over screen
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} w - Canvas width
   * @param {number} h - Canvas height
   */
  draw(ctx, w, h) {
    if (!this.visible) return;

    ctx.save();

    // Dark overlay
    ctx.fillStyle = 'rgba(20, 0, 0, 0.85)';
    ctx.fillRect(0, 0, w, h);

    // Red vignette
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
    gradient.addColorStop(0, 'rgba(50, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(100, 0, 0, 0.5)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Pulsing effect
    const pulse = this.getPulse(0.003);

    // Title
    ctx.font = `bold ${Math.floor(h * 0.12)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = `rgba(255, 50, 50, ${pulse})`;
    ctx.fillText(this.title, w / 2, h * 0.4);

    // Subtitle
    ctx.shadowBlur = 0;
    ctx.font = `${Math.floor(h * 0.035)}px Arial`;
    ctx.fillStyle = 'rgba(255, 150, 150, 0.8)';
    ctx.fillText(this.subtitle, w / 2, h * 0.52);

    // Instructions
    ctx.font = `${Math.floor(h * 0.03)}px Arial`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(this.instructions, w / 2, h * 0.65);

    ctx.restore();
  }
}

export default GameOverScreen;
