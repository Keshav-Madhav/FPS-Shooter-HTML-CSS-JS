import UIComponent from './UIComponent.js';

/**
 * GameOverScreen - Displays the game over overlay with stats
 */
class GameOverScreen extends UIComponent {
  /**
   * Creates the game over screen
   * @param {Object} config - Configuration
   * @param {string} [config.title='CAUGHT'] - Main title text
   * @param {string} [config.subtitle='You were detected for too long!'] - Subtitle text
   * @param {string} [config.instructions='Press R to restart | Press M for map selector'] - Instructions text
   */
  constructor({
    title = 'CAUGHT',
    subtitle = 'You were detected for too long!',
    instructions = 'Press R to restart | Press M for map selector'
  } = {}) {
    super({ visible: false });
    this.title = title;
    this.subtitle = subtitle;
    this.instructions = instructions;
    this.startTime = 0;
    this.scoreBreakdown = null;
  }

  /**
   * Shows the game over screen with score data
   * @param {Object} scoreBreakdown - Score breakdown from GameStateManager
   */
  show(scoreBreakdown = null) {
    super.show();
    this.startTime = performance.now();
    this.scoreBreakdown = scoreBreakdown;
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
   * Draws the game over screen
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} w - Canvas width
   * @param {number} h - Canvas height
   */
  draw(ctx, w, h) {
    if (!this.visible) return;

    const elapsed = (performance.now() - this.startTime) / 1000;

    ctx.save();

    // Dark overlay with red tint
    ctx.fillStyle = 'rgba(20, 0, 0, 0.9)';
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
    ctx.font = `bold ${Math.floor(h * 0.1)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = `rgba(255, 50, 50, ${pulse})`;
    ctx.fillText(this.title, w / 2, h * 0.1);
    
    ctx.shadowBlur = 0;

    // Draw score breakdown if available
    if (this.scoreBreakdown) {
      this.drawScoreBreakdown(ctx, w, h, elapsed);
    } else {
      // Fallback to simple display
      ctx.font = `${Math.floor(h * 0.035)}px Arial`;
      ctx.fillStyle = 'rgba(255, 150, 150, 0.8)';
      ctx.fillText(this.subtitle, w / 2, h * 0.5);
    }

    // Instructions at the bottom
    ctx.font = `${Math.floor(h * 0.022)}px Arial`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(this.instructions, w / 2, h * 0.94);

    ctx.restore();
  }

  /**
   * Draws the score breakdown panel
   * @private
   */
  drawScoreBreakdown(ctx, w, h, elapsed) {
    const sb = this.scoreBreakdown;
    const panelX = w * 0.25;
    const panelY = h * 0.18;
    const panelWidth = w * 0.5;
    const panelHeight = h * 0.68;
    
    // Animate panel entrance
    const slideIn = Math.min(1, elapsed * 2);
    const currentPanelY = panelY + (1 - slideIn) * 50;
    
    // Panel background (dark red)
    ctx.fillStyle = 'rgba(40, 10, 10, 0.8)';
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(panelX, currentPanelY, panelWidth, panelHeight, 10);
    ctx.fill();
    ctx.stroke();
    
    // Content layout
    const leftX = panelX + 30;
    const rightX = panelX + panelWidth - 30;
    let y = currentPanelY + 35;
    const lineHeight = h * 0.042;
    
    // Subtitle
    ctx.font = `${Math.floor(h * 0.022)}px Arial`;
    ctx.fillStyle = 'rgba(255, 150, 150, 0.9)';
    ctx.textAlign = 'center';
    ctx.fillText(this.subtitle, w / 2, y);
    
    y += lineHeight * 1.0;
    
    // Time Survived
    ctx.font = `bold ${Math.floor(h * 0.02)}px Arial`;
    ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('TIME SURVIVED', w / 2, y);
    
    y += lineHeight * 0.7;
    ctx.font = `bold ${Math.floor(h * 0.04)}px Arial`;
    ctx.fillStyle = 'rgba(255, 150, 150, 1)';
    ctx.fillText(this.formatTime(sb.completionTime), w / 2, y);
    
    y += lineHeight * 0.9;
    
    // Divider line
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.3)';
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();
    
    y += lineHeight * 0.6;
    
    // Score breakdown rows
    const fontSize = Math.floor(h * 0.02);
    ctx.font = `${fontSize}px Arial`;
    
    // Completion Bonus (0 for game over)
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
    ctx.fillText('Completion Bonus (Failed)', leftX, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
    ctx.fillText('0', rightX, y);
    
    y += lineHeight;
    
    // Path Bonus
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
    ctx.fillText('No Path Used', leftX, y);
    ctx.textAlign = 'right';
    if (sb.pathUsed) {
      ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
      ctx.fillText('--', rightX, y);
    } else {
      ctx.fillStyle = 'rgba(255, 200, 100, 1)';
      ctx.fillText(`+${sb.pathBonus.toLocaleString()}`, rightX, y);
    }
    
    y += lineHeight;
    
    // Alert Remaining (will be 0 for game over)
    const alertPct = Math.floor(sb.alertPercent * 100);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
    ctx.fillText(`Alert Remaining (${alertPct}%)`, leftX, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
    ctx.fillText(`+${sb.alertBonus.toLocaleString()}`, rightX, y);
    
    y += lineHeight;
    
    // Detection Count
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
    ctx.fillText(`Detections (${sb.detectionCount}x)`, leftX, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 100, 100, 1)';
    ctx.fillText(`-${sb.detectionPenalty.toLocaleString()}`, rightX, y);
    
    y += lineHeight * 0.9;
    
    // Raw Score subtotal
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.2)';
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();
    
    y += lineHeight * 0.6;
    
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(180, 180, 180, 0.9)';
    ctx.fillText('Raw Score', leftX, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = sb.rawScore >= 0 ? 'rgba(150, 200, 150, 1)' : 'rgba(255, 150, 150, 1)';
    ctx.fillText(sb.rawScore >= 0 ? `+${sb.rawScore.toLocaleString()}` : sb.rawScore.toLocaleString(), rightX, y);
    
    y += lineHeight * 0.9;
    
    // Time Multiplier
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
    ctx.fillText('Time Multiplier', leftX, y);
    ctx.textAlign = 'right';
    
    // Color the multiplier based on value
    let multColor;
    if (sb.timeMultiplier >= 1.5) {
      multColor = 'rgba(255, 215, 0, 1)';
    } else if (sb.timeMultiplier >= 1.0) {
      multColor = 'rgba(100, 200, 100, 1)';
    } else if (sb.timeMultiplier >= 0.7) {
      multColor = 'rgba(255, 200, 100, 1)';
    } else {
      multColor = 'rgba(255, 100, 100, 1)';
    }
    ctx.fillStyle = multColor;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillText(`×${sb.timeMultiplier.toFixed(2)}`, rightX, y);
    ctx.font = `${fontSize}px Arial`;
    
    y += lineHeight * 0.9;
    
    // Divider line
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();
    
    y += lineHeight * 0.7;
    
    // Final Score
    ctx.font = `bold ${Math.floor(h * 0.022)}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fillText('FINAL SCORE', leftX, y);
    
    ctx.textAlign = 'right';
    ctx.font = `bold ${Math.floor(h * 0.035)}px Arial`;
    ctx.fillStyle = sb.finalScore >= 0 ? 'rgba(255, 200, 150, 1)' : 'rgba(255, 100, 100, 1)';
    ctx.fillText(sb.finalScore.toLocaleString(), rightX, y + 2);
    
    y += lineHeight * 1.1;
    
    // Encouragement message
    ctx.textAlign = 'center';
    ctx.font = `${Math.floor(h * 0.02)}px Arial`;
    ctx.fillStyle = 'rgba(255, 200, 150, 0.9)';
    
    // Different messages based on how close they got
    let message;
    if (sb.rawScore > 0) {
      message = 'So close! Try to avoid those last detections.';
    } else if (sb.detectionCount > 5) {
      message = 'Too many detections. Try a stealthier approach!';
    } else {
      message = 'Keep practicing - you\'ll get there!';
    }
    ctx.fillText(message, w / 2, y);
  }
}


export default GameOverScreen;
