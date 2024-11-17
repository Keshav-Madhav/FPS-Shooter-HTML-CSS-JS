// Class to create boundaries
class Boundaries {
  constructor(x1, y1, x2, y2, texture){
    this.a = {x: x1, y: y1};
    this.b = {x: x2, y: y2};
    this.texture = texture;
  }
}

export default Boundaries;