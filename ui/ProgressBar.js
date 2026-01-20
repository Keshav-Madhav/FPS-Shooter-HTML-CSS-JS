import UIComponent from './UIComponent.js';
import { DetectionConfig, UIConfig } from '../config/GameConfig.js';

/**
 * ProgressBar - A generic progress/timer bar component
 * Can be used for detection timer, health, stamina, etc.
 */
class ProgressBar extends UIComponent {
  /**
   * Creates a progress bar
   * @param {Object} config - Configuration
   * @param {number} config.maxValue - Maximum value
   * @param {number} config.width - Bar width in pixels
   * @param {number} config.height - Bar height in pixels
   * @param {string} [config.label=''] - Label text
   * @param {string} [config.position='bottom'] - Position: 'top', 'bottom', 'center'
   * @param {boolean} [config.showValue=true] - Whether to show numeric value
   */
  constructor({ 
    maxValue, 
    width = 200, 
    height = 20, 
    label = '', 
    position = 'bottom',
    showValue = true 
  }) {
    super();
    this.maxValue = maxValue;
    this.currentValue = maxValue;
    this.width = width;
    this.height = height;
    this.label = label;
    this.position = position;
    this.showValue = showValue;
  }

  /**
   * Sets the current value
   * @param {number} value - New value
   */
  setValue(value) {
    this.currentValue = Math.max(0, Math.min(value, this.maxValue));
  }

  /**
   * Gets the percentage filled
   * @returns {number} Value between 0 and 1
   */
  getPercentage() {
    return this.currentValue / this.maxValue;
  }

  /**
   * Gets the color based on current percentage
   * @returns {string} CSS color string
   */
  getColor() {
    const percent = this.getPercentage();
    const { greenThreshold, yellowThreshold } = UIConfig.timerBar;

    if (percent > greenThreshold) {
      return 'rgba(100, 255, 100, 0.9)';
    } else if (percent > yellowThreshold) {
      return 'rgba(255, 200, 50, 0.9)';
    } else {
      const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.015);
      return `rgba(255, 50, 50, ${0.9 * pulse})`;
    }
  }

  /**
   * Draws the progress bar
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} w - Canvas width
   * @param {number} h - Canvas height
   */
  draw(ctx, w, h) {
    if (!this.visible || this.currentValue >= this.maxValue) return;

    const percent = this.getPercentage();
    const color = this.getColor();

    // Calculate position
    let barX = w / 2 - this.width / 2;
    let barY;
    
    switch (this.position) {
      case 'top':
        barY = h * 0.08 - this.height / 2;
        break;
      case 'center':
        barY = h / 2 - this.height / 2;
        break;
      case 'bottom':
      default:
        barY = h - 100 - this.height / 2;
    }

    ctx.save();

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX - 5, barY - 5, this.width + 10, this.height + 10);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, this.width, this.height);

    // Fill
    ctx.fillStyle = color;
    ctx.fillRect(barX + 2, barY + 2, (this.width - 4) * percent, this.height - 4);

    // Value text
    if (this.showValue) {
      ctx.font = `bold ${Math.floor(h * 0.025)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(this.currentValue.toFixed(2) + 's', w / 2, barY - 10);
    }

    // Label
    if (this.label) {
      ctx.font = `${Math.floor(h * 0.015)}px Arial`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.textAlign = 'center';
      ctx.fillText(this.label, w / 2, barY + this.height + 15);
    }

    ctx.restore();
  }
}

export default ProgressBar;
