import Boundaries from "../classes/BoundariesClass.js";
import UserCameraClass from "../classes/UserCameraClass.js";

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
 * Draws the minimap on the main canvas, including user FOV and direction.
 * 
 * @param {CanvasRenderingContext2D} ctx - The rendering context for the main canvas.
 * @param {Array<Boundaries>} boundaries - Array of boundary objects to draw on the minimap.
 * @param {UserCameraClass} user - The user object representing the camera's position and FOV.
 * @param {number} minimapscale - The scale factor for the minimap.
 * @param {number} minimapX - The x-coordinate for the minimap's bottom-left corner.
 * @param {number} minimapY - The y-coordinate for the minimap's bottom-left corner.
 */
function drawMinimap(ctx, boundaries, user) {
  ctx.save();
  ctx.scale(miniMapSettings.scale, miniMapSettings.scale);
  ctx.translate(miniMapSettings.x / miniMapSettings.scale, miniMapSettings.y / miniMapSettings.scale);

  // Draw boundaries on minimap
  for (let boundary of boundaries) {
    ctx.beginPath();
    ctx.moveTo(boundary.a.x, boundary.a.y);
    ctx.lineTo(boundary.b.x, boundary.b.y);
    ctx.strokeStyle = 'white';
    ctx.stroke();
  }

  // Draw user position on minimap
  ctx.fillStyle = 'yellow';
  ctx.beginPath();
  ctx.arc(user.pos.x, user.pos.y, 1 / miniMapSettings.scale, 0, Math.PI * 2);
  ctx.fill();

  // Draw user FOV (cone) on minimap
  const viewDirectionRad = user.viewDirection * Math.PI / 180;
  const fovHalfRad = (user.fov / 2) * Math.PI / 180;
  const fovLength = 50; // Length of FOV cone

  const fovStart = {
    x: user.pos.x + fovLength * Math.cos(viewDirectionRad - fovHalfRad),
    y: user.pos.y + fovLength * Math.sin(viewDirectionRad - fovHalfRad)
  };
  const fovEnd = {
    x: user.pos.x + fovLength * Math.cos(viewDirectionRad + fovHalfRad),
    y: user.pos.y + fovLength * Math.sin(viewDirectionRad + fovHalfRad)
  };

  ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
  ctx.beginPath();
  ctx.moveTo(user.pos.x, user.pos.y);
  ctx.lineTo(fovStart.x, fovStart.y);
  ctx.lineTo(fovEnd.x, fovEnd.y);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export { resizeCanvas, drawBackground, drawMinimap };