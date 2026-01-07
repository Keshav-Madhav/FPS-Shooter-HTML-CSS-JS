import RayClass from "./RayClass.js";
import Boundaries from "./BoundariesClass.js";

/**
 * @typedef {Object} RayHit
 * @property {number} distance - The perpendicular distance from the camera to the boundary.
 * @property {number} textureX - The normalized x-coordinate on the boundary's texture (0 to 1).
 * @property {HTMLImageElement|null} texture - The texture image of the intersected boundary.
 * @property {Boundaries|null} boundary - The intersected boundary object.
 * @property {{x: number, y: number}} point - The intersection point.
 */

/**
 * @typedef {Object} RayIntersection
 * @property {number} distance - The perpendicular distance from the camera to the closest boundary.
 * @property {number} textureX - The normalized x-coordinate on the boundary's texture (0 to 1).
 * @property {HTMLImageElement|null} texture - The texture image of the intersected boundary.
 * @property {Boundaries|null} boundary - The intersected boundary object.
 * @property {RayHit[]} [transparentHits] - Array of transparent boundary hits behind this one.
 */


/**
 * Optimized camera class with ray reuse and depth buffer support for transparency.
 */
class CameraClass {
  /**
   * Creates a camera instance with ray casting capabilities
   * @param {Object} options - Camera configuration
   * @param {number} options.x - Initial x position
   * @param {number} options.y - Initial y position
   * @param {number} options.fov - Field of view in degrees
   * @param {number} options.rayCount - Number of rays to cast
   * @param {number} options.viewDirection - Initial view direction in degrees
   */
  constructor({ x, y, fov = 60, rayCount = 1000, viewDirection = 0 }) {
    this.pos = { x, y };
    this.fov = fov;
    this.rayCount = rayCount;
    this.viewDirection = viewDirection;
    
    // Pre-allocate rays array - we'll reuse these instead of recreating
    this.rays = new Array(rayCount);
    for (let i = 0; i < rayCount; i++) {
      this.rays[i] = new RayClass(x, y, 0);
    }
    
    // Pre-calculate angle offsets (relative to view direction)
    this.angleOffsets = new Float32Array(rayCount);
    const angleStep = fov / rayCount;
    const halfFov = fov / 2;
    for (let i = 0; i < rayCount; i++) {
      this.angleOffsets[i] = (-halfFov + i * angleStep) * Math.PI / 180;
    }
    
    // Cache for cos values used in fisheye correction
    this.cosCache = new Float32Array(rayCount);
    for (let i = 0; i < rayCount; i++) {
      this.cosCache[i] = Math.cos(this.angleOffsets[i]);
    }
    
    this._updateRays();
  }

  /**
   * Updates ray positions and angles efficiently
   * @private
   */
  _updateRays() {
    const viewDirRad = this.viewDirection * Math.PI / 180;
    
    for (let i = 0; i < this.rayCount; i++) {
      const ray = this.rays[i];
      const angle = viewDirRad + this.angleOffsets[i];
      
      ray.pos.x = this.pos.x;
      ray.pos.y = this.pos.y;
      ray.dir.x = Math.cos(angle);
      ray.dir.y = Math.sin(angle);
    }
  }

  /**
   * Updates camera position and view direction
   * @param {Object} pos - New position {x, y}
   * @param {number} viewDirection - New view direction in degrees
   */
  update(pos, viewDirection) {
    this.pos = pos;
    this.viewDirection = viewDirection;
    this._updateRays();
  }

