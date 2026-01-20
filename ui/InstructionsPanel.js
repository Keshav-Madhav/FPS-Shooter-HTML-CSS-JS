import UIComponent from './UIComponent.js';
import { UIConfig } from '../config/GameConfig.js';

/**
 * InstructionsPanel - Displays game instructions/tutorial overlay
 */
class InstructionsPanel extends UIComponent {
  /**
   * Creates an instructions panel
   * @param {Object} config - Configuration
   * @param {string} config.title - Panel title
   * @param {Array<{heading?: string, lines: string[]}>} config.sections - Content sections
   * @param {string} [config.dismissPrompt='Press ENTER or SPACE to start'] - Dismiss text
   */
  constructor({ title, sections, dismissPrompt = 'Press ENTER or SPACE to start' }) {
    super({ visible: false });
    this.title = title;
    this.sections = sections;
    this.dismissPrompt = dismissPrompt;
    this.isDismissed = false;
  }

  /**
   * Shows the panel
   */
  show() {
    super.show();
    this.isDismissed = false;
  }

  /**
   * Dismisses the panel
   */
  dismiss() {
    this.isDismissed = true;
    this.hide();
  }

  /**
   * Draws the instructions panel
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} w - Canvas width
   * @param {number} h - Canvas height
   */
  draw(ctx, w, h) {
    if (!this.visible || this.isDismissed) return;

    ctx.save();

    const config = UIConfig.instructionsPanel;
    const panelWidth = w * config.width;
    const panelHeight = h * config.height;
    const panelX = (w - panelWidth) / 2;
    const panelY = h * 0.1;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

    // Border with pulse
    const pulse = this.getPulse(config.pulseSpeed);
    ctx.strokeStyle = `rgba(100, 200, 255, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Title
    ctx.fillStyle = '#00ccff';
    ctx.font = `bold ${Math.floor(h * 0.04)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.title, w / 2, panelY + h * 0.02);

    // Content
    const contentX = panelX + panelWidth * 0.1;
    let contentY = panelY + h * 0.09;
    const lineHeight = h * 0.035;

    for (const section of this.sections) {
      // Section heading
      if (section.heading) {
        ctx.fillStyle = '#ffaa00';
        ctx.font = `bold ${Math.floor(h * 0.024)}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(section.heading, contentX, contentY);
        contentY += lineHeight;
      }

      // Section lines
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = `${Math.floor(h * 0.022)}px Arial`;
      
      for (const line of section.lines) {
        ctx.fillText(line, contentX, contentY);
        contentY += lineHeight;
      }
      
      contentY += lineHeight * 0.3; // Gap between sections
    }

    // Dismiss prompt
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(100, 255, 100, ${pulse})`;
    ctx.font = `bold ${Math.floor(h * 0.028)}px Arial`;
    ctx.fillText(this.dismissPrompt, w / 2, panelY + panelHeight - h * 0.05);

    ctx.restore();
  }
}

export default InstructionsPanel;
