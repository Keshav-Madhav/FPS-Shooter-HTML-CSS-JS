import Boundaries from "../classes/BoundariesClass.js";
import EnemyClass from "../classes/EnemyClass.js";
import GameMap from "../classes/GameMapClass.js";
import Textures from "../classes/TexturesClass.js";
import StartZone from "../classes/StartZoneClass.js";
import GoalZone from "../classes/GoalZoneClass.js";
import { createCurvedWall } from "../utils/WallGenerators.js";
import { MazeConfig, ZoneConfig, EnemyConfig, PlayerConfig } from "../config/index.js";

/**
 * Maze cell representation
 */
class MazeCell {
  constructor() {
    this.visited = false;
    this.walls = { north: true, south: true, east: true, west: true };
  }
}

/**
 * Creates a maze grid
 */
function createGrid(cols, rows) {
  const grid = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      row.push(new MazeCell());
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Gets the cell at position, or null if out of bounds
 */
function getCell(grid, x, y) {
  if (y < 0 || y >= grid.length) return null;
  if (x < 0 || x >= grid[0].length) return null;
  return grid[y][x];
}

/**
 * Gets unvisited neighbors
 */
function getUnvisitedNeighbors(grid, x, y) {
  const neighbors = [];
  
  const north = getCell(grid, x, y - 1);
  const south = getCell(grid, x, y + 1);
  const east = getCell(grid, x + 1, y);
  const west = getCell(grid, x - 1, y);
  
  if (north && !north.visited) neighbors.push({ x, y: y - 1, dir: 'north' });
  if (south && !south.visited) neighbors.push({ x, y: y + 1, dir: 'south' });
  if (east && !east.visited) neighbors.push({ x: x + 1, y, dir: 'east' });
  if (west && !west.visited) neighbors.push({ x: x - 1, y, dir: 'west' });
  
  return neighbors;
}

/**
 * Removes walls between two cells
 */
function removeWalls(grid, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  
  if (dx === 1) { // Moving east
    grid[y1][x1].walls.east = false;
    grid[y2][x2].walls.west = false;
  } else if (dx === -1) { // Moving west
    grid[y1][x1].walls.west = false;
    grid[y2][x2].walls.east = false;
  } else if (dy === 1) { // Moving south
    grid[y1][x1].walls.south = false;
    grid[y2][x2].walls.north = false;
  } else if (dy === -1) { // Moving north
    grid[y1][x1].walls.north = false;
    grid[y2][x2].walls.south = false;
  }
}

/**
 * Generates maze using recursive backtracking
 */
function generateMaze(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  
  const startX = 0;
  const startY = 0;
  
  const stack = [{ x: startX, y: startY }];
  grid[startY][startX].visited = true;
  
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = getUnvisitedNeighbors(grid, current.x, current.y);
    
    if (neighbors.length === 0) {
      stack.pop();
    } else {
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      removeWalls(grid, current.x, current.y, next.x, next.y);
      grid[next.y][next.x].visited = true;
      stack.push({ x: next.x, y: next.y });
    }
  }
}

/**
 * Adds extra passages to create loops and multiple paths
 * @param {MazeCell[][]} grid - The maze grid
 * @param {number} loopChance - Probability of removing additional walls (0-1)
 */
function addLoops(grid, loopChance) {
  const rows = grid.length;
  const cols = grid[0].length;
  
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[y][x];
      
      // Try to remove east wall (creates horizontal loop)
      if (cell.walls.east && x < cols - 1 && Math.random() < loopChance) {
        cell.walls.east = false;
        grid[y][x + 1].walls.west = false;
      }
      
      // Try to remove south wall (creates vertical loop)
      if (cell.walls.south && y < rows - 1 && Math.random() < loopChance) {
        cell.walls.south = false;
        grid[y + 1][x].walls.north = false;
      }
    }
  }
}

/**
 * Creates rooms by removing walls in rectangular areas
 * @param {MazeCell[][]} grid - The maze grid
 * @param {number} roomCount - Number of rooms to try to create
 * @param {number} minSize - Minimum room size in cells
 * @param {number} maxSize - Maximum room size in cells
 */
function createRooms(grid, roomCount, minSize, maxSize) {
  const rows = grid.length;
  const cols = grid[0].length;
  const rooms = [];
  
  for (let attempt = 0; attempt < roomCount * 3; attempt++) {
    if (rooms.length >= roomCount) break;
    
    const roomWidth = minSize + Math.floor(Math.random() * (maxSize - minSize + 1));
    const roomHeight = minSize + Math.floor(Math.random() * (maxSize - minSize + 1));
    const roomX = Math.floor(Math.random() * (cols - roomWidth));
    const roomY = Math.floor(Math.random() * (rows - roomHeight));
    
    // Check for overlap with existing rooms
    let overlaps = false;
    for (const room of rooms) {
      if (roomX < room.x + room.width + 1 &&
          roomX + roomWidth + 1 > room.x &&
          roomY < room.y + room.height + 1 &&
          roomY + roomHeight + 1 > room.y) {
        overlaps = true;
        break;
      }
    }
    
    if (!overlaps) {
      rooms.push({ x: roomX, y: roomY, width: roomWidth, height: roomHeight });
      
      // Remove interior walls to create open room
      for (let ry = roomY; ry < roomY + roomHeight; ry++) {
        for (let rx = roomX; rx < roomX + roomWidth; rx++) {
          const cell = grid[ry][rx];
          
          // Remove internal walls
          if (rx < roomX + roomWidth - 1) {
            cell.walls.east = false;
            grid[ry][rx + 1].walls.west = false;
          }
          if (ry < roomY + roomHeight - 1) {
            cell.walls.south = false;
            grid[ry + 1][rx].walls.north = false;
          }
        }
      }
    }
  }
  
  return rooms;
}