  /**
   * Quick check if a boundary could possibly be visible
   * @param {Boundaries} boundary - The boundary to check
   * @returns {boolean} True if the boundary might be visible
   * @private
   */
  _isInViewFrustum(boundary) {
    const viewDirRad = this.viewDirection * Math.PI / 180;
    const halfFovRad = (this.fov / 2 + 10) * Math.PI / 180; // Add some margin
    
    // Check both endpoints of the boundary
    const checkPoint = (px, py) => {
      const dx = px - this.pos.x;
      const dy = py - this.pos.y;
      const angle = Math.atan2(dy, dx);
      let diff = angle - viewDirRad;
      
      // Normalize to -PI to PI
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      
      return Math.abs(diff) < halfFovRad + Math.PI / 4; // Extra margin for wide walls
    };
    
    return checkPoint(boundary.a.x, boundary.a.y) || checkPoint(boundary.b.x, boundary.b.y);
  }

  /**
   * Casts rays and detects intersections with boundaries.
   * Supports transparency by collecting multiple hits per ray.
   * @param {Array<Boundaries>} boundaries - Array of boundary objects
   * @returns {Array<RayIntersection>} Scene intersection data
   */
  spread(boundaries) {
    const scene = new Array(this.rayCount);
    
    // Pre-filter boundaries using frustum culling
    const visibleBoundaries = [];
    const transparentBoundaries = [];
    
    for (const boundary of boundaries) {
      if (this._isInViewFrustum(boundary)) {
        if (boundary.isTransparent) {
          transparentBoundaries.push(boundary);
        } else {
          visibleBoundaries.push(boundary);
        }
      }
    }
    
    // Process each ray
    for (let i = 0; i < this.rayCount; i++) {
      const ray = this.rays[i];
      let closestDist = Infinity;
      let closestHit = null;
      let textureX = 0;
      let texture = null;
      let hitBoundary = null;
      
      // Check opaque boundaries first
      for (const boundary of visibleBoundaries) {
        const result = ray.cast(boundary);
        if (result) {
          const { point, boundary: hitBound } = result;
          let distance = Math.hypot(this.pos.x - point.x, this.pos.y - point.y);
          
          // Apply fisheye correction using cached cos value
          distance *= this.cosCache[i];

          if (distance < closestDist) {
            closestDist = distance;
            closestHit = point;
            texture = hitBound.texture;
            hitBoundary = hitBound;

            // Calculate texture coordinate using wall length
            textureX = this._calculateTextureX(hitBound, point);
          }
        }
      }
      
      // Collect transparent hits that are closer than the closest opaque hit
      const transparentHits = [];
      for (const boundary of transparentBoundaries) {
        const result = ray.cast(boundary);
        if (result) {
          const { point, boundary: hitBound } = result;
          let distance = Math.hypot(this.pos.x - point.x, this.pos.y - point.y);
          distance *= this.cosCache[i];
          
          // Only include if closer than the closest opaque wall (or if no opaque wall)
          if (distance < closestDist) {
            transparentHits.push({
              distance,
              textureX: this._calculateTextureX(hitBound, point),
              texture: hitBound.texture,
              boundary: hitBound,
              point
            });
          }
        }
      }
      
      // Sort transparent hits by distance (closest first)
      transparentHits.sort((a, b) => a.distance - b.distance);

      scene[i] = {
        distance: closestDist,
        textureX: textureX,
        texture: texture,
        boundary: hitBoundary,
        transparentHits: transparentHits
      };
    }
    
    return scene;
  }
  
  /**
   * Calculates the texture X coordinate for a hit point on a boundary
   * @param {Boundaries} boundary - The hit boundary
   * @param {{x: number, y: number}} point - The intersection point
   * @returns {number} The texture X coordinate (0 to 1)
   * @private
   */
  _calculateTextureX(boundary, point) {
    // Calculate distance along the wall from point A
    const dx = point.x - boundary.a.x;
    const dy = point.y - boundary.a.y;
    const distFromA = Math.sqrt(dx * dx + dy * dy);
    
    // Use the wall length to get proper texture mapping
    let textureX = distFromA / boundary.length;
    
    // Clamp and wrap
    textureX = textureX % 1;
    if (textureX < 0) textureX += 1;
    
    return textureX;
  }
}

export default CameraClass;