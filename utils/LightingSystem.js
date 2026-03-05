import { RenderConfig } from "../config/GameConfig.js";

/**
 * @typedef {Object} LightSource
 * @property {number} id - Unique identifier
 * @property {number} x - World X position
 * @property {number} y - World Y position
 * @property {number} radius - Max influence distance
 * @property {number} radiusSq - radius * radius (precomputed)
 * @property {number} invRadius - 1 / radius (precomputed)
 * @property {number} intensity - Brightness at center (0-1)
 * @property {{r: number, g: number, b: number}} color - Light color (0-1 per channel)
 * @property {boolean} flicker - Whether light flickers
 * @property {number} _flickerPhase - Random phase offset for flicker
 * @property {number} _flickerSpeed - Per-light random speed variation
 * @property {number} _currentIntensity - Intensity after flicker applied
 */

// Spatial grid cell size for light lookup optimization
const LIGHT_GRID_CELL_SIZE = 200;
const INV_GRID_CELL_SIZE = 1 / LIGHT_GRID_CELL_SIZE;

// Flicker parameters - subtle torch-like variation
const FLICKER_BASE_SPEED = 0.003;  // Slower base
const FLICKER_AMOUNT = 0.08;       // Subtle 8% variation

class LightingSystem {
  constructor() {
    /** @type {LightSource[]} */
    this.lights = [];
    this._nextId = 0;

    // Ambient light level — very faint base visibility even in total darkness
    this.ambientLight = 0.06;

    // Spatial grid for fast light lookup
    this._grid = new Map();
    this._gridDirty = true;

    // Animation time
    this._time = 0;

    // Flashlight state — precomputed values for fast cone check
    this._flashlight = null;
    this._flDirX = 0;        // cos(angle)
    this._flDirY = 0;        // sin(angle)
    this._flRangeSq = 0;     // range * range
    this._flInvRange = 0;    // 1 / range
    this._flCosHalfCone = 1; // cos(coneAngle) for fast cone test

    // Crouch darkening multiplier (1.0 = normal, < 1.0 = darker)
    this.crouchMultiplier = 1.0;
  }

  /**
   * Adds a point light source
   */
  addLight(x, y, radius, intensity = 1, color = null, flicker = false) {
    const id = this._nextId++;
    this.lights.push({
      id, x, y,
      radius,
      radiusSq: radius * radius,
      invRadius: 1 / radius,
      _invRadiusSq: 1 / (radius * radius),
      intensity,
      color: color || { r: 1.0, g: 0.85, b: 0.6 },
      flicker,
      _flickerPhase: Math.random() * Math.PI * 2,
      _flickerSpeed: FLICKER_BASE_SPEED * (0.7 + Math.random() * 0.6), // vary per light
      _currentIntensity: intensity
    });
    this._gridDirty = true;
    return id;
  }

  removeLight(id) {
    const idx = this.lights.findIndex(l => l.id === id);
    if (idx !== -1) {
      this.lights.splice(idx, 1);
      this._gridDirty = true;
    }
  }

  clear() {
    this.lights.length = 0;
    this._grid.clear();
    this._gridDirty = true;
    this._flashlight = null;
  }

  /**
   * Sets flashlight parameters. Precomputes direction + cone for fast checks.
   * @param {Object|null} flashlight
   */
  setFlashlight(flashlight) {
    this._flashlight = flashlight;
    if (flashlight) {
      this._flDirX = Math.cos(flashlight.angle);
      this._flDirY = Math.sin(flashlight.angle);
      this._flRangeSq = flashlight.range * flashlight.range;
      this._flInvRange = 1 / flashlight.range;
      this._flCosHalfCone = Math.cos(flashlight.coneAngle);
    }
  }