/**
 * Adds dead ends by occasionally not carving through
 * This is done by adding back some walls after maze generation
 * @param {MazeCell[][]} grid - The maze grid  
 * @param {number} deadEndChance - Chance to create a dead end at eligible spots
 */
function addDeadEnds(grid, deadEndChance) {
  const rows = grid.length;
  const cols = grid[0].length;
  
  // Find cells with 3+ open passages and sometimes block one
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const cell = grid[y][x];
      
      // Count open passages
      const openPassages = [];
      if (!cell.walls.north) openPassages.push('north');
      if (!cell.walls.south) openPassages.push('south');
      if (!cell.walls.east) openPassages.push('east');
      if (!cell.walls.west) openPassages.push('west');
      
      // If 3+ passages, maybe block one to create more dead ends
      if (openPassages.length >= 3 && Math.random() < deadEndChance) {
        const blockDir = openPassages[Math.floor(Math.random() * openPassages.length)];
        
        switch (blockDir) {
          case 'north':
            cell.walls.north = true;
            if (y > 0) grid[y - 1][x].walls.south = true;
            break;
          case 'south':
            cell.walls.south = true;
            if (y < rows - 1) grid[y + 1][x].walls.north = true;
            break;
          case 'east':
            cell.walls.east = true;
            if (x < cols - 1) grid[y][x + 1].walls.west = true;
            break;
          case 'west':
            cell.walls.west = true;
            if (x > 0) grid[y][x - 1].walls.east = true;
            break;
        }
      }
    }
  }
}

/**
 * Converts the maze grid to thick boundary walls
 * 
 * Layout per cell (cellSize x cellSize):
 * - corridorWidth: the walkable passage
 * - wallThickness: the thickness of walls
 * 
 * Each cell is divided as: [wallThickness][corridorWidth][wallThickness]
 * But walls are shared between cells, so effectively:
 * - Cell interior (corridor) starts at wallThickness/2 and ends at cellSize - wallThickness/2
 * 
 * @param {Object} options - Configuration options
 * @param {Object} [options.startTexture] - Special texture for start cell walls
 * @param {Object} [options.endTexture] - Special texture for end cell walls
 */
