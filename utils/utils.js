import Boundaries from "../classes/BoundariesClass.js";
import Player from "../classes/UserClass.js";
import RayClass from "../classes/RayClass.js";
import { DEG_TO_RAD, fastSin, fastCos } from "./mathLUT.js";

/**
 * Resizes all canvas elements in the canvasArray to maintain the specified aspect ratio.
 */
function resizeCanvas({ canvasArray, ratio }) {
  const targetRatio = ratio || window.innerWidth / window.innerHeight;
  const windowRatio = window.innerWidth / window.innerHeight;
  
  let width, height;
  if (windowRatio > targetRatio) {
    height = window.innerHeight;
    width = height * targetRatio;
  } else {
    width = window.innerWidth;
    height = width / targetRatio;
  }

  for (let i = 0; i < canvasArray.length; i++) {
    canvasArray[i].width = width;
    canvasArray[i].height = height;
  }
}

// Background parallax strength (reduced for subtler horizon movement)
const BG_PARALLAX_STRENGTH = 0.2;

/**
 * Draws the background gradient (sky and floor) with optional vertical parallax
 * @param {CanvasRenderingContext2D} background_ctx - The background canvas context
 * @param {number} height - Canvas height
 * @param {number} width - Canvas width
 * @param {number} [eyeHeight=0] - Vertical camera position for parallax
 */
function drawBackground(background_ctx, height, width, eyeHeight = 0) {
  const topStartLuminosity = 55;
  const topEndLuminosity = 20;
  const bottomStartLuminosity = 40;
  const bottomEndLuminosity = 10;
  
  // Calculate horizon offset based on eye height
  // Positive eyeHeight (jumping) = horizon moves down, shows more sky
  // Negative eyeHeight (crouching) = horizon moves up, shows more floor
  const horizonOffset = eyeHeight * height * BG_PARALLAX_STRENGTH;
  const horizonY = height * 0.5 + horizonOffset;

  background_ctx.clearRect(0, 0, width, height);

  // Draw sky (from top to horizon)
  const topGradient = background_ctx.createLinearGradient(0, 0, 0, horizonY);
  topGradient.addColorStop(0, `hsl(210,20%,${topStartLuminosity}%)`);
  topGradient.addColorStop(1, `hsl(210,20%,${topEndLuminosity}%)`);
  background_ctx.fillStyle = topGradient;
  background_ctx.fillRect(0, 0, width, horizonY);

  // Draw floor (from horizon to bottom)
  const bottomGradient = background_ctx.createLinearGradient(0, height, 0, horizonY);
  bottomGradient.addColorStop(0, `hsl(0,0%,${bottomStartLuminosity}%)`);
  bottomGradient.addColorStop(1, `hsl(0,0%,${bottomEndLuminosity}%)`);
  background_ctx.fillStyle = bottomGradient;
  background_ctx.fillRect(0, horizonY, width, height - horizonY);
}

// Reusable ray object for minimap (avoid allocations)
let minimapRay = null;

/**
 * Casts a ray and returns the distance to the nearest wall
 * Optimized: reuses ray object, only checks nearby boundaries
 */
function castMinimapRay(startX, startY, angle, maxDist, nearbyBoundaries) {
  if (!minimapRay) {
    minimapRay = new RayClass(startX, startY, angle);
  } else {
    minimapRay.pos.x = startX;
    minimapRay.pos.y = startY;
    minimapRay.dir.x = Math.cos(angle);
    minimapRay.dir.y = Math.sin(angle);
  }
  
  let closestDist = maxDist;
  
  for (let i = 0; i < nearbyBoundaries.length; i++) {
    const boundary = nearbyBoundaries[i];
    const result = minimapRay.cast(boundary);
    if (result) {
      const dx = result.point.x - startX;
      const dy = result.point.y - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
      }
    }
  }
  
  return closestDist;
}

/**
 * Gets boundaries near a position (for optimized ray casting)
 * Uses simple distance check from boundary center
 */
function getNearbyBoundaries(boundaries, posX, posY, maxDist) {
  const nearby = [];
  const maxDistSq = maxDist * maxDist;
  
  for (let i = 0; i < boundaries.length; i++) {
    const b = boundaries[i];
    
    // Skip transparent
    if (b.isTransparent) continue;
    
    // Quick distance check
    let cx, cy;
    if (b.isCurved) {
      cx = b.centerX;
      cy = b.centerY;
    } else {
      cx = (b.a.x + b.b.x) * 0.5;
      cy = (b.a.y + b.b.y) * 0.5;
    }
    
    const dx = cx - posX;
    const dy = cy - posY;
    const distSq = dx * dx + dy * dy;
    
    // Include if within range (with generous margin for wall length)
    if (distSq < maxDistSq * 4) {
      nearby.push(b);
    }
  }
  
  return nearby;
}

