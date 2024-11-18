import RayClass from "./RayClass.js";
import Boundaries from "./BoundariesClass.js";

/**
 * @typedef {Object} RayIntersection
 * @property {number} distance - The perpendicular distance from the camera to the closest boundary.
 * @property {number} textureX - The normalized x-coordinate on the boundary's texture (0 to 1).
 * @property {HTMLImageElement|null} texture - The texture image of the intersected boundary, or `null` if no boundary is hit.
 * @property {Boundaries|null} boundary - The intersected boundary object, or `null` if no intersection occurs.
 */


/**
 * Class to create a user-controllable camera/light source
 * that emits rays to simulate a field of view and detect intersections.
 */

class CameraClass{
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
    this.rays = this.createRays();
  }

  /**
   * Creates the initial array of rays based on FOV and ray count
   * @private
   */
  createRays() {
    const rays = [];
    for (
      let angle = this.viewDirection - this.fov / 2;
      angle < this.viewDirection + this.fov / 2;
      angle += this.fov / this.rayCount
    ) {
      rays.push(
        new RayClass(this.pos.x, this.pos.y, (angle * Math.PI) / 180)
      );
    }
    return rays;
  }

  /**
   * Updates camera position and view direction
   * @param {Object} pos - New position {x, y}
   * @param {number} viewDirection - New view direction in degrees
   */
  update(pos, viewDirection) {
    this.pos = pos;
    this.viewDirection = viewDirection;
    this.rays = [];
    
    for (
      let angle = viewDirection - this.fov / 2;
      angle < viewDirection + this.fov / 2;
      angle += this.fov / this.rayCount
    ) {
      this.rays.push(
        new RayClass(this.pos.x, this.pos.y, (angle * Math.PI) / 180)
      );
    }
  }

  /**
   * Casts rays and detects intersections with boundaries
   * @param {Array<Boundaries>} boundaries - Array of boundary objects
   * @returns {Array<RayIntersection>} Scene intersection data
   */
  spread(boundaries) {
    const scene = [];
    for (let i = 0; i < this.rays.length; i++) {
      const ray = this.rays[i];
      let closest = null;
      let record = Infinity;
      let textureX = 0;
      let texture = null;
      let hitBoundary = null;

      for (let boundary of boundaries) {
        const result = ray.cast(boundary);
        if (result) {
          const { point, boundary: hitBound } = result;
          let distance = Math.hypot(
            this.pos.x - point.x,
            this.pos.y - point.y
          );
          const angle = Math.atan2(ray.dir.y, ray.dir.x) - (this.viewDirection * Math.PI) / 180; 
          distance *= Math.cos(angle); // Correct for fisheye distortion

          if (distance < record) {
            record = distance;
            closest = point;
            texture = hitBound.texture;
            hitBoundary = hitBound;

            // Calculate texture coordinate
            if (
              Math.abs(hitBound.b.x - hitBound.a.x) >
              Math.abs(hitBound.b.y - hitBound.a.y)
            ) {
              textureX = (point.x - hitBound.a.x) / (hitBound.b.x - hitBound.a.x);
            } else {
              textureX = (point.y - hitBound.a.y) / (hitBound.b.y - hitBound.a.y);
            }

            textureX = textureX % 1;
            if (textureX < 0) textureX += 1;
          }
        }
      }

      scene[i] = {
        distance: record,
        textureX: textureX,
        texture: texture,
        boundary: hitBoundary,
      };
    }
    return scene;
  }
}

export default CameraClass;