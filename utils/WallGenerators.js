import Boundaries from "../classes/BoundariesClass.js";

/**
 * Creates a circular boundary using multiple straight line segments.
 * @param {Object} params - The parameters for creating the circle
 * @param {number} params.centerX - The x-coordinate of the circle's center
 * @param {number} params.centerY - The y-coordinate of the circle's center
 * @param {number} params.radius - The radius of the circle
 * @param {number} params.segments - The number of line segments to use (higher number = smoother circle)
 * @param {HTMLImageElement} params.texture - The texture to apply to the boundary walls
 * @param {number} [params.startAngle=0] - The starting angle in radians (default: 0)
 * @param {number} [params.arcAngle=2 * Math.PI] - The angle of the arc in radians (default: 2π for full circle)
 * @returns {Boundaries[]} An array of Boundary objects that form the circle/arc
 * 
 * @example
 * // Create a full circle
 * const circle = createCircle({
 *   centerX: 300,
 *   centerY: 300,
 *   radius: 100,
 *   segments: 16,
 *   texture: wallTexture
 * });
 * 
 * // Create a 90-degree arc starting from 45 degrees
 * const arc = createCircle({
 *   centerX: 300,
 *   centerY: 300,
 *   radius: 100,
 *   segments: 8,
 *   texture: wallTexture,
 *   startAngle: Math.PI / 4,    // 45 degrees
 *   arcAngle: Math.PI / 2       // 90 degrees
 * });
 */
function createCircle({ 
  centerX, 
  centerY, 
  radius, 
  segments, 
  texture, 
  startAngle = 0, 
  arcAngle = 2 * Math.PI 
}) {
  const boundaries = [];
  const segmentAngle = arcAngle / segments;

  for (let i = 0; i < segments; i++) {
    const angle1 = startAngle + (i * segmentAngle);
    const angle2 = startAngle + ((i + 1) * segmentAngle);
    
    const x1 = centerX + radius * Math.cos(angle1);
    const y1 = centerY + radius * Math.sin(angle1);
    const x2 = centerX + radius * Math.cos(angle2);
    const y2 = centerY + radius * Math.sin(angle2);
    
    boundaries.push(new Boundaries({x1, y1, x2, y2, texture}));
  }
  
  return boundaries;
}

/**
 * Creates a corridor with parallel walls between two points.
 * @param {Object} params - The parameters for creating the corridor
 * @param {number} params.startX - The x-coordinate of the corridor's start point
 * @param {number} params.startY - The y-coordinate of the corridor's start point
 * @param {number} params.endX - The x-coordinate of the corridor's end point
 * @param {number} params.endY - The y-coordinate of the corridor's end point
 * @param {number} params.width - The width of the corridor
 * @param {HTMLImageElement} params.texture - The texture to apply to the corridor walls
 * @returns {Boundaries[]} An array containing two Boundary objects representing the parallel walls
 */
function createCorridor({ startX, startY, endX, endY, width, texture }) {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const unitX = dx / length;
  const unitY = dy / length;
  
  // Calculate perpendicular unit vector
  const perpX = -unitY;
  const perpY = unitX;
  
  // Calculate the four corners of the corridor
  const x1 = startX + perpX * width/2;
  const y1 = startY + perpY * width/2;
  const x2 = startX - perpX * width/2;
  const y2 = startY - perpY * width/2;
  const x3 = endX - perpX * width/2;
  const y3 = endY - perpY * width/2;
  const x4 = endX + perpX * width/2;
  const y4 = endY + perpY * width/2;
  
  return [
    new Boundaries({x1, y1, x2:x4, y2:y4, texture}), // Right wall
    new Boundaries({x1:x2, y1:y2, x2, y2, texture})  // Left wall
  ];
}

/**
 * Creates a path of boundaries by connecting an array of vertices.
 * Can optionally connect the last vertex back to the first vertex.
 * @param {Object} params - The parameters for creating the boundary path
 * @param {Array<{x: number, y: number}>} params.vertices - Array of vertices defining the path corners
 * @param {HTMLImageElement} params.texture - The texture to apply to the boundaries
 * @param {boolean} [params.connectEnds=false] - Whether to connect the last vertex back to the first
 * @returns {Boundaries[]} An array of Boundary objects that form the path
 * 
 * @example
 * // Create a closed room
 * const room = createBoundaryPath({
 *   vertices: [
 *     {x: 100, y: 200},
 *     {x: 100, y: 400},
 *     {x: 300, y: 400},
 *     {x: 300, y: 200}
 *   ],
 *   texture: wallTexture,
 *   connectEnds: true
 * });
 * 
 * // Create an open path
 * const wall = createBoundaryPath({
 *   vertices: [
 *     {x: 100, y: 200},
 *     {x: 100, y: 400},
 *     {x: 300, y: 400}
 *   ],
 *   texture: wallTexture
 * });
 */
function createBoundaryPath({ vertices, texture, connectEnds = false }) {
  if (!vertices || vertices.length < 2) {
    throw new Error('At least 2 vertices are required to create a boundary path');
  }

  const boundaries = [];
  
  // Connect vertices in sequence
  const maxIndex = connectEnds ? vertices.length : vertices.length - 1;
  for (let i = 0; i < maxIndex; i++) {
    const currentVertex = vertices[i];
    const nextVertex = vertices[(i + 1) % vertices.length]; // Wrap around to first vertex when needed
    
    boundaries.push(
      new Boundaries({
        x1: currentVertex.x,
        y1: currentVertex.y,
        x2: nextVertex.x,
        y2: nextVertex.y,
        texture
      })
    );
  }
  
  return boundaries;
}

export { createCircle, createCorridor, createBoundaryPath };