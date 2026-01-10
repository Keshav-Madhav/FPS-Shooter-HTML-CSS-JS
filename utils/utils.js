import Boundaries from "../classes/BoundariesClass.js";
import Player from "../classes/UserClass.js";
import { DEG_TO_RAD, fastSin, fastCos } from "./mathLUT.js";

/**
 * Resizes all canvas elements in the canvasArray to maintain the specified aspect ratio.
 * @param {Object} options - The options for resizing the canvas.
 * @param {HTMLCanvasElement[]} options.canvasArray - An array of canvas elements to resize.
 * @param {number} [options.ratio] - The target aspect ratio for the canvas elements.
 */
function resizeCanvas({ canvasArray, ratio }) {
  const targetRatio = ratio || window.innerWidth / window.innerHeight;
  const windowRatio = window.innerWidth / window.innerHeight;
  
  let width, height;
  if (windowRatio > targetRatio) {
    height = window.innerHeight;
    width = height * targetRatio;
  } else {
    width = window.innerWidth;
    height = width / targetRatio;
  }

  for (let i = 0; i < canvasArray.length; i++) {
    canvasArray[i].width = width;
    canvasArray[i].height = height;
  }
}

/**
 * Draws the background gradient (sky and floor)
 * @param {CanvasRenderingContext2D} background_ctx - Background canvas context
 * @param {number} height - Canvas height
 * @param {number} width - Canvas width
 */
function drawBackground(background_ctx, height, width) {
  const topStartLuminosity = 55;
  const topEndLuminosity = 20;
  const bottomStartLuminosity = 40;
  const bottomEndLuminosity = 10;
  const halfHeight = height * 0.5;

  background_ctx.clearRect(0, 0, width, height);

  // Top gradient (sky)
  const topGradient = background_ctx.createLinearGradient(0, 0, 0, halfHeight);
  topGradient.addColorStop(0, `hsl(210,20%,${topStartLuminosity}%)`);
  topGradient.addColorStop(1, `hsl(210,20%,${topEndLuminosity}%)`);
  background_ctx.fillStyle = topGradient;
  background_ctx.fillRect(0, 0, width, halfHeight);

  // Bottom gradient (floor)
  const bottomGradient = background_ctx.createLinearGradient(0, height, 0, halfHeight);
  bottomGradient.addColorStop(0, `hsl(0,0%,${bottomStartLuminosity}%)`);
  bottomGradient.addColorStop(1, `hsl(0,0%,${bottomEndLuminosity}%)`);
  background_ctx.fillStyle = bottomGradient;
  background_ctx.fillRect(0, halfHeight, width, halfHeight);
}

/**
 * Draws a circular minimap on the main canvas
 * Optimized with reduced object allocations and cached calculations
 * @param {CanvasRenderingContext2D} ctx - The rendering context
 * @param {Array<Boundaries>} boundaries - Array of boundary objects
 * @param {Player} user - The user object
 * @param {EnemyClass[]} enemies - Array of enemy objects
 */
function drawMinimap(ctx, boundaries, user, enemies) {
  const scale = miniMapSettings.scale;
  const invScale = 1 / scale;
  const centerX = miniMapSettings.x * invScale;
  const centerY = miniMapSettings.y * invScale;
  const radius = miniMapSettings.radius;

  ctx.save();
  ctx.scale(scale, scale);

  // Create circular clipping path
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.clip();

  // Draw border
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2 * invScale;
  ctx.stroke();

  // Calculate offset to keep player centered
  const offsetX = centerX - user.pos.x;
  const offsetY = centerY - user.pos.y;

  // Draw boundaries
  ctx.strokeStyle = 'white';
  ctx.lineWidth = invScale;
  
  const boundaryCount = boundaries.length;
  for (let i = 0; i < boundaryCount; i++) {
    const boundary = boundaries[i];
    
    if (boundary.isCurved) {
      // Draw curved walls with arc approximation
      ctx.beginPath();
      const segments = Math.max(24, Math.ceil(Math.abs(boundary.endAngle - boundary.startAngle) * 12));
      const angleDiff = boundary.endAngle - boundary.startAngle;
      
      const firstAngle = boundary.startAngle;
      let x = boundary.centerX + boundary.radius * fastCos(firstAngle) + offsetX;
      let y = boundary.centerY + boundary.radius * fastSin(firstAngle) + offsetY;
      ctx.moveTo(x, y);
      
      for (let j = 1; j <= segments; j++) {
        const angle = boundary.startAngle + (j / segments) * angleDiff;
        x = boundary.centerX + boundary.radius * fastCos(angle) + offsetX;
        y = boundary.centerY + boundary.radius * fastSin(angle) + offsetY;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else {
      // Draw straight walls
      ctx.beginPath();
      ctx.moveTo(boundary.a.x + offsetX, boundary.a.y + offsetY);
      ctx.lineTo(boundary.b.x + offsetX, boundary.b.y + offsetY);
      ctx.stroke();
    }
  }

  // Draw user position (centered)
  ctx.fillStyle = 'yellow';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 2 * invScale, 0, Math.PI * 2);
  ctx.fill();

  // Draw user FOV cone
  const userViewDirRad = user.viewDirection * DEG_TO_RAD;
  const userFovHalfRad = (user.camera.fov * 0.5) * DEG_TO_RAD;
  const userFovLength = 200;

  const userGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, userFovLength);
  userGradient.addColorStop(0, 'rgba(255,255,0,0.5)');
  userGradient.addColorStop(1, 'rgba(255,255,0,0)');

  ctx.fillStyle = userGradient;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(
    centerX + userFovLength * Math.cos(userViewDirRad - userFovHalfRad),
    centerY + userFovLength * Math.sin(userViewDirRad - userFovHalfRad)
  );
  ctx.lineTo(
    centerX + userFovLength * Math.cos(userViewDirRad + userFovHalfRad),
    centerY + userFovLength * Math.sin(userViewDirRad + userFovHalfRad)
  );
  ctx.closePath();
  ctx.fill();

  // Draw enemy FOV cones and positions
  const enemyCount = enemies.length;
  for (let i = 0; i < enemyCount; i++) {
    const enemy = enemies[i];
    const enemyViewDirRad = enemy.viewDirection * DEG_TO_RAD;
    const enemyFovHalfRad = (enemy.fov * 0.5) * DEG_TO_RAD;
    const enemyFovLength = enemy.visibilityDistance;
    const enemyCenterX = enemy.pos.x + offsetX;
    const enemyCenterY = enemy.pos.y + offsetY;

    // FOV cone
    ctx.fillStyle = 'rgba(255,0,0,0.2)';
    ctx.beginPath();
    ctx.moveTo(enemyCenterX, enemyCenterY);
    ctx.arc(
      enemyCenterX, 
      enemyCenterY, 
      enemyFovLength, 
      enemyViewDirRad - enemyFovHalfRad, 
      enemyViewDirRad + enemyFovHalfRad
    );
    ctx.closePath();
    ctx.fill();

    // Enemy position dot
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(enemyCenterX, enemyCenterY, 1.5 * invScale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export { resizeCanvas, drawBackground, drawMinimap };
