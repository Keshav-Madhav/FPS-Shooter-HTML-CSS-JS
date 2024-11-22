/**
 * Represents a boundary (wall) in the game.
 */
class Boundaries {
  /**
   * Creates a new boundary.
   * 
   * @param {Object} setUp - The configuration object.
   * @param {number} setUp.x1 - The x-coordinate of point A.
   * @param {number} setUp.y1 - The y-coordinate of point A.
   * @param {number} setUp.x2 - The x-coordinate of point B.
   * @param {number} setUp.y2 - The y-coordinate of point B.
   * @param {HTMLImageElement} setUp.texture - The texture image of the boundary.
   * @param {Object} [setUp.options] - Additional options.
   * @param {string} [setUp.options.uniqueID] - A unique identifier for the boundary.
   */
  constructor({ x1, y1, x2, y2, texture , options = {} }) {
    this.a = { x: x1, y: y1 }; // Point A of the boundary
    this.b = { x: x2, y: y2 }; // Point B of the boundary
    this.originalA = { x: x1, y: y1 }; // Original point A for rotation
    this.originalB = { x: x2, y: y2 }; // Original point B for rotation
    this.angle = 0; // Rotation angle
    this.texture = texture; // Boundary texture
    this.uniqueID = options.uniqueID || null; // Unique identifier
  }

  /**
   * Updates the position of the boundary by putting center at (x, y).
  */ 
  updatePosition(x, y) {
    // Calculate the center of the boundary
    const centerX = (this.a.x + this.b.x) / 2;
    const centerY = (this.a.y + this.b.y) / 2;

    // Calculate the offset to move the center to (x, y)
    const dx = x - centerX;
    const dy = y - centerY;

    // Update the positions of points A and B
    this.a.x += dx;
    this.a.y += dy;
    this.b.x += dx;
    this.b.y += dy;

    // Update the original positions
    this.originalA.x += dx;
    this.originalA.y += dy;
    this.originalB.x += dx;
    this.originalB.y += dy;
  }

  /**
   * Rotates the boundary around its center by a specified angle.
   * 
   * @param {number} angle - The angle of rotation in degrees.
   */
  rotateBoundary(angle) {
    // Convert angle to radians
    const angleRad = angle * (Math.PI / 180);

    // Calculate the center point
    const centerX = (this.originalA.x + this.originalB.x) / 2;
    const centerY = (this.originalA.y + this.originalB.y) / 2;

    // Rotation matrices to rotate points around the center
    const rotatePoint = (x, y) => {
      const dx = x - centerX;
      const dy = y - centerY;
      
      return {
        x: centerX + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
        y: centerY + dx * Math.sin(angleRad) + dy * Math.cos(angleRad)
      };
    };

    // Rotate both points using the rotation matrix
    const rotatedA = rotatePoint(this.originalA.x, this.originalA.y);
    const rotatedB = rotatePoint(this.originalB.x, this.originalB.y);

    // Update current points
    this.a.x = rotatedA.x;
    this.a.y = rotatedA.y;
    this.b.x = rotatedB.x;
    this.b.y = rotatedB.y;

    // Store the current rotation angle
    this.angle = angle;
  }
}

export default Boundaries;