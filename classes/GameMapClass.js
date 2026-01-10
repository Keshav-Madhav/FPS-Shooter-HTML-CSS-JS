import Boundaries from "./BoundariesClass.js";
import EnemyClass from "./EnemyClass.js";

/**
 * @typedef {Object} Size
 * @property {number} width - The width of the map
 * @property {number} height - The height of the map
 */

/**
 * @typedef {Object} Location
 * @property {number} x - The x coordinate
 * @property {number} y - The y coordinate
 */

/**
 * Class representing a game map.
 * @class
 */
class GameMap {
  /**
   * Create a game map.
   * @param {string} name - The name of the map
   * @param {number} width - The width of the map
   * @param {number} height - The height of the map
   * @param {Location} spawnLocation - The initial spawn location for the user
   */
  constructor(name, width, height, spawnLocation) {
    this.name = name;
    this.size = {
      width: width,
      height: height
    };
    this.userSpawnLocation = {
      x: spawnLocation.x,
      y: spawnLocation.y
    };
    this.userViewDirection = 90;
    this.boundaries = [];
    this.enemies = [];
    
    // Goal zone (optional - for maze completion)
    this.goalZone = null;
  }
  
  /**
   * Set the goal zone for the map
   * @param {Object} zone - The goal zone with x, y, radius
   */
  setGoalZone(zone) {
    this.goalZone = zone;
  }
  
  /**
   * Check if a position is within the goal zone
   * @param {number} x - X coordinate to check
   * @param {number} y - Y coordinate to check
   * @returns {boolean} True if position is in goal zone
   */
  isInGoalZone(x, y) {
    if (!this.goalZone) return false;
    const dx = x - this.goalZone.x;
    const dy = y - this.goalZone.y;
    return (dx * dx + dy * dy) <= (this.goalZone.radius * this.goalZone.radius);
  }

  /**
   * Add a single enemy to the map.
   * @param {EnemyClass} enemy - The enemy object to add
   * @returns {void}
  */
  addEnemy(enemy) {
    this.enemies.push(enemy);
  }

  /**
   * Add multiple enemies to the map.
   * @param {EnemyClass[]} enemyArray - Array of enemy objects to add
   * @returns {void}
  */ 
  addEnemies(enemyArray) {
    this.enemies.push(...enemyArray);
  }

  /**
   * Get all enemies on the map.
   * @returns {EnemyClass[]} Array of all enemy objects
  */ 
  getEnemies() {
    return this.enemies;
  }

  /**
   * Add a single boundary to the map.
   * @param {Boundaries} boundary - The boundary object to add
   * @returns {void}
   */
  addBoundary(boundary) {
    this.boundaries.push(boundary);
  }

  /**
   * Add multiple boundaries to the map.
   * @param {Boundaries[]} boundaryArray - Array of boundary objects to add
   * @returns {void}
   */
  addBoundaries(boundaryArray) {
    this.boundaries.push(...boundaryArray);
  }

  /**
   * Get all boundaries on the map.
   * @returns {Boundaries[]} Array of all boundary objects
   */
  getBoundaries() {
    return this.boundaries;
  }

  /**
   * Get the user spawn location.
   * @returns {Location} The spawn location coordinates
   */
  getSpawnLocation() {
    return this.userSpawnLocation;
  }

  /**
   * Get the map dimensions.
   * @returns {Size} The map width and height
   */
  getSize() {
    return this.size;
  }
}

export default GameMap;