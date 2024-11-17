/**
 * @typedef {Object} RayIntersection
 * @property {number} distance - The perpendicular distance from the camera to the closest boundary.
 * @property {number} textureX - The normalized x-coordinate on the boundary's texture (0 to 1).
 * @property {HTMLImageElement|null} texture - The texture image of the intersected boundary, or `null` if no boundary is hit.
 * @property {BoundaryClass|null} boundary - The intersected boundary object, or `null` if no intersection occurs.
 */

/**
 *  Renders the 3D scene by drawing the wall slices with textures and darkness.
 * @param {RayIntersection[]} scene - An array of objects representing the intersection data for each ray.
 */
function render3D(scene) {
  const w = main_canvas.width / scene.length;

  for (let i = 0; i < scene.length; i++) {
    const { distance, textureX, texture } = scene[i];

    if (distance === Infinity) continue; // Skip if no wall was hit

    // Calculate the brightness of the current slice with exponential darkening
    // No minimum brightness - can go completely dark
    const currentBrightness = Math.pow(Math.min(1, brightnessScaleFactor / distance), darknessExponent);

    // Collect brightness values of surrounding slices
    let brightnessSum = currentBrightness;
    let count = 1;

    for (let j = 1; j <= smoothingRadius; j++) {
      if (scene[i - j]) {
        const leftDistance = scene[i - j].distance;
        const leftBrightness = Math.pow(Math.min(1, brightnessScaleFactor / leftDistance), darknessExponent);
        brightnessSum += leftBrightness;
        count++;
      }
      if (scene[i + j]) {
        const rightDistance = scene[i + j].distance;
        const rightBrightness = Math.pow(Math.min(1, brightnessScaleFactor / rightDistance), darknessExponent);
        brightnessSum += rightBrightness;
        count++;
      }
    }

    // Calculate the average brightness
    const averageBrightness = brightnessSum / count;

    const wallHeight = (main_canvas.height / distance) * heightScaleFactor;
    const y = (main_canvas.height - wallHeight) / 2;

    // Draw the wall slice
    if (texture) {
      const textureY = 0;
      const textureWidth = texture.width;
      const textureHeight = texture.height;

      const textureSliceWidth = textureWidth * w / main_canvas.width;
      const textureStartX = textureX * textureWidth;

      // Draw the image section
      main_ctx.drawImage(
        texture,
        textureStartX, textureY,
        textureSliceWidth, textureHeight,
        i * w, y,
        w, wallHeight
      );

      // Apply darkness with no maximum opacity limit
      main_ctx.fillStyle = `rgba(0, 0, 0, ${1 - averageBrightness})`;
      main_ctx.fillRect(i * w, y, w, wallHeight);
    } else {
      // Fallback if texture is not available
      main_ctx.fillStyle = `rgba(255, 255, 255, ${averageBrightness})`;
      main_ctx.fillRect(i * w, y, w, wallHeight);
    }
  }
}

export { render3D };