function gridToBoundaries(grid, cellSize, wallThickness, wallTexture, curveTexture, curveChance, options = {}) {
  const boundaries = [];
  const rows = grid.length;
  const cols = grid[0].length;
  
  const halfWall = wallThickness / 2;
  const corridorWidth = cellSize - wallThickness;
  const curveRadius = halfWall;
  
  // Special textures for start and end cells
  const startTexture = options.startTexture || wallTexture;
  const endTexture = options.endTexture || wallTexture;
  const startCurveTexture = options.startTexture || curveTexture;
  const endCurveTexture = options.endTexture || curveTexture;
  
  // Start cell is at (0, 0), end cell is at (cols-1, rows-1)
  const startCellX = 0;
  const startCellY = 0;
  const endCellX = cols - 1;
  const endCellY = rows - 1;
  
  // For thick walls, we create wall segments on both sides of the logical wall position
  // A wall at grid position creates two parallel walls offset by halfWall
  
  // Process each cell
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[y][x];
      
      // Determine which texture to use based on cell position
      const isStartCell = (x === startCellX && y === startCellY);
      const isEndCell = (x === endCellX && y === endCellY);
      let cellWallTexture = wallTexture;
      let cellCurveTexture = curveTexture;
      
      if (isStartCell) {
        cellWallTexture = startTexture;
        cellCurveTexture = startCurveTexture;
      } else if (isEndCell) {
        cellWallTexture = endTexture;
        cellCurveTexture = endCurveTexture;
      }
      
      // Calculate cell bounds in world coordinates
      const cellLeft = x * cellSize;
      const cellTop = y * cellSize;
      const cellRight = (x + 1) * cellSize;
      const cellBottom = (y + 1) * cellSize;
      
      // Corridor bounds within cell
      const corridorLeft = cellLeft + halfWall;
      const corridorTop = cellTop + halfWall;
      const corridorRight = cellRight - halfWall;
      const corridorBottom = cellBottom - halfWall;
      
      // NORTH WALL - creates a wall segment along the top of the corridor
      if (cell.walls.north) {
        // Check for curves at corners
        const hasNWCurve = cell.walls.west && Math.random() < curveChance;
        const hasNECurve = cell.walls.east && Math.random() < curveChance;
        
        // Wall on the corridor side (inside of north wall)
        let wallStartX = corridorLeft;
        let wallEndX = corridorRight;
        
        if (hasNWCurve) {
          wallStartX = corridorLeft + curveRadius;
          // Add curve
          boundaries.push(createCurvedWall({
            centerX: corridorLeft + curveRadius,
            centerY: corridorTop + curveRadius,
            radius: curveRadius,
            startAngle: Math.PI,
            endAngle: Math.PI * 1.5,
            texture: cellCurveTexture
          }));
        }
        
        if (hasNECurve) {
          wallEndX = corridorRight - curveRadius;
          // Add curve
          boundaries.push(createCurvedWall({
            centerX: corridorRight - curveRadius,
            centerY: corridorTop + curveRadius,
            radius: curveRadius,
            startAngle: Math.PI * 1.5,
            endAngle: Math.PI * 2,
            texture: cellCurveTexture
          }));
        }
        
        if (wallEndX > wallStartX) {
          boundaries.push(new Boundaries({
            x1: wallStartX,
            y1: corridorTop,
            x2: wallEndX,
            y2: corridorTop,
            texture: cellWallTexture
          }));
        }
      }
      
      // SOUTH WALL
      if (cell.walls.south) {
        const hasSWCurve = cell.walls.west && Math.random() < curveChance;
        const hasSECurve = cell.walls.east && Math.random() < curveChance;
        
        let wallStartX = corridorLeft;
        let wallEndX = corridorRight;
        
        if (hasSWCurve) {
          wallStartX = corridorLeft + curveRadius;
          boundaries.push(createCurvedWall({
            centerX: corridorLeft + curveRadius,
            centerY: corridorBottom - curveRadius,
            radius: curveRadius,
            startAngle: Math.PI * 0.5,
            endAngle: Math.PI,
            texture: cellCurveTexture
          }));
        }
        
        if (hasSECurve) {
          wallEndX = corridorRight - curveRadius;
          boundaries.push(createCurvedWall({
            centerX: corridorRight - curveRadius,
            centerY: corridorBottom - curveRadius,
            radius: curveRadius,
            startAngle: 0,
            endAngle: Math.PI * 0.5,
            texture: cellCurveTexture
          }));
        }
        
        if (wallEndX > wallStartX) {
          boundaries.push(new Boundaries({
            x1: wallStartX,
            y1: corridorBottom,
            x2: wallEndX,
            y2: corridorBottom,
            texture: cellWallTexture
          }));
        }
      }
      
      // WEST WALL
      if (cell.walls.west) {
        let wallStartY = corridorTop;
        let wallEndY = corridorBottom;
        
        // Curves handled by north/south walls
        if (cell.walls.north) wallStartY = corridorTop + curveRadius;
        if (cell.walls.south) wallEndY = corridorBottom - curveRadius;
        
        if (wallEndY > wallStartY) {
          boundaries.push(new Boundaries({
            x1: corridorLeft,
            y1: wallStartY,
            x2: corridorLeft,
            y2: wallEndY,
            texture: cellWallTexture
          }));
        }
      }
      
      // EAST WALL
      if (cell.walls.east) {
        let wallStartY = corridorTop;
        let wallEndY = corridorBottom;
        
        if (cell.walls.north) wallStartY = corridorTop + curveRadius;
        if (cell.walls.south) wallEndY = corridorBottom - curveRadius;
        
        if (wallEndY > wallStartY) {
          boundaries.push(new Boundaries({
            x1: corridorRight,
            y1: wallStartY,
            x2: corridorRight,
            y2: wallEndY,
            texture: cellWallTexture
          }));
        }
      }
      
      // Add passage walls where there's an opening (creates the thick wall effect)
      // When a wall is OPEN (no wall), we need to add walls on the sides of the opening
      
      // North passage (opening to cell above)
      if (!cell.walls.north && y > 0) {
        // Left side of passage
        boundaries.push(new Boundaries({
          x1: corridorLeft,
          y1: cellTop,
          x2: corridorLeft,
          y2: corridorTop,
          texture: cellWallTexture
        }));
        // Right side of passage
        boundaries.push(new Boundaries({
          x1: corridorRight,
          y1: cellTop,
          x2: corridorRight,
          y2: corridorTop,
          texture: cellWallTexture
        }));
      }
      
      // South passage
      if (!cell.walls.south && y < rows - 1) {
        boundaries.push(new Boundaries({
          x1: corridorLeft,
          y1: corridorBottom,
          x2: corridorLeft,
          y2: cellBottom,
          texture: cellWallTexture
        }));
        boundaries.push(new Boundaries({
          x1: corridorRight,
          y1: corridorBottom,
          x2: corridorRight,
          y2: cellBottom,
          texture: cellWallTexture
        }));
      }
      
      // West passage
      if (!cell.walls.west && x > 0) {
        boundaries.push(new Boundaries({
          x1: cellLeft,
          y1: corridorTop,
          x2: corridorLeft,
          y2: corridorTop,
          texture: cellWallTexture
        }));
        boundaries.push(new Boundaries({
          x1: cellLeft,
          y1: corridorBottom,
          x2: corridorLeft,
          y2: corridorBottom,
          texture: cellWallTexture
        }));
      }
      
      // East passage
      if (!cell.walls.east && x < cols - 1) {
        boundaries.push(new Boundaries({
          x1: corridorRight,
          y1: corridorTop,
          x2: cellRight,
          y2: corridorTop,
          texture: cellWallTexture
        }));
        boundaries.push(new Boundaries({
          x1: corridorRight,
          y1: corridorBottom,
          x2: cellRight,
          y2: corridorBottom,
          texture: cellWallTexture
        }));
      }
    }
  }
  
  return boundaries;
}

