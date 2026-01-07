// Optimized Ray class for raycasting
class RayClass {
  /**
   * Creates a ray for intersection testing
   * @param {number} x - Starting x position
   * @param {number} y - Starting y position  
   * @param {number} angle - Angle in radians
   */
  constructor(x, y, angle) {
    this.pos = { x: x, y: y };
    this.dir = { x: Math.cos(angle), y: Math.sin(angle) };
  }

  /**
   * Updates the ray angle
   * @param {number} angle - New angle in radians
   */
  setAngle(angle) {
    this.dir.x = Math.cos(angle);
    this.dir.y = Math.sin(angle);
  }

  /**
   * Casts ray against a boundary and returns intersection info
   * Uses optimized line-line intersection algorithm
   * @param {Boundaries} bound - The boundary to test against
   * @returns {{point: {x: number, y: number}, boundary: Boundaries}|undefined}
   */
  cast(bound) {
    // Wall segment
    const x1 = bound.a.x;
    const y1 = bound.a.y;
    const x2 = bound.b.x;
    const y2 = bound.b.y;

    // Ray origin and direction
    const x3 = this.pos.x;
    const y3 = this.pos.y;
    const x4 = this.pos.x + this.dir.x;
    const y4 = this.pos.y + this.dir.y;

    // Calculate denominator once
    const dx1 = x1 - x2;
    const dy1 = y1 - y2;
    const dx2 = x3 - x4;
    const dy2 = y3 - y4;
    
    const denominator = dx1 * dy2 - dy1 * dx2;
    
    // Parallel lines - no intersection
    if (denominator === 0) return undefined;
    
    // Calculate intersection parameters
    const dx3 = x1 - x3;
    const dy3 = y1 - y3;
    
    const t = (dx3 * dy2 - dy3 * dx2) / denominator;
    const u = -(dx1 * dy3 - dy1 * dx3) / denominator;

    // Check if intersection is valid
    // t must be in [0,1] (on the wall segment)
    // u must be positive (in front of the ray)
    if (t > 0 && t < 1 && u > 0) {
      return {
        point: {
          x: x1 + t * (x2 - x1),
          y: y1 + t * (y2 - y1)
        },
        boundary: bound
      };
    }
    
    return undefined;
  }
}

export default RayClass;