/**
 * Calculates the effective visibility distance based on angle from center of view.
 * Creates a cone-shaped detection area:
 * - Center 20%: Full distance
 * - Next 20% on each side: Reduces from 100% to 40%
 * - Outer 20% on each side: Remains at 40%
 * This matches the detection logic in EnemyClass.
 * @param {number} angleFromCenter - Angle in radians from the center of view
 * @param {number} halfFovRad - Half of the field of view in radians
 * @param {number} maxDistance - Maximum visibility distance (at center)
 * @returns {number} The effective visibility distance at this angle
 */
function getEffectiveVisibilityDistance(angleFromCenter, halfFovRad, maxDistance) {
  if (halfFovRad === 0) return maxDistance;
  
  // Normalize angle to 0-1 range (0 = center, 1 = edge)
  const normalizedAngle = Math.min(Math.abs(angleFromCenter) / halfFovRad, 1);
  
  // Cone-shaped falloff zones:
  // 0.0 - 0.2: Full distance (center 20%)
  // 0.2 - 0.4: Transition from 100% to 40% (20% on each side)
  // 0.4 - 1.0: Remain at 40% (outer 20% on each side)
  const fullDistanceThreshold = 0.2;
  const transitionEnd = 0.4;
  const minMultiplier = 0.4;
  
  if (normalizedAngle <= fullDistanceThreshold) {
    // Center zone - full distance
    return maxDistance;
  } else if (normalizedAngle <= transitionEnd) {
    // Transition zone - smooth reduction from 100% to 40%
    const transitionProgress = (normalizedAngle - fullDistanceThreshold) / (transitionEnd - fullDistanceThreshold);
    // Use quadratic falloff for smooth but noticeable reduction
    const falloff = 1 - (transitionProgress * transitionProgress);
    const multiplier = minMultiplier + (1 - minMultiplier) * falloff;
    return maxDistance * multiplier;
  } else {
    // Outer zone - remain at minimum (40%)
    return maxDistance * minMultiplier;
  }
}

/**
 * Draws enemy FOV cone that stops at walls with tapered visibility distance.
 * The cone is longer at the center and shorter at the edges.
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} enemy - Enemy object
 * @param {number} offsetX - X offset for centering
 * @param {number} offsetY - Y offset for centering
 * @param {Array} nearbyBoundaries - Boundaries to check for ray intersection
 * @param {number} [maxConeDistance] - Optional max distance to clamp cone (for minimap bounds)
 * @param {boolean} [playerCrouching=false] - Whether player is crouching (reduces detection)
 * @param {boolean} [rotateWithPlayer=false] - Whether minimap rotates with player
 * @param {number} [rotationAngle=0] - Rotation angle in radians
 * @param {number} [centerX=0] - Minimap center X
 * @param {number} [centerY=0] - Minimap center Y
 * @param {Object} [playerPos=null] - Player position {x, y}
 */
function drawEnemyFOVCone(ctx, enemy, offsetX, offsetY, nearbyBoundaries, maxConeDistance = Infinity, playerCrouching = false, rotateWithPlayer = false, rotationAngle = 0, centerX = 0, centerY = 0, playerPos = null) {
  const posX = enemy.pos.x;
  const posY = enemy.pos.y;
  const viewAngle = enemy.viewDirection * DEG_TO_RAD;
  
  // Crouching reduces enemy detection range and cone by half
  const crouchMultiplier = playerCrouching ? 0.5 : 1.0;
  const halfFovRad = (enemy.fov * 0.5 * crouchMultiplier) * DEG_TO_RAD;
  // Maximum visibility distance (at center of cone)
  const maxVisibilityDist = enemy.visibilityDistance * crouchMultiplier;
  
  // Helper to rotate a world point for rotating minimap
  const cosR = Math.cos(rotationAngle);
  const sinR = Math.sin(rotationAngle);
  function rotatePoint(worldX, worldY) {
    if (!rotateWithPlayer || !playerPos) {
      return { x: worldX + offsetX, y: worldY + offsetY };
    }
    const dx = worldX - playerPos.x;
    const dy = worldY - playerPos.y;
    const rotatedX = dx * cosR - dy * sinR;
    const rotatedY = dx * sinR + dy * cosR;
    return { x: rotatedX + centerX, y: rotatedY + centerY };
  }
  
  const enemyCenter = rotatePoint(posX, posY);
  
  // More rays for smoother enemy cones
  const rayCount = 32;
  const angleStep = (halfFovRad * 2) / rayCount;
  
  ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.moveTo(enemyCenter.x, enemyCenter.y);
  
  for (let i = 0; i <= rayCount; i++) {
    // Calculate angle relative to view direction (-halfFov to +halfFov)
    const angleFromCenter = -halfFovRad + i * angleStep;
    const angle = viewAngle + angleFromCenter;
    
    // Calculate tapered max distance for this angle
    const taperedMaxDist = getEffectiveVisibilityDistance(angleFromCenter, halfFovRad, maxVisibilityDist);
    
    // Clamp to minimap bounds
    const effectiveMaxDist = Math.min(taperedMaxDist, maxConeDistance);
    
    // Cast ray to find walls
    let dist = castMinimapRay(posX, posY, angle, effectiveMaxDist, nearbyBoundaries);
    // Double-clamp to ensure cone stays within tapered bounds
    dist = Math.min(dist, effectiveMaxDist);
    
    const hitWorldX = posX + Math.cos(angle) * dist;
    const hitWorldY = posY + Math.sin(angle) * dist;
    const hitPos = rotatePoint(hitWorldX, hitWorldY);
    ctx.lineTo(hitPos.x, hitPos.y);
  }
  
  ctx.closePath();
  ctx.fill();
}