/**
 * Analyzes a cell to determine what type of corridor it is
 * Returns: 'dead_end', 'straight_h', 'straight_v', 'corner', 'T', 'cross', 'room'
 */
function analyzeCellType(cell) {
  const openDirs = [];
  if (!cell.walls.north) openDirs.push('north');
  if (!cell.walls.south) openDirs.push('south');
  if (!cell.walls.east) openDirs.push('east');
  if (!cell.walls.west) openDirs.push('west');
  
  const count = openDirs.length;
  
  if (count === 1) return { type: 'dead_end', openDirs };
  if (count === 4) return { type: 'cross', openDirs };
  if (count === 3) return { type: 'T', openDirs };
  
  if (count === 2) {
    const hasNS = openDirs.includes('north') && openDirs.includes('south');
    const hasEW = openDirs.includes('east') && openDirs.includes('west');
    if (hasNS) return { type: 'straight_v', openDirs };
    if (hasEW) return { type: 'straight_h', openDirs };
    return { type: 'corner', openDirs };
  }
  
  return { type: 'room', openDirs };
}

/**
 * Gets the view direction for looking down a corridor
 */
function getViewDirectionForDir(dir) {
  switch (dir) {
    case 'north': return 270; // Looking up
    case 'south': return 90;  // Looking down
    case 'east': return 0;    // Looking right
    case 'west': return 180;  // Looking left
  }
  return 0;
}

/**
 * Gets opposite direction
 */
function getOppositeDir(dir) {
  switch (dir) {
    case 'north': return 'south';
    case 'south': return 'north';
    case 'east': return 'west';
    case 'west': return 'east';
  }
  return null;
}

/**
 * Gets delta for a direction
 */
function getDirDelta(dir) {
  switch (dir) {
    case 'north': return { dx: 0, dy: -1 };
    case 'south': return { dx: 0, dy: 1 };
    case 'east': return { dx: 1, dy: 0 };
    case 'west': return { dx: -1, dy: 0 };
  }
  return { dx: 0, dy: 0 };
}

/**
 * Finds a patrol path from a starting cell following corridors
 * Returns an array of {x, y} world positions
 */
function findPatrolPath(grid, startX, startY, cellSize, maxLength = 6) {
  const rows = grid.length;
  const cols = grid[0].length;
  const path = [];
  const visited = new Set();
  
  let x = startX;
  let y = startY;
  let lastDir = null;
  
  // Add starting position
  path.push({
    x: x * cellSize + cellSize * 0.5,
    y: y * cellSize + cellSize * 0.5
  });
  visited.add(`${x},${y}`);
  
  // Walk through corridors
  for (let step = 0; step < maxLength; step++) {
    const cell = getCell(grid, x, y);
    if (!cell) break;
    
    const { openDirs } = analyzeCellType(cell);
    
    // Find valid next directions (not going back)
    const oppositeDir = lastDir ? getOppositeDir(lastDir) : null;
    const validDirs = openDirs.filter(d => d !== oppositeDir);
    
    if (validDirs.length === 0) break;
    
    // Prefer going straight, then pick random
    let nextDir;
    if (lastDir && validDirs.includes(lastDir)) {
      nextDir = Math.random() > 0.3 ? lastDir : validDirs[Math.floor(Math.random() * validDirs.length)];
    } else {
      nextDir = validDirs[Math.floor(Math.random() * validDirs.length)];
    }
    
    // Move to next cell
    const delta = getDirDelta(nextDir);
    let newX = x + delta.dx;
    let newY = y + delta.dy;
    
    // Don't revisit cells
    if (visited.has(`${newX},${newY}`)) {
      // Try another direction
      const otherDirs = validDirs.filter(d => {
        const od = getDirDelta(d);
        return !visited.has(`${x + od.dx},${y + od.dy}`);
      });
      if (otherDirs.length === 0) break;
      nextDir = otherDirs[Math.floor(Math.random() * otherDirs.length)];
      const newDelta = getDirDelta(nextDir);
      newX = x + newDelta.dx;
      newY = y + newDelta.dy;
    }
    
    if (newX < 0 || newX >= cols || newY < 0 || newY >= rows) break;
    
    x = newX;
    y = newY;
    
    visited.add(`${x},${y}`);
    path.push({
      x: x * cellSize + cellSize * 0.5,
      y: y * cellSize + cellSize * 0.5
    });
    
    lastDir = nextDir;
  }
  
  return path;
}

