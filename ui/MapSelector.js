import UIComponent from './UIComponent.js';

/**
 * MapSelector - Map selection overlay UI
 */
class MapSelector extends UIComponent {
  /**
   * Creates a map selector
   * @param {Object} config - Configuration
   * @param {Array<{name: string, size: {width: number, height: number}}>} [config.maps=[]] - Available maps
   */
  constructor({ maps = [] } = {}) {
    super({ visible: false });
    this.maps = maps;
    this.selectedIndex = 0;
    this.activeMapIndex = 0;
  }

  /**
   * Sets the available maps
   * @param {Array} maps - Maps array
   */
  setMaps(maps) {
    this.maps = maps;
  }

  /**
   * Sets the currently active map index
   * @param {number} index - Active map index
   */
  setActiveMap(index) {
    this.activeMapIndex = index;
    this.selectedIndex = index;
  }

  /**
   * Moves selection up
   */
  selectPrevious() {
    this.selectedIndex = (this.selectedIndex - 1 + this.maps.length) % this.maps.length;
  }

  /**
   * Moves selection down
   */
  selectNext() {
    this.selectedIndex = (this.selectedIndex + 1) % this.maps.length;
  }

  /**
   * Gets the currently selected map index
   * @returns {number} Selected index
   */
  getSelectedIndex() {
    return this.selectedIndex;
  }

  /**
   * Toggles visibility
   */
  toggle() {
    this.visible = !this.visible;
    if (this.visible) {
      this.selectedIndex = this.activeMapIndex;
    }
  }

  /**
   * Draws the map selector
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} w - Canvas width
   * @param {number} h - Canvas height
   */
  draw(ctx, w, h) {
    if (!this.visible) return;

    ctx.save();

    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, w, h);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(h * 0.06)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELECT MAP', w * 0.5, h * 0.15);

    // Instructions
    ctx.font = `${Math.floor(h * 0.025)}px Arial`;
    ctx.fillStyle = '#888888';
    ctx.fillText('Use ↑↓ arrows or number keys (1-9) to select, Enter to confirm, M/Tab to close', w * 0.5, h * 0.22);

    // Map list
    const startY = h * 0.32;
    const itemHeight = h * 0.1;

    for (let i = 0; i < this.maps.length; i++) {
      const map = this.maps[i];
      const y = startY + i * itemHeight;
      const isSelected = i === this.selectedIndex;
      const isActive = i === this.activeMapIndex;

      // Selection background
      if (isSelected) {
        ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
        ctx.fillRect(w * 0.2, y - itemHeight * 0.4, w * 0.6, itemHeight * 0.8);

        ctx.strokeStyle = '#6699ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(w * 0.2, y - itemHeight * 0.4, w * 0.6, itemHeight * 0.8);
      }

      // Map number
      ctx.fillStyle = isSelected ? '#ffffff' : '#666666';
      ctx.font = `bold ${Math.floor(h * 0.04)}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}.`, w * 0.25, y);

      // Map name
      ctx.fillStyle = isSelected ? '#ffffff' : '#aaaaaa';
      ctx.font = `${Math.floor(h * 0.04)}px Arial`;
      ctx.fillText(map.name, w * 0.32, y);

      // Active indicator
      if (isActive) {
        ctx.fillStyle = '#44ff44';
        ctx.font = `${Math.floor(h * 0.025)}px Arial`;
        ctx.textAlign = 'right';
        ctx.fillText('(CURRENT)', w * 0.75, y);
      }

      // Map size
      ctx.fillStyle = '#666666';
      ctx.font = `${Math.floor(h * 0.02)}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText(`${map.size.width}x${map.size.height} units`, w * 0.32, y + itemHeight * 0.25);
    }

    ctx.restore();
  }
}

export default MapSelector;
