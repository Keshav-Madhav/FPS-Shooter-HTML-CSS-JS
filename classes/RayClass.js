/**
 * Optimized Ray class for raycasting
 * Uses inlined math for maximum performance
 */
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
   * Handles both straight walls and curved walls
   * Optimized with inlined calculations
   * @param {Boundaries|CurvedWall} bound - The boundary to test against
   * @returns {{point: {x: number, y: number}, boundary: Boundaries|CurvedWall, angle?: number, distance?: number}|undefined}
   */
  cast(bound) {
    // Handle curved walls via their specialized method
    if (bound.isCurved) {
      const intersection = bound.rayIntersection(this);
      if (intersection) {
        return {
          point: intersection.point,
          boundary: bound,
          angle: intersection.angle,
          distance: intersection.distance
        };
      }
      return undefined;
    }
    
    // Inlined straight wall intersection (Line-Segment Intersection)
    // Wall endpoints
    const x1 = bound.a.x;
    const y1 = bound.a.y;
    const x2 = bound.b.x;
    const y2 = bound.b.y;

    // Ray origin and direction
    const x3 = this.pos.x;
    const y3 = this.pos.y;
    const dx = this.dir.x;
    const dy = this.dir.y;

    // Wall direction vector
    const wx = x2 - x1;
    const wy = y2 - y1;
    
    // Calculate denominator: cross product of wall and ray directions
    const denominator = wx * dy - wy * dx;
    
    // Parallel lines - no intersection (use small epsilon for float comparison)
    if (denominator > -0.0001 && denominator < 0.0001) return undefined;
    
    // Vector from wall start to ray origin
    const ox = x3 - x1;
    const oy = y3 - y1;
    
    // Calculate intersection parameters using Cramer's rule
    const invDenom = 1 / denominator;
    const t = (ox * dy - oy * dx) * invDenom;  // Position along wall [0,1]
    const u = (ox * wy - oy * wx) * invDenom;  // Distance along ray (negative = behind)

    // Check if intersection is valid:
    // t must be in (0,1) - on the wall segment (exclusive to avoid edge issues)
    // u must be positive - in front of the ray
    if (t > 0 && t < 1 && u > 0) {
      return {
        point: {
          x: x1 + t * wx,
          y: y1 + t * wy
        },
        boundary: bound,
        distance: u  // Return distance along ray for faster comparisons
      };
    }
    
    return undefined;
  }
  
  /**
   * Quick bounding box rejection test before full intersection
   * @param {Boundaries|CurvedWall} bound - The boundary to test
   * @param {number} maxDist - Maximum distance to consider
   * @returns {boolean} True if worth testing full intersection
   */
  quickReject(bound, maxDist) {
    // For curved walls, check if ray could possibly hit the bounding circle
    if (bound.isCurved) {
      const dx = bound.centerX - this.pos.x;
      const dy = bound.centerY - this.pos.y;
      // Project center onto ray
      const dot = dx * this.dir.x + dy * this.dir.y;
      if (dot < 0) return false; // Center is behind ray
      if (dot > maxDist + bound.radius) return false; // Too far
      // Perpendicular distance to ray
      const perpDistSq = dx * dx + dy * dy - dot * dot;
      const threshold = bound.radius + 10; // Small margin
      return perpDistSq < threshold * threshold;
    }
    
    // For straight walls, check if both endpoints are behind the ray
    const dx1 = bound.a.x - this.pos.x;
    const dy1 = bound.a.y - this.pos.y;
    const dx2 = bound.b.x - this.pos.x;
    const dy2 = bound.b.y - this.pos.y;
    
    const dot1 = dx1 * this.dir.x + dy1 * this.dir.y;
    const dot2 = dx2 * this.dir.x + dy2 * this.dir.y;
    
    // Both points behind the ray
    if (dot1 < 0 && dot2 < 0) return false;
    
    // Both points too far (use max of the two)
    if (dot1 > maxDist && dot2 > maxDist) return false;
    
    return true;
  }
}

export default RayClass;
