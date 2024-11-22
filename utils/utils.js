import Boundaries from "../classes/BoundariesClass.js";
import Player from "../classes/UserClass.js";

/**
 * Resizes all canvas elements in the canvasArray to maintain the specified aspect ratio.
 * @param {Object} options - The options for resizing the canvas.
 * @param {HTMLCanvasElement[]} options.canvasArray - An array of canvas elements to resize.
 * @param {number} [options.ratio] - The target aspect ratio for the canvas elements. Defaults to fullscreen if not specified.
 */
function resizeCanvas({ canvasArray, ratio }) {
  // Get the target aspect ratio or default to fullscreen
  const targetRatio = ratio || window.innerWidth / window.innerHeight;
  const windowRatio = window.innerWidth / window.innerHeight;
  
  // Determine the width and height of the canvas
  let width, height;
  if (windowRatio > targetRatio) {
    // Fit to height
    height = window.innerHeight;
    width = height * targetRatio;
  } else {
    // Fit to width
    width = window.innerWidth;
    height = width / targetRatio;
  }

  // Resize each canvas element
  canvasArray.forEach(canvas => {
    canvas.width = width;
    canvas.height = height;
  });
}

function drawBackground(background_ctx, height, width) {
  const topStartLuminosity = 55; // Adjust luminosity for the light grayish blue
  const topEndLuminosity = 20;  // Adjust luminosity for the dark grayish blue

  const bottomStartLuminosity = 40; // Adjust luminosity for the light gray
  const bottomEndLuminosity = 10;  // Adjust luminosity for the dark gray

  background_ctx.clearRect(0, 0, width, height);

  // Top gradient: Light grayish blue to dark grayish blue
  const topGradient = background_ctx.createLinearGradient(
    0, 0, // Start point (x0, y0)
    0, height / 2 // End point (x1, y1 - middle of canvas)
  );
  topGradient.addColorStop(0, `hsl(210, 20%, ${topStartLuminosity}%)`); // Light grayish blue
  topGradient.addColorStop(1, `hsl(210, 20%, ${topEndLuminosity}%)`);   // Dark grayish blue

  // Fill the top half
  background_ctx.fillStyle = topGradient;
  background_ctx.fillRect(0, 0, width, height / 2);

  // Bottom gradient: Light gray to dark gray
  const bottomGradient = background_ctx.createLinearGradient(
    0, height, // Start point (x0, y0 - bottom of canvas)
    0, height / 2 // End point (x1, y1 - middle of canvas)
  );
  bottomGradient.addColorStop(0, `hsl(0, 0%, ${bottomStartLuminosity}%)`); // Light gray
  bottomGradient.addColorStop(1, `hsl(0, 0%, ${bottomEndLuminosity}%)`);   // Dark gray

  // Fill the bottom half
  background_ctx.fillStyle = bottomGradient;
  background_ctx.fillRect(0, height / 2, width, height / 2);
}


/**
 * Draws a circular minimap on the main canvas, with a fixed player position and moving map.
 *
 * @param {CanvasRenderingContext2D} ctx - The rendering context for the main canvas.
 * @param {Array<Boundaries>} boundaries - Array of boundary objects to draw on the minimap.
 * @param {Player} user - The user object representing the camera's position and FOV.
 * @param {EnemyClass[]} enemies - Array of enemy objects to draw on the minimap.
 */
function drawMinimap(ctx, boundaries, user, enemies) {
  const centerX = miniMapSettings.x / miniMapSettings.scale;
  const centerY = miniMapSettings.y / miniMapSettings.scale;

  ctx.save();
  ctx.scale(miniMapSettings.scale, miniMapSettings.scale);

  // Create circular clipping path at fixed position
  ctx.beginPath();
  ctx.arc(centerX, centerY, miniMapSettings.radius, 0, Math.PI * 2);
  ctx.clip();

  // Draw circular border
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2 / miniMapSettings.scale;
  ctx.stroke();

  // Calculate the offset to keep player centered
  const offsetX = centerX - user.pos.x;
  const offsetY = centerY - user.pos.y;

  // Draw boundaries on minimap with offset
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1 / miniMapSettings.scale;
  for (let boundary of boundaries) {
    ctx.beginPath();
    ctx.moveTo(boundary.a.x + offsetX, boundary.a.y + offsetY);
    ctx.lineTo(boundary.b.x + offsetX, boundary.b.y + offsetY);
    ctx.stroke();
  }

  // Draw user position (fixed at center)
  ctx.fillStyle = 'yellow';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 2 / miniMapSettings.scale, 0, Math.PI * 2);
  ctx.fill();

  // Draw user FOV (cone) on minimap
  const userViewDirectionRad = (user.viewDirection * Math.PI) / 180;
  const userFovHalfRad = (user.camera.fov / 2) * Math.PI / 180;
  const userFovLength = 200;

  const userFovStart = {
    x: centerX + userFovLength * Math.cos(userViewDirectionRad - userFovHalfRad),
    y: centerY + userFovLength * Math.sin(userViewDirectionRad - userFovHalfRad),
  };
  const userFovEnd = {
    x: centerX + userFovLength * Math.cos(userViewDirectionRad + userFovHalfRad),
    y: centerY + userFovLength * Math.sin(userViewDirectionRad + userFovHalfRad),
  };

  const userGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, userFovLength);
  userGradient.addColorStop(0, 'rgba(255, 255, 0, 0.5)');
  userGradient.addColorStop(1, 'rgba(255, 255, 0, 0)');

  ctx.fillStyle = userGradient;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(userFovStart.x, userFovStart.y);
  ctx.lineTo(userFovEnd.x, userFovEnd.y);
  ctx.closePath();
  ctx.fill();

  // Draw enemy FOV (cone) on minimap
  enemies.forEach(enemy => {
    const enemyViewDirectionRad = (enemy.viewDirection * Math.PI) / 180;
    const enemyFovHalfRad = (enemy.fov / 2) * Math.PI / 180;
    const enemyFovLength = enemy.visibilityDistance;

    const enemyFovStart = {
      x: enemy.pos.x + offsetX + enemyFovLength * Math.cos(enemyViewDirectionRad - enemyFovHalfRad),
      y: enemy.pos.y + offsetY + enemyFovLength * Math.sin(enemyViewDirectionRad - enemyFovHalfRad),
    };
    const enemyFovEnd = {
      x: enemy.pos.x + offsetX + enemyFovLength * Math.cos(enemyViewDirectionRad + enemyFovHalfRad),
      y: enemy.pos.y + offsetY + enemyFovLength * Math.sin(enemyViewDirectionRad + enemyFovHalfRad),
    };

    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.moveTo(enemy.pos.x + offsetX, enemy.pos.y + offsetY);
    ctx.lineTo(enemyFovStart.x, enemyFovStart.y);
    ctx.lineTo(enemyFovEnd.x, enemyFovEnd.y);
    ctx.closePath();
    ctx.fill();

    // Draw enemy position on minimap
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(
      enemy.pos.x + offsetX, // Adjust enemy position based on offset
      enemy.pos.y + offsetY,
      1 / miniMapSettings.scale, // Size of the enemy marker
      0,
      Math.PI * 2
    );
    ctx.fill();
  });

  ctx.restore();
}


export { resizeCanvas, drawBackground, drawMinimap };