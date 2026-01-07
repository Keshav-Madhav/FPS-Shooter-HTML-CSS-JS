/**
 * Represents a curved wall boundary (arc) in the game.
 */
class CurvedWall {
  /**
   * Creates a new curved wall.
   * 
   * @param {Object} config - The configuration object.
   * @param {number} config.centerX - The x-coordinate of the circle's center.
   * @param {number} config.centerY - The y-coordinate of the circle's center.
   * @param {number} config.radius - The radius of the circular arc.
   * @param {number} config.startAngle - The starting angle in radians.
   * @param {number} config.endAngle - The ending angle in radians.
   * @param {HTMLImageElement} config.texture - The texture image of the boundary.
   * @param {Object} [config.options] - Additional options.
   * @param {string} [config.options.uniqueID] - A unique identifier for the curved wall.
   * @param {boolean} [config.options.isTransparent] - Whether this boundary has transparent texture.
   */
  constructor({ centerX, centerY, radius, startAngle, endAngle, texture, options = {} }) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius = radius;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
    this.texture = texture;
    this.uniqueID = options.uniqueID || null;
    this.isTransparent = options.isTransparent || false;
    this.isCurved = true; // Flag to identify curved walls
    
    // Pre-calculate arc length for texture mapping
    this._updateArcLength();
  }

  /**
   * Updates the cached arc length
   * @private
   */
  _updateArcLength() {
    let angleDiff = this.endAngle - this.startAngle;
    // Normalize angle to positive value
    if (angleDiff < 0) angleDiff += Math.PI * 2;
    this.arcLength = this.radius * angleDiff;
  }

  /**
   * Finds the intersection point of a ray with this curved wall.
   * Uses quadratic formula to solve ray-circle intersection.
   * 
   * @param {RayClass} ray - The ray to test
   * @returns {{point: {x: number, y: number}, distance: number, angle: number}|undefined}
   */
  rayIntersection(ray) {
    const rayX = ray.pos.x;
    const rayY = ray.pos.y;
    const dirX = ray.dir.x;
    const dirY = ray.dir.y;
    
    // Translate ray origin relative to circle center
    const fx = rayX - this.centerX;
    const fy = rayY - this.centerY;
    
    // Coefficients for quadratic equation: (dir · dir)t² + 2(f · dir)t + (f · f - r²) = 0
    const a = dirX * dirX + dirY * dirY;
    const b = 2 * (fx * dirX + fy * dirY);
    const c = (fx * fx + fy * fy) - (this.radius * this.radius);
    
    // Calculate discriminant
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) return undefined; // No intersection
    
    // Find the two intersection parameters
    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);
    
    // Check both intersection points to see which one(s) are in the arc
    const candidates = [];
    
    if (t1 > 0.001) { // 0.001 to avoid self-intersection
      const intX1 = rayX + dirX * t1;
      const intY1 = rayY + dirY * t1;
      const angle1 = Math.atan2(intY1 - this.centerY, intX1 - this.centerX);
      
      if (this._isAngleInArc(angle1)) {
        candidates.push({
          point: { x: intX1, y: intY1 },
          distance: t1,
          angle: angle1
        });
      }
    }
    
    if (t2 > 0.001 && Math.abs(t2 - t1) > 0.001) { // Different from t1
      const intX2 = rayX + dirX * t2;
      const intY2 = rayY + dirY * t2;
      const angle2 = Math.atan2(intY2 - this.centerY, intX2 - this.centerX);
      
      if (this._isAngleInArc(angle2)) {
        candidates.push({
          point: { x: intX2, y: intY2 },
          distance: t2,
          angle: angle2
        });
      }
    }
    
    // Return the closest valid intersection
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0];
    return candidates[0].distance < candidates[1].distance ? candidates[0] : candidates[1];
  }

  /**
   * Checks if an angle is within the arc's angular range
   * @private
   */
  _isAngleInArc(angle) {
    // Normalize all angles to [0, 2π)
    let normalizedAngle = angle;
    while (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
    while (normalizedAngle >= Math.PI * 2) normalizedAngle -= Math.PI * 2;
    
    let start = this.startAngle;
    while (start < 0) start += Math.PI * 2;
    while (start >= Math.PI * 2) start -= Math.PI * 2;
    
    let end = this.endAngle;
    while (end < 0) end += Math.PI * 2;
    while (end >= Math.PI * 2) end -= Math.PI * 2;
    
    // Calculate the arc range, handling wraparound
    let arcRange = end - start;
    if (arcRange < 0) arcRange += Math.PI * 2; // Arc wraps around 0
    
    // Calculate how far the test angle is from start
    let angleDist = normalizedAngle - start;
    if (angleDist < 0) angleDist += Math.PI * 2;
    
    // Check if angle is within the arc
    return angleDist <= arcRange + 0.001; // Small tolerance for floating point
  }

  /**
   * Calculates texture X coordinate based on intersection angle
   * @param {number} angle - The angle at intersection point
   * @returns {number} Normalized texture coordinate (0 to 1)
   */
  getTextureX(angle) {
    // Normalize angles to [0, 2π)
    let normalizedAngle = angle;
    while (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
    while (normalizedAngle >= Math.PI * 2) normalizedAngle -= Math.PI * 2;
    
    let start = this.startAngle;
    while (start < 0) start += Math.PI * 2;
    while (start >= Math.PI * 2) start -= Math.PI * 2;
    
    let end = this.endAngle;
    while (end < 0) end += Math.PI * 2;
    while (end >= Math.PI * 2) end -= Math.PI * 2;
    
    // Calculate the arc range
    let arcRange = end - start;
    if (arcRange < 0) arcRange += Math.PI * 2; // Arc wraps around 0
    
    // Calculate how far along the arc we are from start
    let angleDist = normalizedAngle - start;
    if (angleDist < 0) angleDist += Math.PI * 2;
    
    // Handle the wraparound case: if arc doesn't wrap but our calculation does, adjust
    if (arcRange < Math.PI && angleDist > Math.PI) {
      angleDist -= Math.PI * 2;
    }
    
    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, angleDist / arcRange));
  }
}

export default CurvedWall;
