class Textures {
  constructor() {
    this.textures = {};
    this.loadedCount = 0;
    this.totalTextures = 0;
    this.onAllLoaded = null;
  }

  /**
   * Adds a texture to the collection and tracks its loading state.
   * @param {string} key - Unique identifier for the texture.
   * @param {string} src - Source URL for the texture image.
   */
  addTexture(key, src) {
    const img = new Image();
    img.src = src;
    this.textures[key] = img;
    this.totalTextures++;

    img.onload = () => {
      this.loadedCount++;
      if (this.loadedCount === this.totalTextures && typeof this.onAllLoaded === 'function') {
        this.onAllLoaded();
      }
    };
  }

  /**
   * Retrieves a texture by its key.
   * @param {string} key - The key of the texture to retrieve.
   * @returns {HTMLImageElement} - The texture image.
   */
  getTexture(key) {
    return this.textures[key];
  }

  /**
   * Sets a callback function to be called when all textures are loaded.
   * @param {Function} callback - The function to call when all textures are loaded.
   */
  setOnAllLoaded(callback) {
    this.onAllLoaded = callback;
  }
}

export default Textures;