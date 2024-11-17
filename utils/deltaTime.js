let lastTime = performance.now();
const frameTimes = []; // Array to store frame times
const maxFrames = 100; // Number of frames to average over

/**
 * Calculates the delta time between frames, normalized to match a target FPS.
 * Uses a running average of FPS to reduce fluctuations caused by frame rate variability.
 *
 * @param {number} [targetFPS=60] - The desired frame rate to normalize against. Default is 60 FPS.
 *
 * @returns {number} - The normalized delta time in seconds, adjusted to simulate
 *                     the game running at the specified target FPS.
 *
 * @example
 * function draw() {
 *   const deltaTime = getDeltaTime(120); // Normalize delta time to 120 FPS
 *
 *   object.x += object.velX * deltaTime;
 *   object.y += object.velY * deltaTime;
 *
 *   requestAnimationFrame(draw);
 * }
 * draw();
 */
function getDeltaTime(targetFPS = 60) {
  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) / 1000; // Elapsed time in seconds

  // Add the current frame time to the history
  frameTimes.push(1 / deltaTime); // FPS for the current frame
  if (frameTimes.length > maxFrames) {
    frameTimes.shift(); // Remove the oldest frame time if exceeding max history
  }

  // Calculate the average FPS
  const avgFPS =
    frameTimes.reduce((sum, fps) => sum + fps, 0) / frameTimes.length;

  // Normalize deltaTime to the target FPS
  const targetDelta = 1 / targetFPS;
  const normalizedDeltaTime = (1 / avgFPS) / targetDelta;

  lastTime = currentTime; // Update lastTime for the next frame
  return normalizedDeltaTime;
}

export { getDeltaTime };
