import { RenderConfig } from "../config/GameConfig.js";

/**
 * @typedef {Object} LightSource
 * @property {number} id - Unique identifier
 * @property {number} x - World X position
 * @property {number} y - World Y position
 * @property {number} radius - Max influence distance
 * @property {number} intensity - Brightness at center (0-1)
 * @property {{r: number, g: number, b: number}} color - Light color (0-1 per channel)
 * @property {boolean} flicker - Whether light flickers
 * @property {number} _flickerOffset - Random phase offset for flicker
 * @property {number} _currentIntensity - Intensity after flicker applied
 */

// Spatial grid cell size for light lookup optimization
const LIGHT_GRID_CELL_SIZE = 200;

// Flicker parameters
const FLICKER_SPEED = 0.008;
const FLICKER_AMOUNT = 0.15;

class LightingSystem {
  constructor() {
    /** @type {LightSource[]} */
    this.lights = [];
    this._nextId = 0;

    // Ambient light level - how bright the world is with no light sources
    this.ambientLight = 0.04;

    // Spatial grid for fast light lookup
    this._grid = new Map();
    this._gridDirty = true;

    // Animation time
    this._time = 0;

    // Flashlight state (set externally each frame)
    this._flashlight = null;

    // Crouch darkening multiplier (1.0 = normal, < 1.0 = darker)
    this.crouchMultiplier = 1.0;
  }

  /**
   * Adds a point light source to the scene
   * @param {number} x - World X
   * @param {number} y - World Y
   * @param {number} radius - Max distance of light influence
   * @param {number} [intensity=1] - Brightness at center (0-1)
   * @param {{r: number, g: number, b: number}} [color] - Light color, defaults to warm torch
   * @param {boolean} [flicker=false] - Whether the light flickers
   * @returns {number} Light ID
   */
  addLight(x, y, radius, intensity = 1, color = null, flicker = false) {
    const id = this._nextId++;
    this.lights.push({
      id,
      x,
      y,
      radius,
      radiusSq: radius * radius,
      intensity,
      color: color || { r: 1.0, g: 0.85, b: 0.6 }, // warm torch by default
      flicker,
      _flickerOffset: Math.random() * Math.PI * 2,
      _currentIntensity: intensity
    });
    this._gridDirty = true;
    return id;
  }

  /**
   * Removes a light by ID
   * @param {number} id
   */
  removeLight(id) {
    const idx = this.lights.findIndex(l => l.id === id);
    if (idx !== -1) {
      this.lights.splice(idx, 1);
      this._gridDirty = true;
    }
  }

  /**
   * Clears all lights
   */
  clear() {
    this.lights.length = 0;
    this._grid.clear();
    this._gridDirty = true;
    this._flashlight = null;
  }

  /**
   * Sets flashlight parameters (call each frame when flashlight is on)
   * @param {Object|null} flashlight - null to disable
   * @param {number} flashlight.x - Player X
   * @param {number} flashlight.y - Player Y
   * @param {number} flashlight.angle - View angle in radians
   * @param {number} flashlight.coneAngle - Half-cone angle in radians
   * @param {number} flashlight.range - Max distance
   * @param {number} flashlight.intensity - Brightness (0-1)
   */
  setFlashlight(flashlight) {
    this._flashlight = flashlight;
  }

