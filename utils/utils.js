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
 * Draws enemy FOV cone that stops at walls
 * Uses only 6 rays for performance
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} enemy - Enemy object
 * @param {number} offsetX - X offset for centering
 * @param {number} offsetY - Y offset for centering
 * @param {Array} nearbyBoundaries - Boundaries to check for ray intersection
 * @param {number} [maxConeDistance] - Optional max distance to clamp cone (for minimap bounds)
 * @param {boolean} [playerCrouching=false] - Whether player is crouching (reduces detection)
 */
function drawEnemyFOVCone(ctx, enemy, offsetX, offsetY, nearbyBoundaries, maxConeDistance = Infinity, playerCrouching = false) {
  const posX = enemy.pos.x;
  const posY = enemy.pos.y;
  const viewAngle = enemy.viewDirection * DEG_TO_RAD;
  
  // Crouching reduces enemy detection range and cone by half
  const crouchMultiplier = playerCrouching ? 0.5 : 1.0;
  const halfFov = (enemy.fov * 0.5 * crouchMultiplier) * DEG_TO_RAD;
  // Clamp maxDist to the smaller of visibility distance and minimap bounds
  const maxDist = Math.min(enemy.visibilityDistance * crouchMultiplier, maxConeDistance);
  
  const cx = posX + offsetX;
  const cy = posY + offsetY;
  
  // More rays for smoother enemy cones
  const rayCount = 16;
  const angleStep = (halfFov * 2) / rayCount;
  
  ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  
  for (let i = 0; i <= rayCount; i++) {
    const angle = viewAngle - halfFov + i * angleStep;
    let dist = castMinimapRay(posX, posY, angle, maxDist, nearbyBoundaries);
    // Double-clamp to ensure cone stays within bounds
    dist = Math.min(dist, maxDist);
    const hitX = posX + Math.cos(angle) * dist + offsetX;
    const hitY = posY + Math.sin(angle) * dist + offsetY;
    ctx.lineTo(hitX, hitY);
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
  
  // Culling radius for enemies (slightly larger than minimap)
  const enemyCullRadius = radius * 1.25;
  const enemyCullRadiusSq = enemyCullRadius * enemyCullRadius;

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

  // Calculate offset to keep player centered
  const offsetX = centerX - user.pos.x;
  const offsetY = centerY - user.pos.y;

  // Draw goal zone if provided (pulsing green circle)
  if (goalZone) {
    const goalX = goalZone.x + offsetX;
    const goalY = goalZone.y + offsetY;
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
      
      let x = boundary.centerX + boundary.radius * fastCos(boundary.startAngle) + offsetX;
      let y = boundary.centerY + boundary.radius * fastSin(boundary.startAngle) + offsetY;
      ctx.moveTo(x, y);
      
      for (let j = 1; j <= segments; j++) {
        const angle = boundary.startAngle + (j / segments) * angleDiff;
        x = boundary.centerX + boundary.radius * fastCos(angle) + offsetX;
        y = boundary.centerY + boundary.radius * fastSin(angle) + offsetY;
          ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(boundary.a.x + offsetX, boundary.a.y + offsetY);
      ctx.lineTo(boundary.b.x + offsetX, boundary.b.y + offsetY);
      ctx.stroke();
    }
  }

  // Draw player FOV cone (simple arc, no raycasting)
  const playerDirRad = user.viewDirection * DEG_TO_RAD;
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

  // Draw enemy FOV cones - only for enemies within minimap radius
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];

    // Distance from player (minimap center) to enemy
    const dx = enemy.pos.x - user.pos.x;
    const dy = enemy.pos.y - user.pos.y;
    const distSq = dx * dx + dy * dy;
    
    // Skip if enemy is outside the culling radius
    if (distSq > enemyCullRadiusSq) {
      continue;
    }
    
    // Get nearby boundaries for this enemy (optimization)
    const nearbyBoundaries = getNearbyBoundaries(
      boundaries, 
      enemy.pos.x, 
      enemy.pos.y, 
      enemy.visibilityDistance
    );
    
    // Draw FOV cone - clamp to minimap radius to prevent infinite cones
    // Pass player crouch state to show reduced detection when crouching
    drawEnemyFOVCone(ctx, enemy, offsetX, offsetY, nearbyBoundaries, radius, user.isCrouching);

    // Enemy position dot
    const enemyCenterX = enemy.pos.x + offsetX;
    const enemyCenterY = enemy.pos.y + offsetY;
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(enemyCenterX, enemyCenterY, 2 * invScale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export { resizeCanvas, drawBackground, drawMinimap };
