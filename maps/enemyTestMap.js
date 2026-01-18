import Boundaries from "../classes/BoundariesClass.js";
import EnemyClass from "../classes/EnemyClass.js";
import GameMap from "../classes/GameMapClass.js";

/**
 * Creates an enemy testing map with various enemy configurations
 * 
 * Features:
 * - Different FOVs (narrow to wide)
 * - Different detection ranges (short to long)
 * - Various animation patterns (rotation, movement, patrol)
 * - Wall-blocked enemies for line-of-sight testing
 * - All rooms have entry points
 * 
 * @param {Textures} textures - Texture manager
 * @param {string} name - Name of the map
 * @returns {GameMap} The enemy testing map
 */
function createEnemyTestMap(textures, name) {
  const boundaries = [];
  const enemies = [];
  const mapWidth = 2000;
  const mapHeight = 1600;
  
  const wallTexture = textures.getTexture("wall");
  const edgeTexture = textures.getTexture("edge");
  
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
  
  let enemyId = 100;
  
  // ========================================
  // OUTER WALLS (with gaps for movement)
  // ========================================
  
  // North wall
  boundaries.push(new Boundaries({
    x1: 0, y1: 0,
    x2: mapWidth, y2: 0,
    texture: wallTexture
  }));
  
  // South wall
  boundaries.push(new Boundaries({
    x1: 0, y1: mapHeight,
    x2: mapWidth, y2: mapHeight,
    texture: wallTexture
  }));
  
  // West wall
  boundaries.push(new Boundaries({
    x1: 0, y1: 0,
    x2: 0, y2: mapHeight,
    texture: edgeTexture
  }));
  
  // East wall
  boundaries.push(new Boundaries({
    x1: mapWidth, y1: 0,
    x2: mapWidth, y2: mapHeight,
    texture: edgeTexture
  }));
  
  // ========================================
  // AREA 1: FOV TESTING (Northwest)
  // Row of enemies with progressively wider FOVs
  // ENTRY: Open from south
  // ========================================
  
  // Back wall
  boundaries.push(new Boundaries({
    x1: 100, y1: 100,
    x2: 700, y2: 100,
    texture: wallTexture
  }));
  
  // Side walls with gap at bottom
  boundaries.push(new Boundaries({
    x1: 100, y1: 100,
    x2: 100, y2: 300,
    texture: null,
    options: { color: '#ff4444' } // Red marker
  }));
  
  boundaries.push(new Boundaries({
    x1: 700, y1: 100,
    x2: 700, y2: 300,
    texture: edgeTexture
  }));
  
  // FOV test enemies - narrow to wide (20° to 160°)
  const fovValues = [20, 45, 70, 100, 130, 160];
  for (let i = 0; i < fovValues.length; i++) {
    enemies.push(new EnemyClass({
      x: 180 + i * 85,
      y: 200,
      viewDirection: 90, // Facing down toward entrance
      fov: fovValues[i],
      rayCount: 3,
      visibilityDistance: 250,
      texture: enemyTexture,
      directionalSprites: directionalSprites,
      id: enemyId++
    }));
  }
  
  // ========================================
  // AREA 2: RANGE TESTING (Northeast)
  // Enemies with different detection ranges
  // ENTRY: Open from west side
  // ========================================
  
  // Top wall
  boundaries.push(new Boundaries({
    x1: 900, y1: 100,
    x2: 1800, y2: 100,
    texture: wallTexture
  }));
  
  // Bottom wall
  boundaries.push(new Boundaries({
    x1: 900, y1: 350,
    x2: 1800, y2: 350,
    texture: wallTexture
  }));
  
  // Right wall (closed)
  boundaries.push(new Boundaries({
    x1: 1800, y1: 100,
    x2: 1800, y2: 350,
    texture: edgeTexture
  }));
  
  // Entry marker on left (green)
  boundaries.push(new Boundaries({
    x1: 900, y1: 100,
    x2: 900, y2: 150,
    texture: null,
    options: { color: '#44ff44' }
  }));
  
  // Range test enemies - short to long range (at end of corridor)
  const rangeValues = [100, 200, 350, 500, 700];
  for (let i = 0; i < rangeValues.length; i++) {
    enemies.push(new EnemyClass({
      x: 1700,
      y: 150 + i * 40,
      viewDirection: 180, // Facing left toward entrance
      fov: 50,
      rayCount: 3,
      visibilityDistance: rangeValues[i],
      texture: enemyTexture,
      directionalSprites: directionalSprites,
      id: enemyId++
    }));
  }
  
  // ========================================
  // AREA 3: ROTATING ENEMIES (West-Center)
  // Enemies with different rotation patterns
  // ENTRY: Open from east side
  // ========================================
  
  // Top wall
  boundaries.push(new Boundaries({
    x1: 100, y1: 450,
    x2: 550, y2: 450,
    texture: wallTexture
  }));
  
  // Bottom wall
  boundaries.push(new Boundaries({
    x1: 100, y1: 800,
    x2: 550, y2: 800,
    texture: wallTexture
  }));
  
  // Left wall (closed)
  boundaries.push(new Boundaries({
    x1: 100, y1: 450,
    x2: 100, y2: 800,
    texture: null,
    options: { color: '#4444ff' } // Blue marker
  }));
  
  // Right side open for entry
  
  // Slow 360 scanner
  enemies.push(new EnemyClass({
    x: 200,
    y: 550,
    viewDirection: 0,
    fov: 50,
    rayCount: 3,
    visibilityDistance: 200,
    rotationStops: [90, 90, 90, 90],
    rotationTime: 3,
    repeatRotation: true,
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // Fast 360 scanner
  enemies.push(new EnemyClass({
    x: 350,
    y: 550,
    viewDirection: 0,
    fov: 60,
    rayCount: 3,
    visibilityDistance: 180,
    rotationStops: [90, 90, 90, 90],
    rotationTime: 0.5,
    repeatRotation: true,
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // Oscillating sweeper
  enemies.push(new EnemyClass({
    x: 200,
    y: 700,
    viewDirection: 0,
    fov: 70,
    rayCount: 3,
    visibilityDistance: 220,
    rotationStops: [120, -240, 120],
    rotationTime: 2,
    repeatRotation: true,
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // Irregular pattern
  enemies.push(new EnemyClass({
    x: 450,
    y: 700,
    viewDirection: 270,
    fov: 65,
    rayCount: 3,
    visibilityDistance: 180,
    rotationStops: [45, 90, -180, 45],
    rotationTime: 1.5,
    repeatRotation: true,
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // ========================================
  // AREA 4: PATROLLING ENEMIES (Center)
  // Enemies with movement patterns
  // ENTRY: Open from north and south
  // ========================================
  
  // Left wall
  boundaries.push(new Boundaries({
    x1: 650, y1: 500,
    x2: 650, y2: 850,
    texture: edgeTexture
  }));
  
  // Right wall
  boundaries.push(new Boundaries({
    x1: 1050, y1: 500,
    x2: 1050, y2: 850,
    texture: edgeTexture
  }));
  
  // Label marker (yellow)
  boundaries.push(new Boundaries({
    x1: 650, y1: 500,
    x2: 700, y2: 500,
    texture: null,
    options: { color: '#ffff44' }
  }));
  
  // Horizontal patroller
  enemies.push(new EnemyClass({
    x: 750,
    y: 580,
    viewDirection: 0,
    fov: 60,
    rayCount: 3,
    visibilityDistance: 200,
    moveStops: [
      { x: 200, y: 0 },
      { x: -200, y: 0 }
    ],
    moveTime: 2.5,
    repeatMovement: true,
    rotationStops: [180, 180],
    rotationTime: 0.3,
    repeatRotation: true,
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // Vertical patroller
  enemies.push(new EnemyClass({
    x: 850,
    y: 600,
    viewDirection: 90,
    fov: 55,
    rayCount: 3,
    visibilityDistance: 180,
    moveStops: [
      { x: 0, y: 150 },
      { x: 0, y: -150 }
    ],
    moveTime: 2,
    repeatMovement: true,
    rotationStops: [180, 180],
    rotationTime: 0.3,
    repeatRotation: true,
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // Square patrol
  enemies.push(new EnemyClass({
    x: 950,
    y: 675,
    viewDirection: 0,
    fov: 70,
    rayCount: 3,
    visibilityDistance: 150,
    moveStops: [
      { x: 60, y: 0 },
      { x: 0, y: 100 },
      { x: -60, y: 0 },
      { x: 0, y: -100 }
    ],
    moveTime: 1.2,
    repeatMovement: true,
    rotationStops: [90, 90, 90, 90],
    rotationTime: 0.3,
    repeatRotation: true,
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // ========================================
  // AREA 5: LINE OF SIGHT TESTING (East-Center)
  // Enemies behind partial walls and pillars
  // ENTRY: Open from west
  // ========================================
  
  // Top wall
  boundaries.push(new Boundaries({
    x1: 1150, y1: 450,
    x2: 1800, y2: 450,
    texture: wallTexture
  }));
  
  // Bottom wall
  boundaries.push(new Boundaries({
    x1: 1150, y1: 850,
    x2: 1800, y2: 850,
    texture: wallTexture
  }));
  
  // Right wall (closed)
  boundaries.push(new Boundaries({
    x1: 1800, y1: 450,
    x2: 1800, y2: 850,
    texture: edgeTexture
  }));
  
  // Entry marker (magenta)
  boundaries.push(new Boundaries({
    x1: 1150, y1: 450,
    x2: 1150, y2: 500,
    texture: null,
    options: { color: '#ff44ff' }
  }));
  
  // Blocking pillar
  boundaries.push(new Boundaries({
    x1: 1300, y1: 580,
    x2: 1300, y2: 680,
    texture: wallTexture
  }));
  
  // Enemy behind pillar
  enemies.push(new EnemyClass({
    x: 1250,
    y: 630,
    viewDirection: 0,
    fov: 90,
    rayCount: 3,
    visibilityDistance: 350,
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // Horizontal blocking wall
  boundaries.push(new Boundaries({
    x1: 1400, y1: 550,
    x2: 1550, y2: 550,
    texture: wallTexture
  }));
  
  // Enemy behind horizontal wall
  enemies.push(new EnemyClass({
    x: 1475,
    y: 520,
    viewDirection: 270,
    fov: 80,
    rayCount: 3,
    visibilityDistance: 300,
    rotationStops: [60, -120, 60],
    rotationTime: 2,
    repeatRotation: true,
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // L-shaped cover
  boundaries.push(new Boundaries({
    x1: 1600, y1: 650,
    x2: 1600, y2: 780,
    texture: edgeTexture
  }));
  
  boundaries.push(new Boundaries({
    x1: 1600, y1: 780,
    x2: 1720, y2: 780,
    texture: wallTexture
  }));
  
  // Enemy in L-cover
  enemies.push(new EnemyClass({
    x: 1680,
    y: 700,
    viewDirection: 180,
    fov: 75,
    rayCount: 3,
    visibilityDistance: 280,
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // Two pillars with patrolling enemy
  boundaries.push(new Boundaries({
    x1: 1350, y1: 750,
    x2: 1380, y2: 820,
    texture: edgeTexture
  }));
  
  boundaries.push(new Boundaries({
    x1: 1480, y1: 750,
    x2: 1510, y2: 820,
    texture: edgeTexture
  }));
  
  // Enemy patrolling between pillars
  enemies.push(new EnemyClass({
    x: 1415,
    y: 785,
    viewDirection: 0,
    fov: 60,
    rayCount: 3,
    visibilityDistance: 220,
    moveStops: [
      { x: 80, y: 0 },
      { x: -80, y: 0 }
    ],
    moveTime: 2,
    repeatMovement: true,
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // ========================================
  // AREA 6: EXTREME CASES (South)
  // Wide FOV, narrow FOV, fast/slow rotators
  // ENTRY: Open from north
  // ========================================
  
  // Left wall
  boundaries.push(new Boundaries({
    x1: 100, y1: 1000,
    x2: 100, y2: 1400,
    texture: null,
    options: { color: '#ffffff' } // White marker
  }));
  
  // Right wall
  boundaries.push(new Boundaries({
    x1: 1100, y1: 1000,
    x2: 1100, y2: 1400,
    texture: edgeTexture
  }));
  
  // Bottom wall
  boundaries.push(new Boundaries({
    x1: 100, y1: 1400,
    x2: 1100, y2: 1400,
    texture: wallTexture
  }));
  
  // Nearly 360° FOV enemy (short range)
  enemies.push(new EnemyClass({
    x: 200,
    y: 1200,
    viewDirection: 0,
    fov: 340,
    rayCount: 3,
    visibilityDistance: 100, // Short range to balance
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // Very narrow FOV enemy (long range)
  enemies.push(new EnemyClass({
    x: 400,
    y: 1200,
    viewDirection: 0,
    fov: 10,
    rayCount: 3,
    visibilityDistance: 500,
    rotationStops: [180, 180],
    rotationTime: 4, // Slow sweep
    repeatRotation: true,
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // Very fast rotator
  enemies.push(new EnemyClass({
    x: 600,
    y: 1200,
    viewDirection: 0,
    fov: 45,
    rayCount: 3,
    visibilityDistance: 180,
    rotationStops: [45, 45, 45, 45, 45, 45, 45, 45],
    rotationTime: 0.12,
    repeatRotation: true,
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // Very slow rotator
  enemies.push(new EnemyClass({
    x: 800,
    y: 1200,
    viewDirection: 0,
    fov: 90,
    rayCount: 3,
    visibilityDistance: 200,
    rotationStops: [90, 90, 90, 90],
    rotationTime: 5,
    repeatRotation: true,
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // Fast patroller
  enemies.push(new EnemyClass({
    x: 1000,
    y: 1200,
    viewDirection: 0,
    fov: 55,
    rayCount: 3,
    visibilityDistance: 160,
    moveStops: [
      { x: 60, y: 0 },
      { x: 0, y: 120 },
      { x: -60, y: 0 },
      { x: 0, y: -120 }
    ],
    moveTime: 0.4,
    repeatMovement: true,
    rotationStops: [90, 90, 90, 90],
    rotationTime: 0.15,
    repeatRotation: true,
    texture: enemyTexture,
    directionalSprites: directionalSprites,
    id: enemyId++
  }));
  
  // ========================================
  // SPAWN AREA (Center - marked safe zone)
  // ========================================
  
  // Transparent spawn markers (no collision)
  boundaries.push(new Boundaries({
    x1: 1200, y1: 1000,
    x2: 1400, y2: 1000,
    texture: null,
    options: { color: 'rgba(100, 255, 100, 0.3)', isTransparent: true }
  }));
  
  boundaries.push(new Boundaries({
    x1: 1200, y1: 1250,
    x2: 1400, y2: 1250,
    texture: null,
    options: { color: 'rgba(100, 255, 100, 0.3)', isTransparent: true }
  }));
  
  // ========================================
  // CREATE MAP
  // ========================================
  
  const spawnLocation = { x: 1300, y: 1125 };
  
  const enemyTestMap = new GameMap(name, mapWidth, mapHeight, spawnLocation);
  enemyTestMap.addBoundaries(boundaries);
  enemyTestMap.addEnemies(enemies);
  enemyTestMap.userViewDirection = 270; // Face left
  
  // Set minimap for good overview
  enemyTestMap.setMinimapSettings({
    scale: 0.35,
    radius: 350
  });
  
  console.log(`Enemy Test Map created: ${boundaries.length} walls, ${enemies.length} enemies (${mapWidth}x${mapHeight})`);
  
  return enemyTestMap;
}

export { createEnemyTestMap };
