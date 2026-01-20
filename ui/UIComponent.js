import { UIConfig } from '../config/GameConfig.js';

/**
 * Base class for all UI components
 * Provides common functionality for drawing HUD elements
 */
class UIComponent {
  /**
   * Creates a UI component
   * @param {Object} config - Configuration object
   * @param {boolean} [config.visible=true] - Whether the component is visible
   * @param {number} [config.opacity=1] - Component opacity
   */
  constructor({ visible = true, opacity = 1 } = {}) {
    this.visible = visible;
    this.opacity = opacity;
    this.targetOpacity = opacity;
  }

  /**
   * Updates the component state
   * @param {number} deltaTime - Time since last frame
   */
  update(deltaTime) {
    // Smooth opacity transitions
    if (this.opacity !== this.targetOpacity) {
      const diff = this.targetOpacity - this.opacity;
      this.opacity += diff * UIConfig.alert.fadeSpeed;
      if (Math.abs(diff) < 0.01) {
        this.opacity = this.targetOpacity;
      }
    }
  }

  /**
   * Draws the component
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   */
  draw(ctx, canvasWidth, canvasHeight) {
    // Override in subclasses
  }

  /**
   * Shows the component
   */
  show() {
    this.visible = true;
    this.targetOpacity = 1;
  }

  /**
   * Hides the component
   */
  hide() {
    this.targetOpacity = 0;
  }

  /**
   * Gets a pulsing value for animations
   * @param {number} speed - Pulse speed multiplier
   * @returns {number} Pulse value between 0.85 and 1.0
   */
  getPulse(speed = 0.008) {
    return 0.85 + 0.15 * Math.sin(performance.now() * speed);
  }
}

export default UIComponent;