/**
 * Draws a circular minimap on the main canvas
 * Optimized: only enemies within minimap radius get ray-traced FOV cones
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} boundaries - Array of boundary objects
 * @param {Object} user - Player object
 * @param {Array} enemies - Array of enemy objects
 * @param {Object} [goalZone] - Optional goal zone {x, y, radius}
 */
function drawMinimap(ctx, boundaries, user, enemies, goalZone = null) {
  const scale = miniMapSettings.scale;
  const invScale = 1 / scale;
  const centerX = miniMapSettings.x * invScale;
  const centerY = miniMapSettings.y * invScale;
  const radius = miniMapSettings.radius;
  const rotateWithPlayer = miniMapSettings.rotateWithPlayer || false;
  
  // Note: Enemy culling is now done per-enemy based on their visibility distance
  // to ensure we show cones that could reach the player even if the enemy is far away
  
  // Rotation angle (rotate so player faces up/north)
  // Player view direction 0 = right, so we need to rotate by -(viewDirection + 90°) to make "up" the forward direction
  const rotationAngle = rotateWithPlayer ? -(user.viewDirection + 90) * DEG_TO_RAD : 0;
  const cosR = Math.cos(rotationAngle);
  const sinR = Math.sin(rotationAngle);
  
  // Helper function to rotate a point around the player position
  function rotatePoint(worldX, worldY) {
    if (!rotateWithPlayer) {
      return { x: worldX + centerX - user.pos.x, y: worldY + centerY - user.pos.y };
    }
    // Translate to player-relative coordinates
    const dx = worldX - user.pos.x;
    const dy = worldY - user.pos.y;
    // Rotate
    const rotatedX = dx * cosR - dy * sinR;
    const rotatedY = dx * sinR + dy * cosR;
    // Translate to minimap center
    return { x: rotatedX + centerX, y: rotatedY + centerY };
  }

  ctx.save();
  ctx.scale(scale, scale);

  // Create circular clipping path
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.clip();

  // Draw border
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2 * invScale;
  ctx.stroke();

  // Calculate offset to keep player centered (used for non-rotated mode)
  const offsetX = centerX - user.pos.x;
  const offsetY = centerY - user.pos.y;

  // Draw goal zone if provided (pulsing green circle)
  if (goalZone) {
    const goalPos = rotatePoint(goalZone.x, goalZone.y);
    const goalX = goalPos.x;
    const goalY = goalPos.y;
    const goalRadius = goalZone.radius;
    
    // Pulsing effect
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.004);
    
    // Outer glow
    const goalGradient = ctx.createRadialGradient(goalX, goalY, 0, goalX, goalY, goalRadius * 1.5);
    goalGradient.addColorStop(0, `rgba(0, 255, 100, ${0.6 * pulse})`);
    goalGradient.addColorStop(0.7, `rgba(0, 255, 100, ${0.3 * pulse})`);
    goalGradient.addColorStop(1, 'rgba(0, 255, 100, 0)');
    
    ctx.fillStyle = goalGradient;
    ctx.beginPath();
    ctx.arc(goalX, goalY, goalRadius * 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Goal marker ring
    ctx.strokeStyle = `rgba(0, 255, 100, ${pulse})`;
    ctx.lineWidth = 2 * invScale;
    ctx.beginPath();
    ctx.arc(goalX, goalY, goalRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Inner goal marker
    ctx.fillStyle = `rgba(0, 255, 100, ${0.8 * pulse})`;
    ctx.beginPath();
    ctx.arc(goalX, goalY, 4 * invScale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw boundaries (opaque first, then translucent)
  ctx.lineWidth = invScale;
  
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];
    
    // Skip sprite boundaries (enemies etc) but draw translucent walls
    if (boundary.isSprite) continue;
    
    // Set color based on wall type
    if (boundary.isTransparent && boundary.color) {
      // Use the wall's actual color for translucent walls
      ctx.strokeStyle = boundary.color;
    } else if (boundary.color && !boundary.isTransparent) {
      // Solid colored walls - show as slightly dimmer version
      ctx.strokeStyle = boundary.color;
    } else {
      // Default white for textured/normal walls
      ctx.strokeStyle = 'white';
    }
    
    if (boundary.isCurved) {
      ctx.beginPath();
      const segments = 12;
      const angleDiff = boundary.endAngle - boundary.startAngle;
      
      const startWorldX = boundary.centerX + boundary.radius * fastCos(boundary.startAngle);
      const startWorldY = boundary.centerY + boundary.radius * fastSin(boundary.startAngle);
      const startPos = rotatePoint(startWorldX, startWorldY);
      ctx.moveTo(startPos.x, startPos.y);
      
      for (let j = 1; j <= segments; j++) {
        const angle = boundary.startAngle + (j / segments) * angleDiff;
        const worldX = boundary.centerX + boundary.radius * fastCos(angle);
        const worldY = boundary.centerY + boundary.radius * fastSin(angle);
        const pos = rotatePoint(worldX, worldY);
        ctx.lineTo(pos.x, pos.y);
      }
      ctx.stroke();
    } else {
      const posA = rotatePoint(boundary.a.x, boundary.a.y);
      const posB = rotatePoint(boundary.b.x, boundary.b.y);
      ctx.beginPath();
      ctx.moveTo(posA.x, posA.y);
      ctx.lineTo(posB.x, posB.y);
      ctx.stroke();
    }
  }

  // Draw player FOV cone (simple arc, no raycasting)
  // When rotateWithPlayer is enabled, player always faces up (north = -90 degrees in canvas coords)
  const playerDirRad = rotateWithPlayer ? -Math.PI / 2 : user.viewDirection * DEG_TO_RAD;
  const playerFovHalfRad = (user.camera.fov * 0.5) * DEG_TO_RAD;
  const playerFovLength = 150;
  
  // Gradient for player cone
  const playerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, playerFovLength);
  playerGradient.addColorStop(0, 'rgba(255, 255, 0, 0.4)');
  playerGradient.addColorStop(1, 'rgba(255, 255, 0, 0)');

  ctx.fillStyle = playerGradient;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.arc(centerX, centerY, playerFovLength, playerDirRad - playerFovHalfRad, playerDirRad + playerFovHalfRad);
  ctx.closePath();
  ctx.fill();

  // Draw player position dot
  ctx.fillStyle = 'yellow';
    ctx.beginPath();
  ctx.arc(centerX, centerY, 3 * invScale, 0, Math.PI * 2);
  ctx.fill();

  // Draw enemy FOV cones - include enemies whose cone could reach the minimap area
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];

    // Distance from player (minimap center) to enemy
    const dx = enemy.pos.x - user.pos.x;
    const dy = enemy.pos.y - user.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Cull enemies whose cone can't possibly reach the minimap area
    // An enemy at distance D with visibility V can reach as close as (D - V) to the player
    // We show the enemy if their cone could reach the visible minimap (with some margin)
    const crouchMultiplier = user.isCrouching ? 0.5 : 1.0;
    const effectiveVisibility = enemy.visibilityDistance * crouchMultiplier;
    const cullDistance = radius + effectiveVisibility;
    
    if (dist > cullDistance) {
      continue;
    }
    
    // Get nearby boundaries for this enemy (optimization)
    const nearbyBoundaries = getNearbyBoundaries(
      boundaries, 
      enemy.pos.x, 
      enemy.pos.y, 
      enemy.visibilityDistance
    );
    
    // Calculate enemy position on minimap (needed for both proximity circle and dot)
    const enemyPos = rotatePoint(enemy.pos.x, enemy.pos.y);
    
    // Draw 360° proximity detection circle (15% of main visibility distance)
    // Only visible when player is NOT crouching (crouching disables proximity detection)
    if (!user.isCrouching) {
      const proximityDistance = enemy.visibilityDistance * 0.15;
      
      ctx.fillStyle = 'rgba(255, 100, 100, 0.15)'; // Light red for proximity zone
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.lineWidth = 1 * invScale;
      ctx.beginPath();
      ctx.arc(enemyPos.x, enemyPos.y, proximityDistance, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    
    // Draw FOV cone showing true detection range
    // The canvas clip path handles the circular minimap boundary
    // Pass player crouch state to show reduced detection when crouching
    // Pass rotation info for rotating minimap
    drawEnemyFOVCone(ctx, enemy, offsetX, offsetY, nearbyBoundaries, Infinity, user.isCrouching, rotateWithPlayer, rotationAngle, centerX, centerY, user.pos);

    // Enemy position dot (on top of everything)
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(enemyPos.x, enemyPos.y, 2 * invScale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export { resizeCanvas, drawBackground, drawMinimap };
