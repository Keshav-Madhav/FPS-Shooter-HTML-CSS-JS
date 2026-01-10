let lastTime = performance.now();

/**
 * Calculates the delta time between frames for frame-rate independent movement.
 * Returns the raw delta multiplier without averaging for immediate response.
 *
 * @param {number} [targetFPS=60] - The target FPS to normalize against.
 *
 * @returns {number} - Delta multiplier. At targetFPS, returns 1.0.
 *                     At 2x targetFPS, returns 0.5. At half targetFPS, returns 2.0.
 *
 * @example
 * function draw() {
 *   const deltaTime = getDeltaTime(60);
 *   object.x += object.velX * deltaTime; // Movement is consistent regardless of FPS
 *   requestAnimationFrame(draw);
 * }
 */
function getDeltaTime(targetFPS = 60) {
  const currentTime = performance.now();
  const elapsed = currentTime - lastTime;
  lastTime = currentTime;

  // Target frame time in ms
  const targetFrameTime = 1000 / targetFPS;
  
  // Return multiplier: elapsed / target
  // At target FPS: returns 1.0
  // Running faster: returns < 1.0 (smaller movements per frame)
  // Running slower: returns > 1.0 (larger movements per frame)
  return elapsed / targetFrameTime;
}

export { getDeltaTime };