/**
 * Converts a path to move stops (relative movements between points)
 */
function pathToMoveStops(path) {
  if (path.length < 2) return [];
  
  const moveStops = [];
  
  // Forward path
  for (let i = 1; i < path.length; i++) {
    moveStops.push({
      x: path[i].x - path[i - 1].x,
      y: path[i].y - path[i - 1].y
    });
  }
  
  // Return path (go back to start)
  for (let i = path.length - 2; i >= 0; i--) {
    moveStops.push({
      x: path[i].x - path[i + 1].x,
      y: path[i].y - path[i + 1].y
    });
  }
  
  return moveStops;
}

/**
 * Generates rotation stops based on path direction changes
 * Makes enemy look in direction of travel
 */
function pathToRotationStops(path, initialViewDir) {
  if (path.length < 2) return [];
  
  const rotationStops = [];
  let currentDir = initialViewDir;
  
  // Calculate directions for each segment
  const directions = [];
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    directions.push(angle);
  }
  
  // Return path directions
  for (let i = path.length - 2; i >= 0; i--) {
    const dx = path[i].x - path[i + 1].x;
    const dy = path[i].y - path[i + 1].y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    directions.push(angle);
  }
  
  // Calculate rotation stops (relative rotations)
  for (const targetDir of directions) {
    let delta = targetDir - currentDir;
    // Normalize to -180 to 180
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    rotationStops.push(delta);
    currentDir = targetDir;
  }
  
  return rotationStops;
}

/**
 * Places enemies in the maze with intelligent patrol routes
 * Enemies patrol corridors and guard key intersections
 */