  /**
   * Updates flicker animation
   * @param {number} deltaTime - Frame delta
   */
  update(deltaTime) {
    this._time = performance.now();

    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      if (light.flicker) {
        const flicker = Math.sin(this._time * FLICKER_SPEED + light._flickerOffset)
          * Math.sin(this._time * FLICKER_SPEED * 1.7 + light._flickerOffset * 2.3);
        light._currentIntensity = light.intensity * (1 - FLICKER_AMOUNT + FLICKER_AMOUNT * flicker);
      } else {
        light._currentIntensity = light.intensity;
      }
    }
  }

  /**
   * Builds spatial grid for fast light lookup
   * @private
   */
  _buildGrid() {
    this._grid.clear();

    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      // Insert light into all cells it could affect
      const minCellX = Math.floor((light.x - light.radius) / LIGHT_GRID_CELL_SIZE);
      const maxCellX = Math.floor((light.x + light.radius) / LIGHT_GRID_CELL_SIZE);
      const minCellY = Math.floor((light.y - light.radius) / LIGHT_GRID_CELL_SIZE);
      const maxCellY = Math.floor((light.y + light.radius) / LIGHT_GRID_CELL_SIZE);

      for (let cy = minCellY; cy <= maxCellY; cy++) {
        for (let cx = minCellX; cx <= maxCellX; cx++) {
          const key = (cx * 73856093) ^ (cy * 19349663); // hash
          let bucket = this._grid.get(key);
          if (!bucket) {
            bucket = [];
            this._grid.set(key, bucket);
          }
          bucket.push(light);
        }
      }
    }

    this._gridDirty = false;
  }

  /**
   * Gets lights that could affect a world position
   * @param {number} worldX
   * @param {number} worldY
   * @returns {LightSource[]}
   * @private
   */
  _getNearbyLights(worldX, worldY) {
    if (this._gridDirty) this._buildGrid();

    const cx = Math.floor(worldX / LIGHT_GRID_CELL_SIZE);
    const cy = Math.floor(worldY / LIGHT_GRID_CELL_SIZE);
    const key = (cx * 73856093) ^ (cy * 19349663);
    return this._grid.get(key) || [];
  }

  /**
   * Calculates lighting at a world position.
   * Returns combined brightness and color tint.
   * @param {number} worldX
   * @param {number} worldY
   * @returns {{brightness: number, r: number, g: number, b: number}}
   */
  calculateLighting(worldX, worldY) {
    let totalBrightness = this.ambientLight;
    let totalR = this.ambientLight;
    let totalG = this.ambientLight;
    let totalB = this.ambientLight;

    // Point lights
    const nearby = this._getNearbyLights(worldX, worldY);
    for (let i = 0; i < nearby.length; i++) {
      const light = nearby[i];
      const dx = worldX - light.x;
      const dy = worldY - light.y;
      const distSq = dx * dx + dy * dy;

      if (distSq >= light.radiusSq) continue;

      const dist = Math.sqrt(distSq);
      const falloff = 1 - dist / light.radius;
      const contribution = light._currentIntensity * falloff * falloff;

      totalBrightness += contribution;
      totalR += contribution * light.color.r;
      totalG += contribution * light.color.g;
      totalB += contribution * light.color.b;
    }

    // Flashlight (directional light)
    if (this._flashlight) {
      const fl = this._flashlight;
      const dx = worldX - fl.x;
      const dy = worldY - fl.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < fl.range * fl.range) {
        // Check if point is within cone
        const angleToPoint = Math.atan2(dy, dx);
        let angleDiff = angleToPoint - fl.angle;
        // Normalize to [-PI, PI]
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) < fl.coneAngle) {
          const dist = Math.sqrt(distSq);
          const distFalloff = 1 - dist / fl.range;
          // Softer falloff at cone edges
          const coneFalloff = 1 - Math.abs(angleDiff) / fl.coneAngle;
          const contribution = fl.intensity * distFalloff * distFalloff * coneFalloff;

          totalBrightness += contribution;
          // Flashlight is white/cool white
          totalR += contribution * 0.95;
          totalG += contribution * 0.95;
          totalB += contribution * 1.0;
        }
      }
    }

    // Apply crouch darkening
    if (this.crouchMultiplier < 1) {
      totalBrightness *= this.crouchMultiplier;
      totalR *= this.crouchMultiplier;
      totalG *= this.crouchMultiplier;
      totalB *= this.crouchMultiplier;
    }

    // Clamp
    if (totalBrightness > 1) totalBrightness = 1;
    if (totalR > 1) totalR = 1;
    if (totalG > 1) totalG = 1;
    if (totalB > 1) totalB = 1;

    return { brightness: totalBrightness, r: totalR, g: totalG, b: totalB };
  }

  /**
   * Fast brightness-only calculation (no color), for performance-critical paths
   * @param {number} worldX
   * @param {number} worldY
   * @returns {number} brightness 0-1
   */
  calculateBrightnessOnly(worldX, worldY) {
    let totalBrightness = this.ambientLight;

    // Point lights
    const nearby = this._getNearbyLights(worldX, worldY);
    for (let i = 0; i < nearby.length; i++) {
      const light = nearby[i];
      const dx = worldX - light.x;
      const dy = worldY - light.y;
      const distSq = dx * dx + dy * dy;

      if (distSq >= light.radiusSq) continue;

      const dist = Math.sqrt(distSq);
      const falloff = 1 - dist / light.radius;
      totalBrightness += light._currentIntensity * falloff * falloff;
    }

    // Flashlight
    if (this._flashlight) {
      const fl = this._flashlight;
      const dx = worldX - fl.x;
      const dy = worldY - fl.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < fl.range * fl.range) {
        const angleToPoint = Math.atan2(dy, dx);
        let angleDiff = angleToPoint - fl.angle;
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) < fl.coneAngle) {
          const dist = Math.sqrt(distSq);
          const distFalloff = 1 - dist / fl.range;
          const coneFalloff = 1 - Math.abs(angleDiff) / fl.coneAngle;
          totalBrightness += fl.intensity * distFalloff * distFalloff * coneFalloff;
        }
      }
    }

    if (this.crouchMultiplier < 1) {
      totalBrightness *= this.crouchMultiplier;
    }
    return totalBrightness > 1 ? 1 : totalBrightness;
  }
}

const lightingSystem = new LightingSystem();
export default lightingSystem;
export { LightingSystem };
