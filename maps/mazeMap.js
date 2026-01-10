import Boundaries from "../classes/BoundariesClass.js";
import EnemyClass from "../classes/EnemyClass.js";
import GameMap from "../classes/GameMapClass.js";
import Textures from "../classes/TexturesClass.js";
import { createCurvedWall } from "../utils/WallGenerators.js";

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
 */
function gridToBoundaries(grid, cellSize, wallThickness, wallTexture, curveTexture, curveChance) {
  const boundaries = [];
  const rows = grid.length;
  const cols = grid[0].length;
  
  const halfWall = wallThickness / 2;
  const corridorWidth = cellSize - wallThickness;
  const curveRadius = halfWall;
  
  // For thick walls, we create wall segments on both sides of the logical wall position
  // A wall at grid position creates two parallel walls offset by halfWall
  
  // Process each cell
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[y][x];
      
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
            texture: curveTexture
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
            texture: curveTexture
          }));
        }
        
        if (wallEndX > wallStartX) {
          boundaries.push(new Boundaries({
            x1: wallStartX,
            y1: corridorTop,
            x2: wallEndX,
            y2: corridorTop,
            texture: wallTexture
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
            texture: curveTexture
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
            texture: curveTexture
          }));
        }
        
        if (wallEndX > wallStartX) {
          boundaries.push(new Boundaries({
            x1: wallStartX,
            y1: corridorBottom,
            x2: wallEndX,
            y2: corridorBottom,
            texture: wallTexture
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
            texture: wallTexture
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
            texture: wallTexture
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
          texture: wallTexture
        }));
        // Right side of passage
        boundaries.push(new Boundaries({
          x1: corridorRight,
          y1: cellTop,
          x2: corridorRight,
          y2: corridorTop,
          texture: wallTexture
        }));
      }
      
      // South passage
      if (!cell.walls.south && y < rows - 1) {
        boundaries.push(new Boundaries({
          x1: corridorLeft,
          y1: corridorBottom,
          x2: corridorLeft,
          y2: cellBottom,
          texture: wallTexture
        }));
        boundaries.push(new Boundaries({
          x1: corridorRight,
          y1: corridorBottom,
          x2: corridorRight,
          y2: cellBottom,
          texture: wallTexture
        }));
      }
      
      // West passage
      if (!cell.walls.west && x > 0) {
        boundaries.push(new Boundaries({
          x1: cellLeft,
          y1: corridorTop,
          x2: corridorLeft,
          y2: corridorTop,
          texture: wallTexture
        }));
        boundaries.push(new Boundaries({
          x1: cellLeft,
          y1: corridorBottom,
          x2: corridorLeft,
          y2: corridorBottom,
          texture: wallTexture
        }));
      }
      
      // East passage
      if (!cell.walls.east && x < cols - 1) {
        boundaries.push(new Boundaries({
          x1: corridorRight,
          y1: corridorTop,
          x2: cellRight,
          y2: corridorTop,
          texture: wallTexture
        }));
        boundaries.push(new Boundaries({
          x1: corridorRight,
          y1: corridorBottom,
          x2: cellRight,
          y2: corridorBottom,
          texture: wallTexture
        }));
      }
    }
  }
  
  return boundaries;
}

/**
 * Places enemies in the maze
 */
function placeEnemies(grid, cellSize, wallThickness, texture, count, playerSpawn) {
  const enemies = [];
  const rows = grid.length;
  const cols = grid[0].length;
  const minDistSq = (cellSize * 4) * (cellSize * 4);
  
  const positions = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const worldX = x * cellSize + cellSize * 0.5;
      const worldY = y * cellSize + cellSize * 0.5;
      
      const dx = worldX - playerSpawn.x;
      const dy = worldY - playerSpawn.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq >= minDistSq) {
        positions.push({ x: worldX, y: worldY });
      }
    }
  }
  
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  
  const numEnemies = Math.min(count, positions.length);
  for (let i = 0; i < numEnemies; i++) {
    const pos = positions[i];
    
    enemies.push(new EnemyClass({
      x: pos.x,
      y: pos.y,
      viewDirection: Math.random() * 360,
      fov: 70,
      rayCount: 3,
      visibilityDistance: cellSize * 3,
      texture,
      id: 1000 + i,
      rotationStops: Math.random() > 0.6 ? [90, 90, 90, 90] : [],
      rotationTime: 1.5 + Math.random() * 2,
      repeatRotation: true
    }));
  }
  
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
  const cols = options.cols || 15;
  const rows = options.rows || 15;
  const cellSize = options.cellSize || 120;
  const wallThickness = options.wallThickness || 20;
  const curveChance = options.curveChance !== undefined ? options.curveChance : 1.0;
  const loopChance = options.loopChance !== undefined ? options.loopChance : 0.15;
  const roomCount = options.roomCount !== undefined ? options.roomCount : 3;
  const roomMinSize = options.roomMinSize || 2;
  const roomMaxSize = options.roomMaxSize || 4;
  const enemyCount = options.enemyCount !== undefined ? options.enemyCount : 8;
  
  const wallTexture = textures.getTexture("wall");
  const curveTexture = wallTexture;
  const enemyTexture = textures.getTexture("cacoDemon");
  
  // Create and generate base maze
  const grid = createGrid(cols, rows);
  generateMaze(grid);
  
  // Add loops to create multiple paths
  addLoops(grid, loopChance);
  
  // Create open rooms
  const rooms = createRooms(grid, roomCount, roomMinSize, roomMaxSize);
  
  // Convert to boundaries with thick walls
  const boundaries = gridToBoundaries(grid, cellSize, wallThickness, wallTexture, curveTexture, curveChance);
  
  // Spawn player in center of top-left cell
  const spawnLocation = {
    x: cellSize * 0.5,
    y: cellSize * 0.5
  };
  
  // Place enemies
  const enemies = placeEnemies(grid, cellSize, wallThickness, enemyTexture, enemyCount, spawnLocation);
  
  // Create map
  const mapWidth = cols * cellSize;
  const mapHeight = rows * cellSize;
  
  const mazeMap = new GameMap(name, mapWidth, mapHeight, spawnLocation);
  mazeMap.addBoundaries(boundaries);
  mazeMap.addEnemies(enemies);
  
  console.log(`Maze generated: ${cols}x${rows} grid, ${boundaries.length} walls, ${enemies.length} enemies, ${rooms.length} rooms`);
  
  return mazeMap;
}

export { createMazeMap };