function placeEnemies(grid, cellSize, wallThickness, texture, count, playerSpawn, directionalSprites = null) {
  const enemies = [];
  const rows = grid.length;
  const cols = grid[0].length;
  const minDistSq = (cellSize * 3) * (cellSize * 3); // Minimum distance from player spawn
  const minEnemyDistSq = (cellSize * 2.5) * (cellSize * 2.5); // Minimum distance between enemies
  
  // Analyze all cells and categorize them
  const intersections = []; // T-junctions and crosses (strategic points)
  const corridors = [];     // Long straight corridors (patrol routes)
  const corners = [];       // Corner spots (ambush points)
  const deadEnds = [];      // Dead ends (stationary guards)
  
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[y][x];
      const analysis = analyzeCellType(cell);
      const worldX = x * cellSize + cellSize * 0.5;
      const worldY = y * cellSize + cellSize * 0.5;
      
      // Check distance from player spawn
      const dx = worldX - playerSpawn.x;
      const dy = worldY - playerSpawn.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistSq) continue;
      
      const cellInfo = { x, y, worldX, worldY, ...analysis };
      
      switch (analysis.type) {
        case 'cross':
        case 'T':
          intersections.push(cellInfo);
          break;
        case 'straight_h':
        case 'straight_v':
          corridors.push(cellInfo);
          break;
        case 'corner':
          corners.push(cellInfo);
          break;
        case 'dead_end':
          deadEnds.push(cellInfo);
          break;
      }
    }
  }
  
  // Shuffle each category
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  };
  shuffle(intersections);
  shuffle(corridors);
  shuffle(corners);
  shuffle(deadEnds);
  
  const placedPositions = [];
  
  /**
   * Checks if a position is valid (not too close to other enemies)
   */
  function isValidPosition(worldX, worldY) {
    for (const pos of placedPositions) {
      const dx = worldX - pos.x;
      const dy = worldY - pos.y;
      if (dx * dx + dy * dy < minEnemyDistSq) return false;
    }
    return true;
  }
  
  // Consistent FOV for all maze enemies (use player FOV for balanced gameplay)
  const MAZE_ENEMY_FOV = PlayerConfig.baseFov;
  
  /**
   * Creates an enemy at the specified cell with patrol behavior
   */
  function createEnemy(cellInfo, enemyType) {
    if (!isValidPosition(cellInfo.worldX, cellInfo.worldY)) return null;
    
    placedPositions.push({ x: cellInfo.worldX, y: cellInfo.worldY });
    
    const id = 1000 + enemies.length;
    let moveStops = [];
    let rotationStops = [];
    let moveTime = 2 + Math.random() * 1.5;
    let rotationTime = 0.8 + Math.random() * 0.5;
    let initialViewDir;
    let visibilityDistance = cellSize * 1; // Reduced detection range
    let fov = MAZE_ENEMY_FOV; // Consistent FOV for all maze enemies
    
    switch (enemyType) {
      case 'patrol': {
        // Patrolling enemy - walks along corridors
        const path = findPatrolPath(grid, cellInfo.x, cellInfo.y, cellSize, 3 + Math.floor(Math.random() * 4));
        if (path.length >= 2) {
          moveStops = pathToMoveStops(path);
          const firstDx = path[1].x - path[0].x;
          const firstDy = path[1].y - path[0].y;
          initialViewDir = Math.atan2(firstDy, firstDx) * 180 / Math.PI;
          rotationStops = pathToRotationStops(path, initialViewDir);
          moveTime = 1.5 + Math.random() * 1;
          rotationTime = 0.5;
        } else {
          // Fallback to looking around
          initialViewDir = getViewDirectionForDir(cellInfo.openDirs[0]);
          rotationStops = [90, 90, 90, 90];
          rotationTime = 2;
        }
        visibilityDistance = cellSize * 2;
        break;
      }
      
      case 'guard': {
        // Stationary guard at intersection - looks in multiple directions
        initialViewDir = getViewDirectionForDir(cellInfo.openDirs[0]);
        
        // Create a looking pattern based on open directions
        const lookAngles = cellInfo.openDirs.map(d => getViewDirectionForDir(d));
        rotationStops = [];
        let currentAngle = initialViewDir;
        for (const targetAngle of lookAngles) {
          let delta = targetAngle - currentAngle;
          while (delta > 180) delta -= 360;
          while (delta < -180) delta += 360;
          rotationStops.push(delta);
          currentAngle = targetAngle;
        }
        // Return to initial
        let returnDelta = initialViewDir - currentAngle;
        while (returnDelta > 180) returnDelta -= 360;
        while (returnDelta < -180) returnDelta += 360;
        if (Math.abs(returnDelta) > 1) rotationStops.push(returnDelta);
        
        rotationTime = 1.5 + Math.random();
        visibilityDistance = cellSize * 2.5;
        break;
      }
      
      case 'ambush': {
        // Corner ambusher - faces into corridor, occasionally peeks
        const lookDirs = cellInfo.openDirs;
        initialViewDir = getViewDirectionForDir(lookDirs[0]);
        const secondDir = getViewDirectionForDir(lookDirs[1] || lookDirs[0]);
        
        let delta = secondDir - initialViewDir;
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;
        
        rotationStops = [delta, -delta]; // Look one way, then the other
        rotationTime = 2 + Math.random() * 1.5;
        break;
      }
      
      case 'sentry': {
        // Dead-end sentry - faces the only exit, watches carefully
        const exitDir = cellInfo.openDirs[0];
        initialViewDir = getViewDirectionForDir(exitDir);
        
        // Small head movements
        rotationStops = [15, -30, 15]; // Slight left-right scanning
        rotationTime = 2.5 + Math.random();
        visibilityDistance = cellSize * 3; // Longer sight line for sentries
        break;
      }
    }
    
    return new EnemyClass({
      x: cellInfo.worldX,
      y: cellInfo.worldY,
      viewDirection: initialViewDir,
      fov,
      rayCount: 3,
      visibilityDistance,
      texture,
      directionalSprites: directionalSprites,
      id,
      moveStops: moveStops.length > 0 ? moveStops : [],
      moveTime,
      repeatMovement: moveStops.length > 0,
      rotationStops,
      rotationTime,
      repeatRotation: true
    });
  }
  
  // Distribute enemy types strategically
  // Priority: patrol corridors > guard intersections > ambush corners > sentry dead-ends
  
  let enemiesPlaced = 0;
  
  // Place patrolling enemies in corridors (35% of enemies)
  const numPatrols = Math.ceil(count * 0.35);
  for (let i = 0; i < numPatrols && enemiesPlaced < count; i++) {
    const cell = corridors[i % (corridors.length || 1)];
    if (!cell) continue;
    const enemy = createEnemy(cell, 'patrol');
    if (enemy) {
      enemies.push(enemy);
      enemiesPlaced++;
    }
  }
  
  // Place guards at intersections (25% of enemies)
  const numGuards = Math.ceil(count * 0.25);
  for (let i = 0; i < numGuards && enemiesPlaced < count; i++) {
    const cell = intersections[i % (intersections.length || 1)];
    if (!cell) continue;
    const enemy = createEnemy(cell, 'guard');
    if (enemy) {
      enemies.push(enemy);
      enemiesPlaced++;
    }
  }
  
  // Place ambushers at corners (25% of enemies)
  const numAmbush = Math.ceil(count * 0.25);
  for (let i = 0; i < numAmbush && enemiesPlaced < count; i++) {
    const cell = corners[i % (corners.length || 1)];
    if (!cell) continue;
    const enemy = createEnemy(cell, 'ambush');
    if (enemy) {
      enemies.push(enemy);
      enemiesPlaced++;
    }
  }
  
  // Place sentries at dead-ends (15% of enemies)
  const numSentries = Math.ceil(count * 0.15);
  for (let i = 0; i < numSentries && enemiesPlaced < count; i++) {
    const cell = deadEnds[i % (deadEnds.length || 1)];
    if (!cell) continue;
    const enemy = createEnemy(cell, 'sentry');
    if (enemy) {
      enemies.push(enemy);
      enemiesPlaced++;
    }
  }
  
  // Fill remaining spots with random placements
  const allCells = [...corridors, ...intersections, ...corners, ...deadEnds];
  shuffle(allCells);
  for (let i = 0; enemiesPlaced < count && i < allCells.length; i++) {
    const cell = allCells[i];
    const types = ['patrol', 'guard', 'ambush', 'sentry'];
    const enemy = createEnemy(cell, types[Math.floor(Math.random() * types.length)]);
    if (enemy) {
      enemies.push(enemy);
      enemiesPlaced++;
    }
  }
  
  console.log(`Placed ${enemies.length} enemies: patrols, guards, ambushers, sentries`);
  
  return enemies;
}

