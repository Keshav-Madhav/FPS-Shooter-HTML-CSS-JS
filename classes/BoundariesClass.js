/**
 * Represents a boundary (wall) in the game.
 */
class Boundaries {
  /**
   * Creates a new boundary.
   * 
   * @param {number} x1 - The x-coordinate of the first point.
   * @param {number} y1 - The y-coordinate of the first point.
   * @param {number} x2 - The x-coordinate of the second point.
   * @param {number} y2 - The y-coordinate of the second point.
   * @param {HTMLImageElement} texture - The texture of the boundary.
   * @param {Object} [options] - Optional parameters for the boundary.
   * @param {number} [options.rotateAngle=0] - The initial rotation angle in radians.
   * @param {number} [options.rotateSpeed=0] - The speed of rotation in radians per frame.
   * @param {Object} [options.origin=null] - The origin point for rotation.
   * @param {number} [options.origin.x] - The x-coordinate of the rotation origin.
   * @param {number} [options.origin.y] - The y-coordinate of the rotation origin.
   */
  constructor(x1, y1, x2, y2, texture, options = {}) {
    this.a = { x: x1, y: y1 }; // Point A of the boundary
    this.b = { x: x2, y: y2 }; // Point B of the boundary
    this.texture = texture; // Boundary texture

    // Optional rotation parameters
    this.rotateAngle = options.rotateAngle || 0; // Initial rotation angle
    this.rotateSpeed = options.rotateSpeed || 0; // Rotation speed (radians per frame)
    this.origin = options.origin || null; // Rotation origin (optional)
  }

  /**
   * Rotates the boundary around a given angle and origin.
   * 
   * @param {number} angle - The angle to rotate the boundary by, in radians.
   * @param {Object|null} [origin=null] - The origin point for the rotation. 
   * If not provided, defaults to the wall's center or the specified origin in `options`.
   * @param {number} origin.x - The x-coordinate of the rotation origin.
   * @param {number} origin.y - The y-coordinate of the rotation origin.
   */
  rotateBoundary(angle, origin = null) {
    let originX, originY;

    // Determine rotation origin
    if (origin) {
      originX = origin.x;
      originY = origin.y;
    } else if (this.origin) {
      // Use the predefined rotation origin if available
      originX = this.origin.x;
      originY = this.origin.y;
    } else {
      originX = (this.a.x + this.b.x) / 2;
      originY = (this.a.y + this.b.y) / 2;
    }

    const rotatePoint = (point, angle, origin) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const dx = point.x - origin.x;
      const dy = point.y - origin.y;

      return {
        x: origin.x + dx * cos - dy * sin,
        y: origin.y + dx * sin + dy * cos,
      };
    };

    this.a = rotatePoint(this.a, angle, { x: originX, y: originY });
    this.b = rotatePoint(this.b, angle, { x: originX, y: originY });
  }

  /**
   * Updates the rotation of the boundary if a rotateSpeed is provided.
   * Call this method in your game loop for continuous rotation.
   */
  update() {
    if (this.rotateSpeed !== 0) {
      this.rotateAngle += this.rotateSpeed; // Increment the rotation angle
      this.rotateBoundary(this.rotateSpeed); // Rotate based on speed
    }
  }
}

export default Boundaries;