  /**
   * Updates flicker — subtle irregular torch variation.
   * Uses multiple sine waves at different frequencies per light for organic feel.
   */
  update(deltaTime) {
    this._time = performance.now();

    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      if (light.flicker) {
        const t = this._time * light._flickerSpeed + light._flickerPhase;
        // Three overlapping waves at prime-ratio frequencies for irregular flicker
        const f = Math.sin(t) * 0.5
                + Math.sin(t * 2.3) * 0.3
                + Math.sin(t * 5.7) * 0.2;
        light._currentIntensity = light.intensity * (1 - FLICKER_AMOUNT + FLICKER_AMOUNT * f);
      }
    }
  }

  /** @private */
  _buildGrid() {
    this._grid.clear();

    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      const minCellX = ((light.x - light.radius) * INV_GRID_CELL_SIZE) | 0;
      const maxCellX = ((light.x + light.radius) * INV_GRID_CELL_SIZE) | 0;
      const minCellY = ((light.y - light.radius) * INV_GRID_CELL_SIZE) | 0;
      const maxCellY = ((light.y + light.radius) * INV_GRID_CELL_SIZE) | 0;

      for (let cy = minCellY; cy <= maxCellY; cy++) {
        for (let cx = minCellX; cx <= maxCellX; cx++) {
          const key = (cx * 73856093) ^ (cy * 19349663);
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

  /** @private */
  _getNearbyLights(worldX, worldY) {
    if (this._gridDirty) this._buildGrid();

    const cx = (worldX * INV_GRID_CELL_SIZE) | 0;
    const cy = (worldY * INV_GRID_CELL_SIZE) | 0;
    const key = (cx * 73856093) ^ (cy * 19349663);
    return this._grid.get(key) || [];
  }

  /**
   * Full lighting calculation with color.
   */
  calculateLighting(worldX, worldY) {
    let totalBrightness = this.ambientLight;
    let totalR = this.ambientLight;
    let totalG = this.ambientLight;
    let totalB = this.ambientLight;

    const nearby = this._getNearbyLights(worldX, worldY);
    for (let i = 0; i < nearby.length; i++) {
      const light = nearby[i];
      const dx = worldX - light.x;
      const dy = worldY - light.y;
      const distSq = dx * dx + dy * dy;

      if (distSq >= light.radiusSq) continue;

      // Approximate sqrt: use distSq-based falloff to avoid sqrt
      // falloff = (1 - dist/radius)^2 = (1 - sqrt(distSq)/radius)^2
      // We still need sqrt here for color accuracy
      const dist = Math.sqrt(distSq);
      const falloff = 1 - dist * light.invRadius;
      const contribution = light._currentIntensity * falloff * falloff;

      totalBrightness += contribution;
      totalR += contribution * light.color.r;
      totalG += contribution * light.color.g;
      totalB += contribution * light.color.b;
    }

    // Apply crouch darkening to ambient + point lights only (not flashlight)
    if (this.crouchMultiplier < 1) {
      totalBrightness *= this.crouchMultiplier;
      totalR *= this.crouchMultiplier;
      totalG *= this.crouchMultiplier;
      totalB *= this.crouchMultiplier;
    }

    // Flashlight (added after crouch so it's unaffected)
    if (this._flashlight) {
      const flContrib = this._calcFlashlight(worldX, worldY);
      if (flContrib > 0) {
        totalBrightness += flContrib;
        totalR += flContrib * 0.95;
        totalG += flContrib * 0.95;
        totalB += flContrib * 1.0;
      }
    }

    if (totalBrightness > 1) totalBrightness = 1;
    if (totalR > 1) totalR = 1;
    if (totalG > 1) totalG = 1;
    if (totalB > 1) totalB = 1;

    return { brightness: totalBrightness, r: totalR, g: totalG, b: totalB };
  }

  /**
   * Fast brightness-only calculation (no color).
   * Hot path — called thousands of times per frame.
   */
  calculateBrightnessOnly(worldX, worldY) {
    let total = this.ambientLight;

    // Point lights
    const nearby = this._getNearbyLights(worldX, worldY);
    for (let i = 0; i < nearby.length; i++) {
      const light = nearby[i];
      const dx = worldX - light.x;
      const dy = worldY - light.y;
      const distSq = dx * dx + dy * dy;

      if (distSq >= light.radiusSq) continue;

      // Approximate falloff without sqrt:
      // true falloff = (1 - dist/R)^2 = 1 - 2*dist/R + dist^2/R^2
      // Approximation using distSq: ratio = distSq / radiusSq (= (dist/R)^2)
      // falloff ≈ (1 - ratio)^2 — slightly different curve but visually similar and ~40% faster
      const ratio = distSq * light._invRadiusSq;
      const falloff = 1 - ratio;
      total += light._currentIntensity * falloff * falloff;
    }

    // Apply crouch darkening to ambient + point lights only (not flashlight)
    if (this.crouchMultiplier < 1) {
      total *= this.crouchMultiplier;
    }

    // Flashlight (added after crouch so it's unaffected)
    if (this._flashlight) {
      const flContrib = this._calcFlashlight(worldX, worldY);
      if (flContrib > 0) total += flContrib;
    }

    return total > 1 ? 1 : total;
  }

  /**
   * Flashlight contribution using dot product cone check (no atan2).
   * @private
   */
  _calcFlashlight(worldX, worldY) {
    const fl = this._flashlight;
    const dx = worldX - fl.x;
    const dy = worldY - fl.y;
    const distSq = dx * dx + dy * dy;

    if (distSq >= this._flRangeSq || distSq < 0.01) return 0;

    // Dot product cone check: cos(angle) = dot(dir, toPoint) / |toPoint|
    // If cos(angle) >= cos(halfCone), point is inside cone
    const invDist = 1 / Math.sqrt(distSq);
    const dotProduct = (dx * this._flDirX + dy * this._flDirY) * invDist;

    if (dotProduct < this._flCosHalfCone) return 0;

    const dist = distSq * invDist; // dist = distSq / sqrt(distSq) = sqrt(distSq)
    const distFalloff = 1 - dist * this._flInvRange;
    // Cone edge softening: remap dot from [cosHalfCone, 1] to [0, 1]
    const coneRange = 1 - this._flCosHalfCone;
    const coneFalloff = coneRange > 0 ? (dotProduct - this._flCosHalfCone) / coneRange : 1;

    return fl.intensity * distFalloff * distFalloff * coneFalloff;
  }
}

const lightingSystem = new LightingSystem();
export default lightingSystem;
export { LightingSystem };
