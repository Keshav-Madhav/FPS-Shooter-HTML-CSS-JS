class GameMap {
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
  }

  addBoundary(boundary) {
    this.boundaries.push(boundary);
  }

  addBoundaries(boundaryArray) {
    this.boundaries.push(...boundaryArray);
  }

  getBoundaries() {
    return this.boundaries;
  }

  getSpawnLocation() {
    return this.userSpawnLocation;
  }

  getSize() {
    return this.size;
  }
}

export default GameMap;