/**
 * Creates a procedurally generated maze map with thick walls
 * 
 * @param {Textures} textures - Texture manager
 * @param {string} name - Name of the map
 * @param {Object} options - Configuration options
 * @param {number} [options.cols=15] - Number of columns
 * @param {number} [options.rows=15] - Number of rows
 * @param {number} [options.cellSize=120] - Size of each cell in world units
 * @param {number} [options.wallThickness=20] - Thickness of walls
 * @param {number} [options.curveChance=1.0] - Probability of curved corners (0-1)
 * @param {number} [options.loopChance=0.15] - Probability of extra passages (creates loops)
 * @param {number} [options.roomCount=3] - Number of open rooms to create
 * @param {number} [options.roomMinSize=2] - Minimum room size in cells
 * @param {number} [options.roomMaxSize=4] - Maximum room size in cells
 * @param {number} [options.enemyCount=8] - Number of enemies to place
 * @returns {GameMap} The generated maze map
 */
function createMazeMap(textures, name, options = {}) {
  // Merge options with defaults from config
  const defaults = MazeConfig.defaults;
  const cols = options.cols || defaults.cols;
  const rows = options.rows || defaults.rows;
  const cellSize = options.cellSize || defaults.cellSize;
  const wallThickness = options.wallThickness || defaults.wallThickness;
  const curveChance = options.curveChance !== undefined ? options.curveChance : defaults.curveChance;
  const loopChance = options.loopChance !== undefined ? options.loopChance : defaults.loopChance;
  const roomCount = options.roomCount !== undefined ? options.roomCount : defaults.roomCount;
  const roomMinSize = options.roomMinSize || defaults.roomMinSize;
  const roomMaxSize = options.roomMaxSize || defaults.roomMaxSize;
  const enemyCount = options.enemyCount !== undefined ? options.enemyCount : defaults.enemyCount;
  
  const wallTexture = textures.getTexture("wall");
  const curveTexture = wallTexture;
  
  // Special texture for start and end cells (uses the alternate texture)
  const specialCellTexture = textures.getTexture("edge") || wallTexture;
  
  // 8-directional individual sprites (new system)
  // Index: 0=front, 1=front-left, 2=left, 3=back-left, 4=back
  // Right-side views mirror left-side sprites
  const directionalSprites = [
    textures.getTexture("enemySprite0"),  // Front
    textures.getTexture("enemySprite1"),  // Front-left
    textures.getTexture("enemySprite2"),  // Left
    textures.getTexture("enemySprite3"),  // Back-left
    textures.getTexture("enemySprite4")   // Back
  ];
  
  // Use the first sprite as the default texture for the boundary
  const enemyTexture = directionalSprites[0];
  
  // Create and generate base maze
  const grid = createGrid(cols, rows);
  generateMaze(grid);
  
  // Add loops to create multiple paths
  addLoops(grid, loopChance);
  
  // Create open rooms
  const rooms = createRooms(grid, roomCount, roomMinSize, roomMaxSize);
  
  // Convert to boundaries with thick walls
  // Use special texture for start (top-left) and end (bottom-right) cells
  const boundaries = gridToBoundaries(grid, cellSize, wallThickness, wallTexture, curveTexture, curveChance, {
    startTexture: specialCellTexture,
    endTexture: specialCellTexture
  });
  
  // Spawn player in center of top-left cell
  const spawnLocation = {
    x: cellSize * 0.5,
    y: cellSize * 0.5
  };
  
  // Place enemies
  const enemies = placeEnemies(grid, cellSize, wallThickness, enemyTexture, enemyCount, spawnLocation, directionalSprites);
  
  // Create map
  const mapWidth = cols * cellSize;
  const mapHeight = rows * cellSize;
  
  const mazeMap = new GameMap(name, mapWidth, mapHeight, spawnLocation);
  mazeMap.addBoundaries(boundaries);
  mazeMap.addEnemies(enemies);
  
  // Set up start zone (top-left cell) and goal zone (bottom-right cell)
  const halfWall = wallThickness / 2;
  const corridorWidth = cellSize - wallThickness;
  const zoneRadius = corridorWidth * 0.4;
  
  // Start zone in center of first cell - using StartZone class
  const startX = cellSize * 0.5;
  const startY = cellSize * 0.5;
  mazeMap.setStartZone(new StartZone({ x: startX, y: startY, radius: zoneRadius, spawnDirection: 135 })); // Face toward center
  
  // Goal zone in center of last cell (bottom-right corner) - using GoalZone class
  const goalX = (cols - 1) * cellSize + cellSize * 0.5;
  const goalY = (rows - 1) * cellSize + cellSize * 0.5;
  mazeMap.setGoalZone(new GoalZone({ x: goalX, y: goalY, radius: zoneRadius, onReached: () => {
    console.log('Maze completed!');
  }}));
  
  // Store maze data for pathfinding
  mazeMap.mazeData = {
    grid: grid,
    cols: cols,
    rows: rows,
    cellSize: cellSize
  };
  
  // Add floor zones only for start and goal positions
  mazeMap.floorZones = [
    // Start zone - cyan/blue pulsing floor marker
    {
      x: startX,
      y: startY,
      radius: zoneRadius * 1.2,
      type: 'start',
      intensity: 1.0
    },
    // Goal zone - green pulsing floor marker
    {
      x: goalX,
      y: goalY,
      radius: zoneRadius * 1.2,
      type: 'goal',
      intensity: 1.0
    }
  ];
  
  console.log(`Maze generated: ${cols}x${rows} grid, ${boundaries.length} walls, ${enemies.length} enemies, ${rooms.length} rooms`);
  console.log(`Start zone: (${spawnLocation.x}, ${spawnLocation.y}), Goal zone: (${goalX}, ${goalY})`);
  
  return mazeMap;
}

