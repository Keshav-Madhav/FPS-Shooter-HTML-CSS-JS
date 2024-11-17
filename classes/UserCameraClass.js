import RayClass from "./RayClass.js";
import Boundaries from "./BoundariesClass.js";

/**
 * Class to create a user-controllable camera/light source
 * that emits rays to simulate a field of view and detect intersections.
 */
class UserCameraClass {
  /**
   * Creates an instance of UserCameraClass.
   * @param {Object} options - The configuration object.
   * @param {number} options.x - The x-coordinate of the camera's position.
   * @param {number} options.y - The y-coordinate of the camera's position.
   * @param {number} options.fov - The field of view (in degrees).
   * @param {number} options.rayCount - The number of rays emitted by the camera.
   */
  constructor({ x, y, fov, rayCount, viewDirection = 0 }) {
    this.pos = { x: x, y: y }; // Position of the camera.
    this.rayCount = rayCount; // Total number of rays emitted.
    this.rays = []; // Array to store RayClass instances.
    this.heading = 0; // Current heading of the camera.
    this.viewDirection = viewDirection; // Direction the camera is facing (in degrees).
    this.fov = fov; // Field of view (in degrees).
    this.moveSpeed = 1; // Speed of movement for the camera.
    this.moveForwards = false; // Whether the camera is moving forward.
    this.moveBackwards = false; // Whether the camera is moving backward.
    this.moveLeft = false; // Whether the camera is strafing left.
    this.moveRight = false; // Whether the camera is strafing right.

    // Initialize rays based on the field of view and ray count.
    for (let i = viewDirection - fov / 2; i < viewDirection + fov / 2; i += fov / rayCount) {
      this.rays.push(new RayClass(x, y, (i * Math.PI) / 180));
    }
  }

  /**
   * Draws the light source and updates its rays based on the camera's current position.
   * @param {number} deltaTime - Time elapsed since the last frame (in seconds).
   */
  draw(deltaTime) {
    this.updatePos(deltaTime);

    for (let ray of this.rays) {
      ray.pos.x = this.pos.x;
      ray.pos.y = this.pos.y;
    }
  }

  /**
   * @typedef {Object} RayIntersection
   * @property {number} distance - The perpendicular distance from the camera to the closest boundary.
   * @property {number} textureX - The normalized x-coordinate on the boundary's texture (0 to 1).
   * @property {HTMLImageElement|null} texture - The texture image of the intersected boundary, or `null` if no boundary is hit.
   * @property {Boundaries|null} boundary - The intersected boundary object, or `null` if no intersection occurs.
   */

  /**
   * Spreads rays from the light source and detects intersections with boundaries.
   * @param {Array<Boundaries>} boundaries - Array of boundary objects to check for ray intersections.
   * @returns {Array<RayIntersection>} scene - An array of objects representing the intersection data for each ray.
   * 
   * Each object in the scene array contains:
   * - `distance` (number): The perpendicular distance from the camera to the closest boundary.
   * - `textureX` (number): The normalized x-coordinate on the boundary's texture (0 to 1).
   * - `texture` (HTMLImageElement|null): The texture image of the intersected boundary, or `null` if no intersection occurs.
   * - `boundary` (BoundaryClass|null): The intersected boundary object, or `null` if no intersection occurs.
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
          let distance = Math.hypot(this.pos.x - point.x, this.pos.y - point.y);
          const angle = Math.atan2(ray.dir.y, ray.dir.x) - (this.viewDirection * Math.PI) / 180;
          distance *= Math.cos(angle); // Correct for fisheye distortion.
          if (distance < record) {
            record = distance;
            closest = point;
            texture = hitBound.texture;
            hitBoundary = hitBound;

            // Determine the normalized texture coordinate (0 to 1).
            if (Math.abs(hitBound.b.x - hitBound.a.x) > Math.abs(hitBound.b.y - hitBound.a.y)) {
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

  /**
   * Updates the position of the camera based on its movement directions and delta time.
   * @param {number} deltaTime - Time elapsed since the last frame (in seconds).
   */
  updatePos(deltaTime) {
    const moveDirection = Math.atan2(
      Math.sin((this.viewDirection * Math.PI) / 180),
      Math.cos((this.viewDirection * Math.PI) / 180)
    );
    const strafeDirection = moveDirection + Math.PI / 2; // Perpendicular to move direction.

    let dx = 0;
    let dy = 0;

    if (this.moveForwards) {
      dx += this.moveSpeed * Math.cos(moveDirection);
      dy += this.moveSpeed * Math.sin(moveDirection);
    }
    if (this.moveBackwards) {
      dx -= this.moveSpeed * Math.cos(moveDirection);
      dy -= this.moveSpeed * Math.sin(moveDirection);
    }
    if (this.moveRight) {
      dx += this.moveSpeed * Math.cos(strafeDirection);
      dy += this.moveSpeed * Math.sin(strafeDirection);
    }
    if (this.moveLeft) {
      dx -= this.moveSpeed * Math.cos(strafeDirection);
      dy -= this.moveSpeed * Math.sin(strafeDirection);
    }

    this.pos.x += dx * deltaTime;
    this.pos.y += dy * deltaTime;
  }

  updateViewDirection(viewDirection) {
    if (viewDirection < 0) viewDirection += 360;
    else if (viewDirection >= 360) viewDirection -= 360;

    this.viewDirection = viewDirection;
    this.rays = [];
    for (let i = viewDirection - this.fov / 2; i < viewDirection + this.fov / 2; i += this.fov / this.rayCount) {
      this.rays.push(new RayClass(this.pos.x, this.pos.y, (i * Math.PI) / 180));
    }
  }
}

export default UserCameraClass;