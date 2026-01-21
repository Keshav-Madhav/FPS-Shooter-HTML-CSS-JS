import UIComponent from './UIComponent.js';

/**
 * WinScreen - Displays the victory overlay when player reaches the goal
 */
class WinScreen extends UIComponent {
  /**
   * Creates the win screen
   * @param {Object} config - Configuration
   * @param {string} [config.title='VICTORY!'] - Main title text
   * @param {string} [config.instructions='Press R to play again | Press M for map selector'] - Instructions text
   */
  constructor({
    title = 'VICTORY!',
    instructions = 'Press R to play again | Press M for map selector'
  } = {}) {
    super({ visible: false });
    this.title = title;
    this.instructions = instructions;
    this.startTime = 0;
    this.scoreBreakdown = null;
  }

  /**
   * Shows the win screen with score data
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
   * Draws the win screen
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} w - Canvas width
   * @param {number} h - Canvas height
   */
  draw(ctx, w, h) {
    if (!this.visible) return;

    const elapsed = (performance.now() - this.startTime) / 1000;
    
    ctx.save();

    // Dark overlay with green tint
    ctx.fillStyle = 'rgba(0, 20, 10, 0.9)';
    ctx.fillRect(0, 0, w, h);

    // Green vignette (victory glow)
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
    gradient.addColorStop(0, 'rgba(0, 100, 50, 0.3)');
    gradient.addColorStop(0.5, 'rgba(0, 80, 40, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 60, 30, 0.4)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Animated particles/stars effect
    this.drawParticles(ctx, w, h, elapsed);

    // Pulsing effect for title
    const pulse = this.getPulse(0.004);
    const bounceIn = Math.min(1, elapsed * 3);

    // Title with glow effect
    const titleSize = Math.floor(h * 0.1 * bounceIn);
    ctx.font = `bold ${titleSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Multiple glow layers
    ctx.shadowColor = 'rgba(50, 255, 100, 0.9)';
    ctx.shadowBlur = 40;
    ctx.fillStyle = `rgba(50, 255, 100, ${pulse})`;
    ctx.fillText(this.title, w / 2, h * 0.12);
    
    ctx.shadowBlur = 20;
    ctx.fillText(this.title, w / 2, h * 0.12);
    ctx.shadowBlur = 0;

    // Draw score breakdown
    if (this.scoreBreakdown) {
      this.drawScoreBreakdown(ctx, w, h, elapsed);
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
    const panelY = h * 0.2;
    const panelWidth = w * 0.5;
    const panelHeight = h * 0.68;
    
    // Animate panel entrance
    const slideIn = Math.min(1, elapsed * 2);
    const currentPanelY = panelY + (1 - slideIn) * 50;
    
    // Panel background
    ctx.fillStyle = 'rgba(0, 40, 20, 0.8)';
    ctx.strokeStyle = 'rgba(50, 255, 100, 0.5)';
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
    
    // Completion Time (large, centered)
    ctx.font = `bold ${Math.floor(h * 0.022)}px Arial`;
    ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('COMPLETION TIME', w / 2, y);
    
    y += lineHeight * 0.8;
    ctx.font = `bold ${Math.floor(h * 0.045)}px Arial`;
    ctx.fillStyle = 'rgba(100, 255, 150, 1)';
    ctx.fillText(this.formatTime(sb.completionTime), w / 2, y);
    
    y += lineHeight * 1.0;
    
    // Divider line
    ctx.strokeStyle = 'rgba(50, 255, 100, 0.3)';
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();
    
    y += lineHeight * 0.7;
    
    // Score breakdown rows
    const fontSize = Math.floor(h * 0.021);
    ctx.font = `${fontSize}px Arial`;
    
    // Completion Bonus
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
    ctx.fillText('Completion Bonus', leftX, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(100, 255, 150, 1)';
    ctx.fillText(`+${sb.completionBonus.toLocaleString()}`, rightX, y);
    
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
      ctx.fillStyle = 'rgba(255, 215, 0, 1)';
      ctx.fillText(`+${sb.pathBonus.toLocaleString()}`, rightX, y);
    }
    
    y += lineHeight;
    
    // Alert Remaining Bonus
    const alertPct = Math.floor(sb.alertPercent * 100);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
    ctx.fillText(`Alert Remaining (${alertPct}%)`, leftX, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(100, 200, 255, 1)';
    ctx.fillText(`+${sb.alertBonus.toLocaleString()}`, rightX, y);
    
    y += lineHeight;
    
    // Detection Penalty
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
    ctx.fillText(`Detections (${sb.detectionCount}x)`, leftX, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = sb.detectionPenalty > 0 ? 'rgba(255, 100, 100, 1)' : 'rgba(100, 255, 150, 1)';
    ctx.fillText(sb.detectionPenalty > 0 ? `-${sb.detectionPenalty.toLocaleString()}` : '+0', rightX, y);
    
    y += lineHeight * 1.0;
    
    // Raw Score subtotal
    ctx.strokeStyle = 'rgba(50, 255, 100, 0.2)';
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();
    
    y += lineHeight * 0.7;
    
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(180, 180, 180, 0.9)';
    ctx.fillText('Raw Score', leftX, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = sb.rawScore >= 0 ? 'rgba(150, 255, 180, 1)' : 'rgba(255, 150, 150, 1)';
    ctx.fillText(sb.rawScore >= 0 ? `+${sb.rawScore.toLocaleString()}` : sb.rawScore.toLocaleString(), rightX, y);
    
    y += lineHeight * 1.0;
    
    // Time Multiplier (highlighted)
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
    ctx.fillText('Time Multiplier', leftX, y);
    ctx.textAlign = 'right';
    
    // Color the multiplier based on value
    let multColor;
    if (sb.timeMultiplier >= 1.5) {
      multColor = 'rgba(255, 215, 0, 1)'; // Gold for great times
    } else if (sb.timeMultiplier >= 1.0) {
      multColor = 'rgba(100, 255, 150, 1)'; // Green for good times
    } else if (sb.timeMultiplier >= 0.7) {
      multColor = 'rgba(255, 200, 100, 1)'; // Orange for slow
    } else {
      multColor = 'rgba(255, 100, 100, 1)'; // Red for very slow
    }
    ctx.fillStyle = multColor;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillText(`×${sb.timeMultiplier.toFixed(2)}`, rightX, y);
    ctx.font = `${fontSize}px Arial`;
    
    y += lineHeight * 1.0;
    
    // Divider line before final
    ctx.strokeStyle = 'rgba(50, 255, 100, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();
    
    y += lineHeight * 0.8;
    
    // Final Score (animated counting up)
    const scoreRevealTime = 0.5;
    const scoreCountDuration = 1.5;
    let displayScore = 0;
    
    if (elapsed > scoreRevealTime) {
      const countProgress = Math.min(1, (elapsed - scoreRevealTime) / scoreCountDuration);
      const eased = 1 - Math.pow(1 - countProgress, 3);
      displayScore = Math.round(sb.finalScore * eased);
    }
    
    ctx.font = `bold ${Math.floor(h * 0.024)}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fillText('FINAL SCORE', leftX, y);
    
    ctx.textAlign = 'right';
    const scorePulse = elapsed > scoreRevealTime + scoreCountDuration ? this.getPulse(0.005) : 1;
    ctx.font = `bold ${Math.floor(h * 0.04)}px Arial`;
    
    // Color based on positive/negative
    if (sb.finalScore >= 0) {
      ctx.fillStyle = `rgba(255, 215, 0, ${scorePulse})`;
      ctx.shadowColor = 'rgba(255, 200, 0, 0.8)';
    } else {
      ctx.fillStyle = `rgba(255, 100, 100, ${scorePulse})`;
      ctx.shadowColor = 'rgba(255, 50, 50, 0.8)';
    }
    ctx.shadowBlur = 15;
    ctx.fillText(displayScore.toLocaleString(), rightX, y + 3);
    ctx.shadowBlur = 0;
    
    // Score rating
    y += lineHeight * 1.2;
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.floor(h * 0.026)}px Arial`;
    
    let rating, ratingColor;
    if (sb.finalScore >= 15000) {
      rating = 'S RANK - LEGENDARY!';
      ratingColor = 'rgba(255, 215, 0, 1)';
    } else if (sb.finalScore >= 12000) {
      rating = 'A RANK - EXCELLENT!';
      ratingColor = 'rgba(100, 255, 100, 1)';
    } else if (sb.finalScore >= 9000) {
      rating = 'B RANK - GREAT!';
      ratingColor = 'rgba(100, 200, 255, 1)';
    } else if (sb.finalScore >= 6000) {
      rating = 'C RANK - GOOD';
      ratingColor = 'rgba(200, 200, 200, 1)';
    } else if (sb.finalScore >= 3000) {
      rating = 'D RANK - OKAY';
      ratingColor = 'rgba(200, 150, 100, 1)';
    } else if (sb.finalScore >= 0) {
      rating = 'E RANK - NEEDS WORK';
      ratingColor = 'rgba(180, 100, 80, 1)';
    } else {
      rating = 'F RANK - TRY AGAIN';
      ratingColor = 'rgba(255, 80, 80, 1)';
    }
    
    if (elapsed > scoreRevealTime + scoreCountDuration + 0.3) {
      ctx.fillStyle = ratingColor;
      ctx.fillText(rating, w / 2, y);
    }
  }

  /**
   * Draws animated particles
   * @private
   */
  drawParticles(ctx, w, h, elapsed) {
    const particleCount = 25;
    
    for (let i = 0; i < particleCount; i++) {
      const seed = i * 137.5;
      const x = ((seed * 0.618) % 1) * w;
      const baseY = ((seed * 0.414) % 1) * h;
      const y = (baseY - elapsed * 20 * (0.5 + (seed % 1))) % h;
      const actualY = y < 0 ? h + y : y;
      
      const size = 2 + (seed % 3);
      const alpha = 0.2 + 0.3 * Math.sin(elapsed * 2 + seed);
      
      ctx.fillStyle = `rgba(100, 255, 150, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, actualY, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export default WinScreen;
