let lastFrameTime = performance.now();
let frameTimes = [];
let currentFps = 0;
let avgFps = 0;
let onePercentLowFps = 0;

// How long to keep frame times (in ms)
const SAMPLE_WINDOW_MS = 1000;

/**
 * @typedef {Object} FPSMetrics
 * @property {number} currentFps - The real-time instant FPS.
 * @property {number} avgFps - The average FPS over the last second.
 * @property {number} onePercentLowFps - The 1% low FPS.
 */

/**
 * Calculates and draws the current FPS, average FPS, and 1% low FPS on a canvas.
 * Uses high-precision timing for accurate readings.
 * 
 * @param {number} width - The width of the canvas element.
 * @param {number} height - The height of the canvas element.
 * @param {CanvasRenderingContext2D} context - The 2D rendering context.
 * 
 * @returns {FPSMetrics} An object containing FPS metrics.
 */
const drawFPS = (width, height, context) => {
  const now = performance.now();
  const frameTime = now - lastFrameTime;
  lastFrameTime = now;

  // Avoid division by zero on first frame
  if (frameTime <= 0) return { currentFps, avgFps, onePercentLowFps };

  // Calculate real-time instant FPS (no smoothing)
  currentFps = Math.round(1000 / frameTime);

  // Store frame time with timestamp for time-based window
  frameTimes.push({ time: now, frameTime });

  // Remove frames older than SAMPLE_WINDOW_MS
  const cutoff = now - SAMPLE_WINDOW_MS;
  while (frameTimes.length > 0 && frameTimes[0].time < cutoff) {
    frameTimes.shift();
  }

  // Calculate average FPS over the sample window
  if (frameTimes.length > 0) {
    const totalFrameTime = frameTimes.reduce((sum, f) => sum + f.frameTime, 0);
    avgFps = Math.round(1000 / (totalFrameTime / frameTimes.length));

    // Calculate 1% low FPS (slowest 1% of frames)
    if (frameTimes.length >= 10) {
      const sortedTimes = frameTimes.map(f => f.frameTime).sort((a, b) => b - a);
      const onePercentCount = Math.max(1, Math.ceil(sortedTimes.length * 0.01));
      const slowestSum = sortedTimes.slice(0, onePercentCount).reduce((a, b) => a + b, 0);
      onePercentLowFps = Math.round(1000 / (slowestSum / onePercentCount));
    }
  }

  // Draw FPS metrics on canvas
  context.save();
  context.textAlign = 'left';
  context.textBaseline = 'top';
  context.fillStyle = 'rgba(0, 0, 0, 0.7)';
  context.fillRect(width - 90, 10, 85, 50);
  context.fillStyle = '#00ff00';
  context.font = 'bold 12px monospace';
  context.fillText(`FPS: ${currentFps}`, width - 85, 14);
  context.fillStyle = '#ffffff';
  context.font = '11px monospace';
  context.fillText(`Avg: ${avgFps}`, width - 85, 30);
  context.fillText(`1%L: ${onePercentLowFps}`, width - 85, 44);
  context.restore();

  return { currentFps, avgFps, onePercentLowFps };
}

export { drawFPS };
