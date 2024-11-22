import Boundaries from "../classes/BoundariesClass.js";
import EnemyClass from "../classes/EnemyClass.js";
import GameMap from "../classes/GameMapClass.js";
import Textures from "../classes/TexturesClass.js";
import { createCircle, createCorridor, createBoundaryPath } from "../utils/WallGenerators.js";

/**
 * Creates a test map with various rooms and corridors for testing purposes.
 * @param {Textures[]} textures 
 * @param {string} name
 * @returns {GameMap}
 */
function createTestMap(textures, name) {
  const boundaries = [];
  const enemies = [];
  const wallTexture = textures.getTexture("wall");
  const edgeTexture = textures.getTexture("edge");
  const mapWidth = 1900;
  const mapHeight = 1080;

  const circularChamberValues = {
    centerX: mapWidth / 2.5,
    centerY: mapHeight / 2,
    radius: 105,
    segments: 4,
    texture: wallTexture,
    arcAngle: Math.PI / 3.18,
  }

  const centerBoundary = new Boundaries({
    x1: circularChamberValues.centerX - circularChamberValues.radius,
    y1: circularChamberValues.centerY,
    x2: circularChamberValues.centerX + circularChamberValues.radius,
    y2: circularChamberValues.centerY,
    texture: wallTexture
  });
  boundaries.push(centerBoundary);

  for(let i = 1; i < 5; i++){
    const startAngle = Math.PI * (1.093 + (i * 0.5))
    boundaries.push(...createCircle({...circularChamberValues, startAngle}));
  }

  // Create four corridors extending from the central circle
  const corridors = [
    // North corridor
    createCorridor({
      startX: mapWidth / 2.5,
      startY: mapHeight / 2 - 100,
      endX: mapWidth / 2.5,
      endY: mapHeight / 4,
      width: 60,
      texture: wallTexture
    }),

    // South corridor
    createCorridor({
      startX: mapWidth / 2.5,
      startY: mapHeight / 2 + 100,
      endX: mapWidth / 2.5,
      endY: (mapHeight * 3) / 4,
      width: 60,
      texture: wallTexture
    }),

    // East corridor
    createCorridor({
      startX: mapWidth / 2.5 + 100,
      startY: mapHeight / 2,
      endX: (mapWidth * 3) / 4.5,
      endY: mapHeight / 2,
      width: 60,
      texture: wallTexture
    }),
  ];
  corridors.forEach(corridor => boundaries.push(...corridor));

  // Create west corridor
  boundaries.push(new Boundaries({
    x1: mapWidth / 2.5 - 100,
    y1: mapHeight / 2 + 30,
    x2: mapWidth / 6 - 60,
    y2: mapHeight / 2 + 30,
    texture: wallTexture
  }));
  boundaries.push(new Boundaries({
    x1: mapWidth / 2.5 - 100,
    y1: mapHeight / 2 - 30,
    x2: mapWidth / 6,
    y2: mapHeight / 2 - 30,
    texture: wallTexture
  }));
  boundaries.push(new Boundaries({
    x1: mapWidth / 6 - 60,
    y1: mapHeight / 2 + 30,
    x2: mapWidth / 6 - 60,
    y2: mapHeight / 4,
    texture: wallTexture
  }));
  boundaries.push(new Boundaries({
    x1: mapWidth / 6,
    y1: mapHeight / 2 - 30,
    x2: mapWidth / 6,
    y2: mapHeight / 4,
    texture: wallTexture
  }));
  boundaries.push(new Boundaries({
    x1: mapWidth / 6 - 60,
    y1: mapHeight / 4,
    x2: mapWidth / 6,
    y2: mapHeight / 4,
    texture: wallTexture
  }));

  const rooms = [
    // North room
    createBoundaryPath({
      vertices: [
        { x: mapWidth / 2.5 - 30, y: mapHeight / 4 },
        { x: mapWidth / 2.5 - 160, y: mapHeight / 4 },
        { x: mapWidth / 2.5 - 160, y: mapHeight / 4 - 230 },
        { x: mapWidth / 2.5 + 160, y: mapHeight / 4 - 230 },
        { x: mapWidth / 2.5 + 160, y: mapHeight / 4 },
        { x: mapWidth / 2.5 + 30, y: mapHeight / 4 }
      ],
      texture: wallTexture,
    }),

    // South room (larger)
    createBoundaryPath({
      vertices: [
        { x: mapWidth / 2.5 + 30, y: (mapHeight * 3) / 4 },
        { x: mapWidth / 2.5 + 100, y: (mapHeight * 3) / 4 },
        { x: mapWidth / 2.5 + 100, y: (mapHeight * 3) / 4 + 120 },
        { x: mapWidth / 2.5 - 100, y: (mapHeight * 3) / 4 + 120 },
        { x: mapWidth / 2.5 - 100, y: (mapHeight * 3) / 4 },
        { x: mapWidth / 2.5 - 30, y: (mapHeight * 3) / 4 }
      ],
      texture: wallTexture,
    }),

    // East room (circular)
    createCircle({
      centerX: (mapWidth * 3) / 4.5 + 197,
      centerY: mapHeight / 2,
      radius: 200,
      segments: 30,
      texture: wallTexture,
      startAngle: Math.PI * 1.048,
      arcAngle: Math.PI * 1.904
    }),
  ];
  rooms.forEach(room => boundaries.push(...room));

  // Add enemies

  enemies.push(new EnemyClass({
    x: mapWidth / 2.5,
    y: mapHeight / 2,
    viewDirection: Math.PI, // Facing left
    fov: 60,
    rayCount: 3,
  }));

  // Enemy in the north room
  enemies.push(new EnemyClass({
    x: mapWidth / 2.5,
    y: mapHeight / 4 - 115,
    viewDirection: Math.PI / 2, // Facing down
    fov: 45,
    rayCount: 2,
  }));

  // Enemy in the south room
  enemies.push(new EnemyClass({
    x: mapWidth / 2.5,
    y: (mapHeight * 3) / 4 + 60,
    viewDirection: -Math.PI / 2, // Facing up
    fov: 45,
    rayCount: 2,
  }));

  // Enemy in the east circular room
  enemies.push(new EnemyClass({
    x: (mapWidth * 3) / 4.5 + 197,
    y: mapHeight / 2,
    viewDirection: Math.PI, // Facing left
    fov: 90,
    rayCount: 4,
  }));

  // Enemy in the west corridor
  enemies.push(new EnemyClass({
    x: mapWidth / 6 - 30,
    y: mapHeight / 2 - 15,
    viewDirection: 0, // Facing right
    visibilityDistance: 200,
    fov: 35,
    rayCount: 2,
    rotationStops: [0, 90, 0, 90, 0, 90, 0, 90],
    rotationTime: 2,
    repeatRotation: true,
    moveStops: [
      { x: 300, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 30 },
      { x: 0, y: 0 },
      { x: -300, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: -30 },
      { x: 0, y: 0 }
    ],
    moveTime: 2,
    repeatMovement: true,
  }));

  // Patrolling enemy in the east corridor
  enemies.push(new EnemyClass({
    x: (mapWidth * 3) / 4.5 - 100,
    y: mapHeight / 2,
    viewDirection: 0, // Facing right
    fov: 70,
    rayCount: 3
  }));

  const testMap = new GameMap(name, mapWidth, mapHeight, { x: mapWidth / 6 - 30, y: mapHeight / 4 + 20 });
  testMap.addBoundaries(boundaries);
  testMap.addEnemies(enemies);

  return testMap;
}

export { createTestMap };