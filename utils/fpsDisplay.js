let fps = 60;
let lastFrameTime = Date.now();
let frameTimes = [];
let currentFps = 0;
let avgFps = 0;
let onePercentLowFps = 0;

/**
 * @typedef {Object} FPSMetrics
 * @property {number} currentFps - The current FPS calculated from the time difference between the current and previous frame.
 * @property {number} avgFps - The average FPS over the last second, calculated from the frame times stored for the last second.
 * @property {number} onePercentLowFps - The 1% low FPS, representing the average FPS of the slowest 1% of frames over the last second.
 */

/**
 * Calculates and draws the current FPS, average FPS, and 1% low FPS on a canvas.
 * The FPS metrics are calculated over the last second of frames.
 * 
 * @param {number} width - The width of the canvas element. Used to determine the position of the FPS display.
 * @param {number} height - The height of the canvas element. Used to determine the position of the FPS display.
 * @param {CanvasRenderingContext2D} context - The 2D rendering context of the canvas where the FPS metrics will be drawn.
 * 
 * @returns {FPSMetrics} An object containing the current FPS, average FPS, and 1% low FPS.
 *  - currentFps: The current FPS calculated from the time difference between the current and previous frame.
 *  - avgFps: The average FPS over the last second, calculated from the frame times stored for the last second.
 *  - onePercentLowFps: The 1% low FPS, representing the average FPS of the slowest 1% of frames over the last second.
 * 
 * @example
 * // Example usage:
 * const canvas = document.createElement('canvas');
 * document.body.appendChild(canvas);
 * const context = canvas.getContext('2d');
 * 
 * function gameLoop() {
 *   const { currentFps, avgFps, onePercentLowFps } = drawFPS(canvas.width, canvas.height, context);
 *
 *   requestAnimationFrame(gameLoop);
 * }
 * gameLoop();
 */
const drawFPS = (width, height, context) => {
  let now = Date.now();
  let frameTime = now - lastFrameTime;
  lastFrameTime = now;

  // Update current FPS
  currentFps = Math.round(1000 / frameTime);

  // Store frame time for average and 1% low calculations
  frameTimes.push(frameTime);
  if (frameTimes.length > fps) {
    frameTimes.shift(); // Keep only the last second's worth of frames
  }

  // Calculate average FPS over the last second
  const totalFrameTime = frameTimes.reduce((a, b) => a + b, 0);
  avgFps = Math.round(1000 / (totalFrameTime / frameTimes.length));

  // Calculate 1% low FPS
  const sortedFrameTimes = [...frameTimes].sort((a, b) => b - a);
  const onePercentLowIndex = Math.ceil(sortedFrameTimes.length * 0.01);
  const onePercentLowTime = sortedFrameTimes.slice(0, onePercentLowIndex).reduce((a, b) => a + b, 0) / onePercentLowIndex;
  onePercentLowFps = Math.round(1000 / onePercentLowTime);

  // Draw FPS metrics on canvasr
  context.fillStyle = 'rgba(255, 255, 255, 0.5)';
  context.fillRect(width - 80, 10, 80, 40);
  context.fillStyle = 'black';
  context.font = '11px sans-serif';
  context.fillText(`FPS: ${currentFps}`, width - 75, 22);
  context.fillText(`Avg FPS: ${avgFps}`, width - 75, 34);
  context.fillText(`1% Low: ${onePercentLowFps}`, width - 75, 46);

  return { currentFps, avgFps, onePercentLowFps };
}

export { drawFPS };