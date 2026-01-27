/**
 * SettingsMenu - HTML/CSS based settings menu for controls and sensitivity
 */

import { ControlsConfig } from '../config/ControlsConfig.js';

/**
 * Settings menu component using HTML/CSS
 */
class SettingsMenu {
  constructor() {
    this.visible = false;
    this.currentTab = 'controls'; // 'controls' or 'sensitivity'
    this.selectedIndex = 0;
    this.isRebinding = false;
    this.rebindingAction = null;
    this.rebindingKeyIndex = -1; // -1 means adding new key, >= 0 means replacing existing key at index
    
    // Callback when menu is closed
    this.onClose = null;
    
    // Bind keyboard handler
    this._onKeyDown = this._onKeyDown.bind(this);
    
    // Create DOM elements
    this._createDOM();
    this._setupEventListeners();
    this._updateDisplay();
  }

  /**
   * Creates the DOM structure for the settings menu
   * @private
   */
  _createDOM() {
    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'settings-overlay';
    this.overlay.innerHTML = `
      <div class="settings-container">
        <div class="settings-header">
          <h1>Settings</h1>
          <button class="close-btn" id="settings-close-btn">×</button>
        </div>
        
        <div class="settings-tabs">
          <button class="tab-btn active" data-tab="controls">Controls</button>
          <button class="tab-btn" data-tab="sensitivity">Sensitivity</button>
        </div>
        
        <div class="settings-content">
          <div class="tab-content" id="controls-tab">
            <div class="controls-list" id="controls-list"></div>
            <div class="controls-help">
              <p>Click a key to change it • Click <kbd>+</kbd> to add • <kbd>Del</kbd> to remove</p>
              <p class="help-note">Press Escape to cancel • Keys are case-insensitive</p>
            </div>
          </div>
          
          <div class="tab-content hidden" id="sensitivity-tab">
            <div class="sensitivity-control">
              <label>Mouse Sensitivity</label>
              <div class="sensitivity-slider-container">
                <input type="range" id="sensitivity-slider" min="1" max="200" value="20">
                <span class="sensitivity-value" id="sensitivity-value">0.20</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="settings-footer">
          <button class="footer-btn" id="reset-defaults-btn">Reset to Defaults</button>
        </div>
      </div>
    `;
    
    // Add styles
    this._injectStyles();
    
    // Append to body
    document.body.appendChild(this.overlay);
    
    // Cache DOM references
    this.container = this.overlay.querySelector('.settings-container');
    this.controlsList = this.overlay.querySelector('#controls-list');
    this.sensitivitySlider = this.overlay.querySelector('#sensitivity-slider');
    this.sensitivityValue = this.overlay.querySelector('#sensitivity-value');
    this.tabButtons = this.overlay.querySelectorAll('.tab-btn');
    this.tabContents = this.overlay.querySelectorAll('.tab-content');
  }

