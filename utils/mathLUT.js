/**
 * Pre-computed lookup tables for trigonometric functions and common math operations.
 * These provide significant performance gains over calling Math.sin/cos per-ray.
 */

// LUT resolution - higher = more precision but more memory
const LUT_SIZE = 3600; // 0.1 degree precision
const LUT_SCALE = LUT_SIZE / (Math.PI * 2);
const INV_LUT_SCALE = (Math.PI * 2) / LUT_SIZE;

// Pre-allocate typed arrays for better memory performance
const sinLUT = new Float32Array(LUT_SIZE);
const cosLUT = new Float32Array(LUT_SIZE);

// Pre-compute all values
for (let i = 0; i < LUT_SIZE; i++) {
  const angle = i * INV_LUT_SCALE;
  sinLUT[i] = Math.sin(angle);
  cosLUT[i] = Math.cos(angle);
}

// Common constants
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const INV_TWO_PI = 1 / TWO_PI;

/**
 * Normalizes an angle to [0, 2π) range using multiplication instead of modulo
 * @param {number} angle - Angle in radians
 * @returns {number} Normalized angle
 */
function normalizeAngle(angle) {
  // Fast normalization using floor
  const normalized = angle - TWO_PI * Math.floor(angle * INV_TWO_PI);
  return normalized < 0 ? normalized + TWO_PI : normalized;
}

/**
 * Normalizes an angle to [-π, π) range
 * @param {number} angle - Angle in radians
 * @returns {number} Normalized angle
 */
function normalizeAngleSigned(angle) {
  let a = normalizeAngle(angle);
  if (a > Math.PI) a -= TWO_PI;
  return a;
}

/**
 * Fast sine lookup
 * @param {number} angle - Angle in radians
 * @returns {number} Approximate sine value
 */
function fastSin(angle) {
  const normalized = normalizeAngle(angle);
  const index = (normalized * LUT_SCALE) | 0; // Bitwise OR for fast floor
  return sinLUT[index];
}

/**
 * Fast cosine lookup
 * @param {number} angle - Angle in radians
 * @returns {number} Approximate cosine value
 */
function fastCos(angle) {
  const normalized = normalizeAngle(angle);
  const index = (normalized * LUT_SCALE) | 0;
  return cosLUT[index];
}

/**
 * Fast sine and cosine together (saves normalization overhead)
 * @param {number} angle - Angle in radians
 * @returns {{sin: number, cos: number}} Both values
 */
function fastSinCos(angle) {
  const normalized = normalizeAngle(angle);
  const index = (normalized * LUT_SCALE) | 0;
  return {
    sin: sinLUT[index],
    cos: cosLUT[index]
  };
}

/**
 * Fast approximate inverse square root (Quake III style, but using JS)
 * Falls back to 1/Math.sqrt for accuracy where needed
 * @param {number} x - Input value
 * @returns {number} Approximate 1/sqrt(x)
 */
function fastInvSqrt(x) {
  return 1 / Math.sqrt(x);
}

/**
 * Fast distance calculation (squared distance when exact distance not needed)
 * @param {number} dx - X difference
 * @param {number} dy - Y difference
 * @returns {number} Squared distance
 */
function distanceSquared(dx, dy) {
  return dx * dx + dy * dy;
}

/**
 * Fast distance calculation using hypot
 * @param {number} dx - X difference
 * @param {number} dy - Y difference
 * @returns {number} Distance
 */
function distance(dx, dy) {
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Linear interpolation
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Clamp value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
function clamp(value, min, max) {
  return value < min ? min : (value > max ? max : value);
}

export {
  // Constants
  TWO_PI,
  HALF_PI,
  DEG_TO_RAD,
  RAD_TO_DEG,
  
  // LUT functions
  fastSin,
  fastCos,
  fastSinCos,
  
  // Utility functions
  normalizeAngle,
  normalizeAngleSigned,
  fastInvSqrt,
  distanceSquared,
  distance,
  lerp,
  clamp,
  
  // Raw LUTs for direct access if needed
  sinLUT,
  cosLUT,
  LUT_SIZE,
  LUT_SCALE
};

