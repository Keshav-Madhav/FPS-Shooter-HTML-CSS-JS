import Boundaries from "../classes/BoundariesClass.js";
import GameMap from "../classes/GameMapClass.js";
import { createCurvedWall } from "../utils/WallGenerators.js";

/**
 * Creates a showcase/test map demonstrating all wall types and features
 * 
 * Features are spread out in distinct areas for easy viewing
 * 
 * @param {Textures} textures - Texture manager
 * @param {string} name - Name of the map
 * @returns {GameMap} The showcase map
 */
function createShowcaseMap(textures, name) {
  const boundaries = [];
  const mapWidth = 2400;
  const mapHeight = 2400;
  
  const wallTexture = textures.getTexture("wall");
  const edgeTexture = textures.getTexture("edge");
  
  // ========================================
  // AREA 1: TEXTURED WALLS (Northwest)
  // Position: (200, 200)
  // ========================================
  
  // Small textured room
  boundaries.push(new Boundaries({
    x1: 100, y1: 100,
    x2: 350, y2: 100,
    texture: wallTexture
  }));
  
  boundaries.push(new Boundaries({
    x1: 350, y1: 100,
    x2: 350, y2: 300,
    texture: edgeTexture
  }));
  
  boundaries.push(new Boundaries({
    x1: 350, y1: 300,
    x2: 100, y2: 300,
    texture: wallTexture
  }));
  
  boundaries.push(new Boundaries({
    x1: 100, y1: 300,
    x2: 100, y2: 100,
    texture: edgeTexture
  }));
  
  // ========================================
  // AREA 2: BRIGHT COLORED WALLS (North-Center)
  // Position: (800, 200)
  // ========================================
  
  // Bright red wall
  boundaries.push(new Boundaries({
    x1: 650, y1: 100,
    x2: 850, y2: 100,
    texture: null,
    options: { color: '#ff3333' }
  }));
  
  // Bright green wall
  boundaries.push(new Boundaries({
    x1: 900, y1: 100,
    x2: 900, y2: 300,
    texture: null,
    options: { color: '#33ff33' }
  }));
  
  // Bright blue wall
  boundaries.push(new Boundaries({
    x1: 950, y1: 200,
    x2: 1100, y2: 200,
    texture: null,
    options: { color: '#3333ff' }
  }));
  
  // Bright yellow wall
  boundaries.push(new Boundaries({
    x1: 750, y1: 250,
    x2: 750, y2: 400,
    texture: null,
    options: { color: '#ffff33' }
  }));
  
  // ========================================
  // AREA 3: DARK COLORED WALLS (Northeast)
  // Position: (1600, 200)
  // ========================================
  
  // Dark purple wall
  boundaries.push(new Boundaries({
    x1: 1500, y1: 100,
    x2: 1700, y2: 100,
    texture: null,
    options: { color: '#550055' }
  }));
  
  // Dark teal wall
  boundaries.push(new Boundaries({
    x1: 1750, y1: 100,
    x2: 1750, y2: 300,
    texture: null,
    options: { color: '#005555' }
  }));
  
  // Dark maroon wall
  boundaries.push(new Boundaries({
    x1: 1800, y1: 200,
    x2: 2000, y2: 200,
    texture: null,
    options: { color: '#550000' }
  }));
  
  // Dark forest green
  boundaries.push(new Boundaries({
    x1: 1600, y1: 250,
    x2: 1600, y2: 400,
    texture: null,
    options: { color: '#004400' }
  }));
  
  // ========================================
  // AREA 4: TRANSPARENT WALLS (West)
  // Position: (200, 700)
  // ========================================
  
  // Semi-transparent cyan wall
  boundaries.push(new Boundaries({
    x1: 100, y1: 600,
    x2: 300, y2: 600,
    texture: null,
    options: { color: 'rgba(0, 255, 255, 0.5)', isTransparent: true }
  }));
  
  // Semi-transparent magenta wall
  boundaries.push(new Boundaries({
    x1: 350, y1: 600,
    x2: 350, y2: 850,
    texture: null,
    options: { color: 'rgba(255, 0, 255, 0.5)', isTransparent: true }
  }));
  
  // Semi-transparent yellow wall
  boundaries.push(new Boundaries({
    x1: 100, y1: 900,
    x2: 300, y2: 900,
    texture: null,
    options: { color: 'rgba(255, 255, 0, 0.3)', isTransparent: true }
  }));
  
  // Very transparent white wall (ghostly)
  boundaries.push(new Boundaries({
    x1: 150, y1: 700,
    x2: 250, y2: 800,
    texture: null,
    options: { color: 'rgba(255, 255, 255, 0.15)', isTransparent: true }
  }));
  
  // Transparent red
  boundaries.push(new Boundaries({
    x1: 100, y1: 1000,
    x2: 300, y2: 1000,
    texture: null,
    options: { color: 'rgba(255, 50, 50, 0.4)', isTransparent: true }
  }));
  
  // ========================================
  // AREA 5: MOVING WALLS (Center-West)
  // Position: (700, 700)
  // ========================================
  
  // Horizontally sliding wall
  boundaries.push(new Boundaries({
    x1: 600, y1: 600,
    x2: 750, y2: 600,
    texture: wallTexture,
    options: {
      moveStops: [
        { x: 150, y: 0 },
        { x: -150, y: 0 }
      ],
      moveTime: 2,
      repeatMovement: true
    }
  }));
  
  // Vertically sliding wall
  boundaries.push(new Boundaries({
    x1: 900, y1: 550,
    x2: 900, y2: 700,
    texture: edgeTexture,
    options: {
      moveStops: [
        { x: 0, y: 150 },
        { x: 0, y: -150 }
      ],
      moveTime: 1.5,
      repeatMovement: true
    }
  }));
  
  // Diagonally sliding wall (orange)
  boundaries.push(new Boundaries({
    x1: 600, y1: 800,
    x2: 720, y2: 800,
    texture: null,
    options: {
      color: '#ff6600',
      moveStops: [
        { x: 100, y: 100 },
        { x: -100, y: -100 }
      ],
      moveTime: 2.5,
      repeatMovement: true
    }
  }));
  
  // Square path moving wall
  boundaries.push(new Boundaries({
    x1: 750, y1: 900,
    x2: 850, y2: 900,
    texture: null,
    options: {
      color: '#00aaff',
      moveStops: [
        { x: 100, y: 0 },
        { x: 0, y: 100 },
        { x: -100, y: 0 },
        { x: 0, y: -100 }
      ],
      moveTime: 1,
      repeatMovement: true
    }
  }));
  
  // ========================================
  // AREA 6: ROTATING WALLS (Center)
  // Position: (1200, 700)
  // ========================================
  
  // Slowly spinning wall
  boundaries.push(new Boundaries({
    x1: 1100, y1: 650,
    x2: 1250, y2: 650,
    texture: wallTexture,
    options: {
      rotationStops: [90, 90, 90, 90],
      rotationTime: 2,
      repeatRotation: true
    }
  }));
  
  // Fast spinning wall (cyan)
  boundaries.push(new Boundaries({
    x1: 1350, y1: 550,
    x2: 1350, y2: 750,
    texture: null,
    options: {
      color: '#00ffff',
      rotationStops: [180, 180],
      rotationTime: 0.5,
      repeatRotation: true
    }
  }));
  
  // Oscillating wall (magenta)
  boundaries.push(new Boundaries({
    x1: 1100, y1: 850,
    x2: 1200, y2: 850,
    texture: null,
    options: {
      color: '#ff00ff',
      rotationStops: [60, -120, 60],
      rotationTime: 1,
      repeatRotation: true
    }
  }));
  
  // Triple spinner
  boundaries.push(new Boundaries({
    x1: 1300, y1: 900,
    x2: 1400, y2: 900,
    texture: null,
    options: {
      color: '#ffaa00',
      rotationStops: [120, 120, 120],
      rotationTime: 0.8,
      repeatRotation: true
    }
  }));
  
  // ========================================
  // AREA 7: SWIVELING DOORS (Center-East)
  // Position: (1700, 700)
  // ========================================
  
  // Single door with frame
  boundaries.push(new Boundaries({
    x1: 1600, y1: 550,
    x2: 1600, y2: 700,
    texture: wallTexture
  }));
  
  boundaries.push(new Boundaries({
    x1: 1750, y1: 550,
    x2: 1750, y2: 700,
    texture: wallTexture
  }));
  
  // Swinging door
  boundaries.push(new Boundaries({
    x1: 1600, y1: 625,
    x2: 1740, y2: 625,
    texture: edgeTexture,
    options: {
      rotationStops: [85, -85],
      rotationTime: 2,
      repeatRotation: true
    }
  }));
  
  // Double door setup
  boundaries.push(new Boundaries({
    x1: 1850, y1: 550,
    x2: 1850, y2: 700,
    texture: wallTexture
  }));
  
  boundaries.push(new Boundaries({
    x1: 2050, y1: 550,
    x2: 2050, y2: 700,
    texture: wallTexture
  }));
  
  // Left door panel (brown)
  boundaries.push(new Boundaries({
    x1: 1850, y1: 625,
    x2: 1950, y2: 625,
    texture: null,
    options: {
      color: '#884422',
      rotationStops: [-80, 80],
      rotationTime: 2.5,
      repeatRotation: true
    }
  }));
  
  // Right door panel (brown)
  boundaries.push(new Boundaries({
    x1: 2050, y1: 625,
    x2: 1950, y2: 625,
    texture: null,
    options: {
      color: '#884422',
      rotationStops: [80, -80],
      rotationTime: 2.5,
      repeatRotation: true
    }
  }));
  
  // Revolving door
  boundaries.push(new Boundaries({
    x1: 1650, y1: 850,
    x2: 1750, y2: 850,
    texture: null,
    options: {
      color: '#4488aa',
      rotationStops: [90, 90, 90, 90],
      rotationTime: 1,
      repeatRotation: true
    }
  }));
  
  boundaries.push(new Boundaries({
    x1: 1700, y1: 800,
    x2: 1700, y2: 900,
    texture: null,
    options: {
      color: '#4488aa',
      rotationStops: [90, 90, 90, 90],
      rotationTime: 1,
      repeatRotation: true
    }
  }));
  
  // ========================================
  // AREA 8: STATIC CURVED WALLS (Southwest)
  // Position: (300, 1400)
  // ========================================
  
  // Quarter circle (textured)
  boundaries.push(createCurvedWall({
    centerX: 200,
    centerY: 1400,
    radius: 120,
    startAngle: 0,
    endAngle: Math.PI * 0.5,
    texture: wallTexture
  }));
  
  // Half circle (different texture)
  boundaries.push(createCurvedWall({
    centerX: 450,
    centerY: 1450,
    radius: 80,
    startAngle: Math.PI,
    endAngle: Math.PI * 2,
    texture: edgeTexture
  }));
  
  // Green curved wall
  boundaries.push(createCurvedWall({
    centerX: 200,
    centerY: 1650,
    radius: 100,
    startAngle: Math.PI * 0.5,
    endAngle: Math.PI * 1.5,
    texture: null,
    color: '#00ff88'
  }));
  
  // Full circle (small)
  boundaries.push(createCurvedWall({
    centerX: 400,
    centerY: 1700,
    radius: 50,
    startAngle: 0,
    endAngle: Math.PI * 2,
    texture: null,
    color: '#ff4488'
  }));
  
  // ========================================
  // AREA 9: ANIMATED CURVED WALLS (South-Center)
  // Position: (900, 1400)
  // ========================================
  
  // Rotating curved wall
  const rotatingCurve = createCurvedWall({
    centerX: 900,
    centerY: 1450,
    radius: 100,
    startAngle: 0,
    endAngle: Math.PI * 0.75,
    texture: null,
    color: '#ff8800'
  });
  rotatingCurve.rotationStops = [90, 90, 90, 90];
  rotatingCurve.rotationTime = 2;
  rotatingCurve.repeatRotation = true;
  rotatingCurve.isRotating = true;
  rotatingCurve.isAnimated = true;
  rotatingCurve.currentRotationIndex = 0;
  rotatingCurve.rotationAccumulatedTime = 0;
  rotatingCurve.lastRotationFrameTime = performance.now() * 0.001;
  rotatingCurve.currentAngle = 0;
  rotatingCurve.initialAngle = 0;
  rotatingCurve.targetAngle = 90;
  boundaries.push(rotatingCurve);
  
  // Moving curved wall
  const movingCurve = createCurvedWall({
    centerX: 1150,
    centerY: 1450,
    radius: 70,
    startAngle: Math.PI,
    endAngle: Math.PI * 1.5,
    texture: wallTexture
  });
  movingCurve.moveStops = [
    { x: 0, y: 150 },
    { x: 0, y: -150 }
  ];
  movingCurve.moveTime = 3;
  movingCurve.repeatMovement = true;
  movingCurve.isMoving = true;
  movingCurve.isAnimated = true;
  movingCurve.currentMoveIndex = 0;
  movingCurve.moveAccumulatedTime = 0;
  movingCurve.lastMoveFrameTime = performance.now() * 0.001;
  movingCurve._initialCenterX = 1150;
  movingCurve._initialCenterY = 1450;
  movingCurve.currentPos = { x: 1150, y: 1450 };
  movingCurve.targetPos = { x: 1150, y: 1600 };
  boundaries.push(movingCurve);
  
  // Another rotating curve (faster)
  const fastRotatingCurve = createCurvedWall({
    centerX: 900,
    centerY: 1700,
    radius: 80,
    startAngle: 0,
    endAngle: Math.PI,
    texture: null,
    color: '#00ffaa'
  });
  fastRotatingCurve.rotationStops = [180, 180];
  fastRotatingCurve.rotationTime = 1;
  fastRotatingCurve.repeatRotation = true;
  fastRotatingCurve.isRotating = true;
  fastRotatingCurve.isAnimated = true;
  fastRotatingCurve.currentRotationIndex = 0;
  fastRotatingCurve.rotationAccumulatedTime = 0;
  fastRotatingCurve.lastRotationFrameTime = performance.now() * 0.001;
  fastRotatingCurve.currentAngle = 0;
  fastRotatingCurve.initialAngle = 0;
  fastRotatingCurve.targetAngle = 180;
  boundaries.push(fastRotatingCurve);
  
  // ========================================
  // AREA 10: RAINBOW SPINNER (Southeast)
  // Position: (1700, 1500)
  // ========================================
  
  const spiralCenter = { x: 1700, y: 1500 };
  const spiralArms = 8;
  const spiralRadius = 150;
  
  for (let i = 0; i < spiralArms; i++) {
    const angle = (i / spiralArms) * Math.PI * 2;
    const hue = (i / spiralArms) * 360;
    
    const x1 = spiralCenter.x + Math.cos(angle) * 40;
    const y1 = spiralCenter.y + Math.sin(angle) * 40;
    const x2 = spiralCenter.x + Math.cos(angle) * spiralRadius;
    const y2 = spiralCenter.y + Math.sin(angle) * spiralRadius;
    
    boundaries.push(new Boundaries({
      x1, y1, x2, y2,
      texture: null,
      options: {
        color: `hsl(${hue}, 100%, 50%)`,
        rotationStops: [45, 45, 45, 45, 45, 45, 45, 45],
        rotationTime: 0.3,
        repeatRotation: true
      }
    }));
  }
  
  // ========================================
  // AREA 11: PENDULUM OBSTACLES (East)
  // Position: (2000, 1200)
  // ========================================
  
  for (let i = 0; i < 5; i++) {
    boundaries.push(new Boundaries({
      x1: 2000, y1: 1050 + i * 120,
      x2: 2000, y2: 1150 + i * 120,
      texture: null,
      options: {
        color: `hsl(${i * 60}, 80%, 50%)`,
        rotationStops: [40, -80, 40],
        rotationTime: 1.2 + i * 0.2,
        repeatRotation: true
      }
    }));
  }
  
  // ========================================
  // AREA 12: CRUSHING WALLS (South)
  // Position: (600, 1900)
  // ========================================
  
  // Left crusher
  boundaries.push(new Boundaries({
    x1: 500, y1: 1850,
    x2: 500, y2: 1950,
    texture: null,
    options: {
      color: '#ff0000',
      moveStops: [
        { x: 120, y: 0 },
        { x: -120, y: 0 }
      ],
      moveTime: 0.8,
      repeatMovement: true
    }
  }));
  
  // Right crusher
  boundaries.push(new Boundaries({
    x1: 750, y1: 1850,
    x2: 750, y2: 1950,
    texture: null,
    options: {
      color: '#ff0000',
      moveStops: [
        { x: -120, y: 0 },
        { x: 120, y: 0 }
      ],
      moveTime: 0.8,
      repeatMovement: true
    }
  }));
  
  // Top crusher
  boundaries.push(new Boundaries({
    x1: 550, y1: 2000,
    x2: 700, y2: 2000,
    texture: null,
    options: {
      color: '#ff4400',
      moveStops: [
        { x: 0, y: 100 },
        { x: 0, y: -100 }
      ],
      moveTime: 1,
      repeatMovement: true
    }
  }));
  
  // Bottom crusher
  boundaries.push(new Boundaries({
    x1: 550, y1: 2200,
    x2: 700, y2: 2200,
    texture: null,
    options: {
      color: '#ff4400',
      moveStops: [
        { x: 0, y: -100 },
        { x: 0, y: 100 }
      ],
      moveTime: 1,
      repeatMovement: true
    }
  }));
  
  // ========================================
  // AREA 13: MIXED CORRIDOR (Far South)
  // Position: (1200, 2100)
  // ========================================
  
  const corridorY = 2100;
  const segmentWidth = 180;
  
  // Textured section
  boundaries.push(new Boundaries({
    x1: 1000, y1: corridorY,
    x2: 1000 + segmentWidth, y2: corridorY,
    texture: wallTexture
  }));
  
  // Colored section
  boundaries.push(new Boundaries({
    x1: 1200, y1: corridorY,
    x2: 1200 + segmentWidth, y2: corridorY,
    texture: null,
    options: { color: '#ff6600' }
  }));
  
  // Transparent section
  boundaries.push(new Boundaries({
    x1: 1400, y1: corridorY,
    x2: 1400 + segmentWidth, y2: corridorY,
    texture: null,
    options: { color: 'rgba(0, 150, 255, 0.4)', isTransparent: true }
  }));
  
  // Moving section
  boundaries.push(new Boundaries({
    x1: 1600, y1: corridorY,
    x2: 1600 + segmentWidth, y2: corridorY,
    texture: edgeTexture,
    options: {
      moveStops: [
        { x: 0, y: -50 },
        { x: 0, y: 50 }
      ],
      moveTime: 1.5,
      repeatMovement: true
    }
  }));
  
  // Rotating section
  boundaries.push(new Boundaries({
    x1: 1800, y1: corridorY,
    x2: 1800 + segmentWidth, y2: corridorY,
    texture: null,
    options: {
      color: '#aa00ff',
      rotationStops: [180, 180],
      rotationTime: 2,
      repeatRotation: true
    }
  }));
  
  // Curved end
  boundaries.push(createCurvedWall({
    centerX: 2050,
    centerY: corridorY,
    radius: 60,
    startAngle: -Math.PI * 0.5,
    endAngle: Math.PI * 0.5,
    texture: wallTexture
  }));
  
  // ========================================
  // CREATE MAP
  // ========================================
  
  const spawnLocation = { x: 1200, y: 1200 };
  
  const showcaseMap = new GameMap(name, mapWidth, mapHeight, spawnLocation);
  showcaseMap.addBoundaries(boundaries);
  showcaseMap.userViewDirection = 0;
  
  console.log(`Showcase map created: ${boundaries.length} walls with various features (${mapWidth}x${mapHeight})`);
  
  return showcaseMap;
}

export { createShowcaseMap };
