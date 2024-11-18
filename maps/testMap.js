import Boundaries from "../classes/BoundariesClass.js";
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
  const wallTexture = textures.getTexture("wall");
  const edgeTexture = textures.getTexture("edge");
  const mapWidth = 1900;
  const mapHeight = 1080;

  // // Add canvas boundaries
  boundaries.push(new Boundaries(0, 0, mapWidth, 0, edgeTexture));
  boundaries.push(new Boundaries(0, 0, 0, mapHeight, edgeTexture));
  boundaries.push(new Boundaries(0, mapHeight, mapWidth, mapHeight, edgeTexture));
  boundaries.push(new Boundaries(mapWidth, 0, mapWidth, mapHeight, edgeTexture));

  const circularChamberValues = {
    centerX: mapWidth / 2.5,
    centerY: mapHeight / 2,
    radius: 105,
    segments: 4,
    texture: wallTexture,
    arcAngle: Math.PI / 3.18,
  }

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

  //Create west corridor
  boundaries.push(new Boundaries(mapWidth / 2.5 - 100, mapHeight / 2 + 30, mapWidth / 6 - 60, mapHeight / 2 + 30, wallTexture));
  boundaries.push(new Boundaries(mapWidth / 2.5 - 100, mapHeight / 2 - 30, mapWidth / 6, mapHeight / 2 - 30, wallTexture));
  boundaries.push(new Boundaries(mapWidth / 6 - 60, mapHeight / 2 + 30, mapWidth / 6 - 60, mapHeight / 4, wallTexture));
  boundaries.push(new Boundaries(mapWidth / 6, mapHeight / 2 - 30, mapWidth / 6, mapHeight / 4, wallTexture));
  boundaries.push(new Boundaries(mapWidth / 6 - 60, mapHeight / 4, mapWidth / 6, mapHeight / 4, wallTexture));

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


  const testMap = new GameMap(name, mapWidth, mapHeight, { x: mapWidth / 6 - 30, y: mapHeight / 4 + 20 });
  testMap.addBoundaries(boundaries);

  return testMap;
}

export { createTestMap };