  /**
   * Injects CSS styles for the settings menu
   * @private
   */
  _injectStyles() {
    if (document.getElementById('settings-menu-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'settings-menu-styles';
    style.textContent = `
      #settings-overlay {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        align-items: center;
        justify-content: center;
      }
      
      #settings-overlay.visible {
        display: flex;
      }
      
      .settings-container {
        background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid #0f3460;
        border-radius: 12px;
        width: min(600px, 90vw);
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      }
      
      .settings-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        background: rgba(0, 0, 0, 0.3);
        border-bottom: 1px solid #0f3460;
      }
      
      .settings-header h1 {
        margin: 0;
        color: #e94560;
        font-size: 24px;
        font-weight: 600;
      }
      
      .close-btn {
        background: none;
        border: none;
        color: #888;
        font-size: 32px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
        transition: color 0.2s;
      }
      
      .close-btn:hover {
        color: #e94560;
      }
      
      .settings-tabs {
        display: flex;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid #0f3460;
      }
      
      .tab-btn {
        flex: 1;
        padding: 14px 20px;
        background: none;
        border: none;
        color: #888;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border-bottom: 3px solid transparent;
      }
      
      .tab-btn:hover {
        color: #ccc;
        background: rgba(255, 255, 255, 0.05);
      }
      
      .tab-btn.active {
        color: #e94560;
        border-bottom-color: #e94560;
        background: rgba(233, 69, 96, 0.1);
      }
      
      .settings-content {
        padding: 20px 24px;
        max-height: 400px;
        overflow-y: auto;
      }
      
      .tab-content.hidden {
        display: none;
      }
      
      .controls-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .control-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid #0f3460;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .control-item:hover {
        background: rgba(233, 69, 96, 0.1);
        border-color: #e94560;
      }
      
      .control-item.selected {
        background: rgba(233, 69, 96, 0.2);
        border-color: #e94560;
      }
      
      .control-item.rebinding {
        background: rgba(233, 69, 96, 0.3);
        border-color: #e94560;
        animation: pulse 1s infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      
      .control-label {
        color: #ccc;
        font-size: 14px;
      }
      
      .control-keys {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      
      .key-badge {
        background: #0f3460;
        color: #fff;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        min-width: 40px;
        text-align: center;
      }
      
      .key-badge.clickable {
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .key-badge.clickable:hover {
        background: #e94560;
        transform: scale(1.05);
      }
      
      .key-badge.add-key-btn {
        background: rgba(0, 255, 100, 0.2);
        color: #0f0;
        border: 1px dashed #0f0;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 30px;
      }
      
      .key-badge.add-key-btn:hover {
        background: rgba(0, 255, 100, 0.4);
        transform: scale(1.1);
      }
      
      .key-badge.rebinding-badge {
        background: #e94560;
        animation: pulse 1s infinite;
      }
      
      .key-badge.empty {
        background: #333;
        color: #666;
        font-style: italic;
      }
      
      .controls-help {
        margin-top: 16px;
        padding: 12px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        text-align: center;
      }
      
      .controls-help p {
        margin: 0;
        color: #666;
        font-size: 12px;
      }
      
      .controls-help .help-note {
        margin-top: 6px;
        color: #555;
        font-size: 11px;
        font-style: italic;
      }
      
      .controls-help kbd {
        background: #0f3460;
        color: #ccc;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: monospace;
      }
      
      .sensitivity-control {
        padding: 20px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid #0f3460;
        border-radius: 8px;
      }
      
      .sensitivity-control label {
        display: block;
        color: #ccc;
        font-size: 14px;
        margin-bottom: 16px;
      }
      
      .sensitivity-slider-container {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      
      #sensitivity-slider {
        flex: 1;
        height: 8px;
        -webkit-appearance: none;
        appearance: none;
        background: #0f3460;
        border-radius: 4px;
        outline: none;
      }
      
      #sensitivity-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        background: #e94560;
        border-radius: 50%;
        cursor: pointer;
        transition: transform 0.1s;
      }
      
      #sensitivity-slider::-webkit-slider-thumb:hover {
        transform: scale(1.1);
      }
      
      #sensitivity-slider::-moz-range-thumb {
        width: 20px;
        height: 20px;
        background: #e94560;
        border-radius: 50%;
        cursor: pointer;
        border: none;
      }
      
      .sensitivity-value {
        color: #e94560;
        font-size: 18px;
        font-weight: 600;
        min-width: 50px;
        text-align: right;
      }
      
      .settings-footer {
        padding: 16px 24px;
        background: rgba(0, 0, 0, 0.3);
        border-top: 1px solid #0f3460;
        display: flex;
        justify-content: center;
      }
      
      .footer-btn {
        background: rgba(233, 69, 96, 0.2);
        border: 1px solid #e94560;
        color: #e94560;
        padding: 10px 24px;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .footer-btn:hover {
        background: #e94560;
        color: #fff;
      }
      
      /* Scrollbar styling */
      .settings-content::-webkit-scrollbar {
        width: 8px;
      }
      
      .settings-content::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 4px;
      }
      
      .settings-content::-webkit-scrollbar-thumb {
        background: #0f3460;
        border-radius: 4px;
      }
      
      .settings-content::-webkit-scrollbar-thumb:hover {
        background: #e94560;
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Sets up event listeners
   * @private
   */
  _setupEventListeners() {
    // Close button
    this.overlay.querySelector('#settings-close-btn').addEventListener('click', () => {
      this.hide();
    });
    
    // Tab buttons
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });
    
    // Sensitivity slider
    this.sensitivitySlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value) / 100;
      ControlsConfig.setSensitivity(value);
      this._updateSensitivityDisplay();
    });
    
    // Reset defaults button
    this.overlay.querySelector('#reset-defaults-btn').addEventListener('click', () => {
      this.resetToDefaults();
    });
    
    // Overlay click to close (when clicking outside container)
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });
    
    // Listen for config changes
    ControlsConfig.addListener(() => {
      this._updateDisplay();
    });
  }

  /**
   * Handles keyboard events when the menu is visible
   * @param {KeyboardEvent} e - Key event
   * @private
   */
  _onKeyDown(e) {
    if (!this.visible) return;
    
    const key = e.key;
    
    // Handle key rebinding
    if (this.isRebinding) {
      e.preventDefault();
      e.stopPropagation();
      this.handleKeyForRebind(key);
      return;
    }
    
    // Navigation and actions in settings menu
    if (key === 'Escape') {
      e.preventDefault();
      this.hide();
      return;
    }
    if (key === 'ArrowUp') {
      e.preventDefault();
      this.selectPrevious();
      return;
    }
    if (key === 'ArrowDown') {
      e.preventDefault();
      this.selectNext();
      return;
    }
    if (key === 'ArrowLeft') {
      e.preventDefault();
      this.adjustSensitivity(-1);
      return;
    }
    if (key === 'ArrowRight') {
      e.preventDefault();
      this.adjustSensitivity(1);
      return;
    }
    if (key === 'Enter') {
      e.preventDefault();
      this.confirm();
      return;
    }
    if (key === 'Tab') {
      e.preventDefault();
      this.switchTab(this.currentTab === 'controls' ? 'sensitivity' : 'controls');
      return;
    }
    if (key === 'r' || key === 'R') {
      e.preventDefault();
      this.resetToDefaults();
      return;
    }
  }

  /**
   * Updates the entire display
   * @private
   */
  _updateDisplay() {
    this._updateControlsList();
    this._updateSensitivityDisplay();
  }

  /**
   * Updates the controls list display
   * @private
   */
  _updateControlsList() {
    const actions = ControlsConfig.getActions();
    
    this.controlsList.innerHTML = actions.map((action, index) => {
      const keys = ControlsConfig.getKeys(action);
      const displayName = ControlsConfig.getActionDisplayName(action);
      const isSelected = index === this.selectedIndex && this.currentTab === 'controls';
      const isRebinding = this.isRebinding && this.rebindingAction === action;
      
      let keyBadgesHtml;
      if (isRebinding) {
        // Show which key slot is being rebound
        if (this.rebindingKeyIndex >= 0) {
          // Replacing an existing key
          keyBadgesHtml = keys.map((key, keyIdx) => {
            if (keyIdx === this.rebindingKeyIndex) {
              return '<span class="key-badge rebinding-badge">Press key or DEL...</span>';
            }
            return `<span class="key-badge">${ControlsConfig.getKeyDisplayName(key)}</span>`;
          }).join('');
        } else {
          // Adding a new key
          keyBadgesHtml = keys.map(key => 
            `<span class="key-badge">${ControlsConfig.getKeyDisplayName(key)}</span>`
          ).join('');
          keyBadgesHtml += '<span class="key-badge rebinding-badge">Press any key...</span>';
        }
      } else {
        // Normal display with clickable keys and add button
        keyBadgesHtml = keys.map((key, keyIdx) => 
          `<span class="key-badge clickable" data-action="${action}" data-key-index="${keyIdx}">${ControlsConfig.getKeyDisplayName(key)}</span>`
        ).join('');
        // Add the "+" button
        keyBadgesHtml += `<span class="key-badge add-key-btn" data-action="${action}">+</span>`;
      }
      
      return `
        <div class="control-item ${isSelected ? 'selected' : ''}" 
             data-action="${action}" data-index="${index}">
          <span class="control-label">${displayName}</span>
          <div class="control-keys">${keyBadgesHtml}</div>
        </div>
      `;
    }).join('');
    
    // Add click listeners to individual key badges (for replacing)
    this.controlsList.querySelectorAll('.key-badge.clickable').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = badge.dataset.action;
        const keyIndex = parseInt(badge.dataset.keyIndex);
        this.selectedIndex = ControlsConfig.getActions().indexOf(action);
        this.startRebindingKey(action, keyIndex);
      });
    });
    
    // Add click listeners to "+" buttons (for adding)
    this.controlsList.querySelectorAll('.add-key-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        this.selectedIndex = ControlsConfig.getActions().indexOf(action);
        this.startRebindingKey(action, -1); // -1 means adding new
      });
    });
    
    // Add click listeners to control items (for selection only)
    this.controlsList.querySelectorAll('.control-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        this.selectedIndex = index;
        this._updateControlsList();
      });
    });
  }

  /**
   * Updates the sensitivity display
   * @private
   */
  _updateSensitivityDisplay() {
    const sensitivity = ControlsConfig.getSensitivity();
    this.sensitivitySlider.value = Math.round(sensitivity * 100);
    this.sensitivityValue.textContent = sensitivity.toFixed(2);
  }

  /**
   * Switches to a different tab
   * @param {string} tab - Tab name ('controls' or 'sensitivity')
   */
  switchTab(tab) {
    this.currentTab = tab;
    
    // Update tab buttons
    this.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Update tab content visibility
    this.tabContents.forEach(content => {
      content.classList.toggle('hidden', !content.id.startsWith(tab));
    });
    
    // Reset selection when switching tabs
    if (tab === 'controls') {
      this._updateControlsList();
    }
  }

  /**
   * Starts rebinding a specific key slot
   * @param {string} action - Action to rebind
   * @param {number} keyIndex - Index of key to replace (-1 to add new)
   */
  startRebindingKey(action, keyIndex) {
    this.isRebinding = true;
    this.rebindingAction = action;
    this.rebindingKeyIndex = keyIndex;
    this._updateControlsList();
  }

  /**
   * Starts rebinding a control (legacy - adds new key)
   * @param {string} action - Action to rebind
   */
  startRebinding(action) {
    this.startRebindingKey(action, -1);
  }

  /**
   * Handles a key press during rebinding
   * @param {string} key - Key that was pressed
   */
  handleKeyForRebind(key) {
    if (!this.isRebinding || !this.rebindingAction) return;
    
    // Cancel rebinding with Escape
    if (key === 'Escape') {
      this.cancelRebinding();
      return;
    }
    
    const action = this.rebindingAction;
    const keyIndex = this.rebindingKeyIndex;
    
    // Delete key removes the binding (only when replacing an existing key)
    if ((key === 'Delete' || key === 'Backspace') && keyIndex >= 0) {
      const keys = ControlsConfig.getKeys(action);
      if (keyIndex < keys.length) {
        ControlsConfig.removeKey(action, keys[keyIndex]);
      }
      this.isRebinding = false;
      this.rebindingAction = null;
      this.rebindingKeyIndex = -1;
      this._updateControlsList();
      return;
    }
    
    if (keyIndex >= 0) {
      // Replacing an existing key at specific index
      const keys = [...ControlsConfig.getKeys(action)];
      if (keyIndex < keys.length) {
        keys[keyIndex] = key;
        ControlsConfig.setKeys(action, keys);
      }
    } else {
      // Adding a new key
      ControlsConfig.addKey(action, key);
    }
    
    this.isRebinding = false;
    this.rebindingAction = null;
    this.rebindingKeyIndex = -1;
    this._updateControlsList();
  }

  /**
   * Cancels the current rebinding operation
   */
  cancelRebinding() {
    this.isRebinding = false;
    this.rebindingAction = null;
    this.rebindingKeyIndex = -1;
    this._updateControlsList();
  }

  /**
   * Clears the binding for the selected control
   */
  clearBinding() {
    if (this.currentTab !== 'controls') return;
    
    const actions = ControlsConfig.getActions();
    if (this.selectedIndex >= 0 && this.selectedIndex < actions.length) {
      ControlsConfig.clearKeys(actions[this.selectedIndex]);
    }
  }

  /**
   * Selects the previous control
   */
  selectPrevious() {
    if (this.currentTab !== 'controls') return;
    
    const actions = ControlsConfig.getActions();
    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    this._updateControlsList();
  }

  /**
   * Selects the next control
   */
  selectNext() {
    if (this.currentTab !== 'controls') return;
    
    const actions = ControlsConfig.getActions();
    this.selectedIndex = Math.min(actions.length - 1, this.selectedIndex + 1);
    this._updateControlsList();
  }

  /**
   * Confirms the current selection (starts rebinding)
   */
  confirm() {
    if (this.currentTab === 'controls') {
      const actions = ControlsConfig.getActions();
      if (this.selectedIndex >= 0 && this.selectedIndex < actions.length) {
        this.startRebinding(actions[this.selectedIndex]);
      }
    }
  }

  /**
   * Adjusts sensitivity by a step
   * @param {number} direction - Direction (-1 or 1)
   */
  adjustSensitivity(direction) {
    if (this.currentTab !== 'sensitivity') return;
    
    ControlsConfig.adjustSensitivity(direction);
    this._updateSensitivityDisplay();
  }

  /**
   * Resets all settings to defaults
   */
  resetToDefaults() {
    ControlsConfig.resetToDefaults();
    this._updateDisplay();
  }

  /**
   * Shows the settings menu
   */
  show() {
    this.visible = true;
    this.overlay.classList.add('visible');
    this._updateDisplay();
    
    // Add keyboard listener to document (capture phase to get events first)
    document.addEventListener('keydown', this._onKeyDown, true);
  }

  /**
   * Hides the settings menu
   */
  hide() {
    this.visible = false;
    this.overlay.classList.remove('visible');
    this.isRebinding = false;
    this.rebindingAction = null;
    
    // Remove keyboard listener
    document.removeEventListener('keydown', this._onKeyDown, true);
    
    if (this.onClose) {
      this.onClose();
    }
  }
}

export default SettingsMenu;