/**
 * Finds a path through the maze using BFS (Breadth-First Search)
 * Returns world coordinates of the path from start through playerPos to goal
 * 
 * @param {Object} mazeData - The maze data {grid, cols, rows, cellSize}
 * @param {Object} startPos - World coordinates {x, y} of start position
 * @param {Object} playerPos - World coordinates {x, y} of player position
 * @param {Object} goalPos - World coordinates {x, y} of goal position
 * @returns {Array|null} Array of world coordinate points [{x, y}] or null if no path
 */
function findMazePath(mazeData, startPos, playerPos, goalPos) {
  if (!mazeData || !mazeData.grid) return null;
  
  const { grid, cols, rows, cellSize } = mazeData;
  
  // Convert world coordinates to grid coordinates
  function worldToGrid(worldX, worldY) {
    return {
      x: Math.floor(worldX / cellSize),
      y: Math.floor(worldY / cellSize)
    };
  }
  
  // Convert grid coordinates to world coordinates (center of cell)
  function gridToWorld(gridX, gridY) {
    return {
      x: gridX * cellSize + cellSize * 0.5,
      y: gridY * cellSize + cellSize * 0.5
    };
  }
  
  // Get cell at grid position
  function getCell(x, y) {
    if (y < 0 || y >= rows || x < 0 || x >= cols) return null;
    return grid[y][x];
  }
  
  // BFS to find path between two grid positions
  function bfsPath(fromGrid, toGrid) {
    const visited = new Set();
    const queue = [{ x: fromGrid.x, y: fromGrid.y, path: [] }];
    visited.add(`${fromGrid.x},${fromGrid.y}`);
    
    while (queue.length > 0) {
      const current = queue.shift();
      const currentPath = [...current.path, { x: current.x, y: current.y }];
      
      // Check if we reached the goal
      if (current.x === toGrid.x && current.y === toGrid.y) {
        return currentPath;
      }
      
      const cell = getCell(current.x, current.y);
      if (!cell) continue;
      
      // Check all four directions
      const directions = [
        { dx: 0, dy: -1, wall: 'north' },  // North
        { dx: 0, dy: 1, wall: 'south' },   // South
        { dx: 1, dy: 0, wall: 'east' },    // East
        { dx: -1, dy: 0, wall: 'west' }    // West
      ];
      
      for (const dir of directions) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;
        const key = `${nx},${ny}`;
        
        // Skip if already visited or out of bounds
        if (visited.has(key)) continue;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        
        // Check if there's a wall blocking this direction
        if (cell.walls[dir.wall]) continue;
        
        visited.add(key);
        queue.push({ x: nx, y: ny, path: currentPath });
      }
    }
    
    return null; // No path found
  }
  
  // Convert positions to grid coordinates
  const startGrid = worldToGrid(startPos.x, startPos.y);
  const playerGrid = worldToGrid(playerPos.x, playerPos.y);
  const goalGrid = worldToGrid(goalPos.x, goalPos.y);
  
  // Find path from start to player
  const pathToPlayer = bfsPath(startGrid, playerGrid);
  if (!pathToPlayer) return null;
  
  // Find path from player to goal
  const pathToGoal = bfsPath(playerGrid, goalGrid);
  if (!pathToGoal) return null;
  
  // Combine paths (remove duplicate player position)
  const combinedPath = [...pathToPlayer, ...pathToGoal.slice(1)];
  
  // Convert grid path to world coordinates
  return combinedPath.map(p => gridToWorld(p.x, p.y));
}

export { createMazeMap, findMazePath };
