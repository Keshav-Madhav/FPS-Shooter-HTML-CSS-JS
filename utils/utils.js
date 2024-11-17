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

export { resizeCanvas, drawBackground };