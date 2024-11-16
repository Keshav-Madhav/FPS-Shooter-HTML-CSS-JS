import RayClass from "./RayClass.js";

// Class to create light source
class UserCameraClass {
  constructor({x, y, fov, rayCount}) {
    this.pos = {x: x, y: y};
    this.rayCount = rayCount;
    this.rays = [];
    this.heading = 0;
    this.viewDirection = 0;
    this.moveSpeed = 1;
    this.moveForwards = false;
    this.moveBackwards = false;
    this.moveLeft = false;
    this.moveRight = false;

    // Generate rays for the light source
    for (let i = 0 - fov/2; i < 0 + fov/2; i += (fov / rayCount)){
      this.rays.push(new RayClass(x, y, i * Math.PI / 180));
    }
  }

  // Method to draw light source and its rays
  draw(){
    this.updatePos();

    for(let ray of this.rays){
      ray.pos.x = this.pos.x;
      ray.pos.y = this.pos.y;
    }
  }

  // Method to spread rays and detect intersections with boundaries
  spread(boundaries){
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
          const angle = Math.atan2(ray.dir.y, ray.dir.x) - this.viewDirection * Math.PI / 180;
          distance *= Math.cos(angle); // Fix fisheye effect
          if (distance < record) {
            record = distance;
            closest = point;
            texture = hitBound.texture;
            hitBoundary = hitBound;

            // Determine which part of the texture to use
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
        boundary: hitBoundary
      };
    }
    return scene;
  }

  updatePos(){
    const moveDirection = Math.atan2(Math.sin(this.viewDirection * Math.PI / 180), Math.cos(this.viewDirection * Math.PI / 180));
    const strafeDirection = moveDirection + Math.PI / 2; // Perpendicular to move direction
  
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

    this.pos.x += dx;
    this.pos.y += dy;
  }
}

export default UserCameraClass;