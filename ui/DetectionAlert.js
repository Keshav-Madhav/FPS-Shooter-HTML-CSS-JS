import UIComponent from './UIComponent.js';

/**
 * DetectionAlert - Shows "DETECTED" warning when player is spotted
 */
class DetectionAlert extends UIComponent {
  constructor() {
    super({ visible: true, opacity: 0 });
    this.isDetected = false;
  }

  /**
   * Sets the detection state
   * @param {boolean} detected - Whether player is currently detected
   */
  setDetected(detected) {
    this.isDetected = detected;
    this.targetOpacity = detected ? 1 : 0;
  }

  /**
   * Draws the detection alert
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} w - Canvas width
   * @param {number} h - Canvas height
   */
  draw(ctx, w, h) {
    if (this.opacity < 0.01) return;

    const y = h - 50;
    const pulse = this.isDetected ? this.getPulse(0.008) : 1;
    const text = '⚠ DETECTED';

    ctx.save();
    ctx.font = `bold ${Math.floor(h * 0.028)}px Arial`;
    
    const textWidth = ctx.measureText(text).width;
    const paddingX = 24;
    const pillWidth = textWidth + paddingX * 2;
    const pillHeight = h * 0.045;
    const pillX = w / 2 - pillWidth / 2;
    const pillY = y - pillHeight / 2;
    const pillRadius = pillHeight / 2;

    ctx.globalAlpha = this.opacity * pulse;

    // Pill background with red glow
    ctx.shadowColor = 'rgba(255, 60, 60, 0.8)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(180, 30, 30, 0.9)';
    ctx.beginPath();
    ctx.moveTo(pillX + pillRadius, pillY);
    ctx.lineTo(pillX + pillWidth - pillRadius, pillY);
    ctx.arc(pillX + pillWidth - pillRadius, pillY + pillRadius, pillRadius, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(pillX + pillRadius, pillY + pillHeight);
    ctx.arc(pillX + pillRadius, pillY + pillRadius, pillRadius, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, y);

    ctx.restore();
  }
}

export default DetectionAlert;
