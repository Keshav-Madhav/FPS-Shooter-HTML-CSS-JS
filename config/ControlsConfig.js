/**
 * Controls Configuration - Manages key bindings and mouse sensitivity
 * Supports saving/loading from localStorage and runtime rebinding
 */

import { InputConfig } from './GameConfig.js';

// Storage key for localStorage
const STORAGE_KEY = 'fps_shooter_controls';

// Default key bindings (from InputConfig)
const DEFAULT_KEYS = { ...InputConfig.keys };
const DEFAULT_SENSITIVITY = InputConfig.mouseSensitivity;

/**
 * ControlsConfig singleton - manages all input configuration
 */
class ControlsConfigManager {
  constructor() {
    // Current bindings (cloned from defaults)
    this._keys = this._normalizeAllKeys(this._deepClone(DEFAULT_KEYS));
    this._mouseSensitivity = DEFAULT_SENSITIVITY;
    
    // Listeners for config changes
    this._listeners = [];
    
    // Load saved settings
    this._load();
  }

  /**
   * Normalizes a key to a consistent format (lowercase for letters)
   * @param {string} key - Key to normalize
   * @returns {string} Normalized key
   * @private
   */
  _normalizeKey(key) {
    // Special keys stay as-is
    const specialKeys = ['Shift', 'Control', 'Alt', 'Tab', 'Enter', 'Escape', 'Backspace', 'Delete',
                         'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
    if (specialKeys.includes(key)) {
      return key;
    }
    // Single character keys become lowercase
    if (key.length === 1) {
      return key.toLowerCase();
    }
    return key;
  }

  /**
   * Normalizes all keys in a bindings object
   * @param {Object} keys - Key bindings object
   * @returns {Object} Normalized key bindings
   * @private
   */
  _normalizeAllKeys(keys) {
    const normalized = {};
    for (const action in keys) {
      normalized[action] = keys[action].map(k => this._normalizeKey(k));
      // Remove duplicates
      normalized[action] = [...new Set(normalized[action])];
    }
    return normalized;
  }

  /**
   * Deep clones an object
   * @param {Object} obj - Object to clone
   * @returns {Object} Cloned object
   * @private
   */
  _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Loads settings from localStorage
   * @private
   */
  _load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.keys) {
          // Merge saved keys with defaults (in case new actions were added)
          const merged = { ...this._deepClone(DEFAULT_KEYS), ...data.keys };
          // Normalize all keys
          this._keys = this._normalizeAllKeys(merged);
        }
        if (typeof data.mouseSensitivity === 'number') {
          this._mouseSensitivity = data.mouseSensitivity;
        }
      }
    } catch (e) {
      console.warn('Failed to load controls config:', e);
    }
  }

  /**
   * Saves settings to localStorage
   * @private
   */
  _save() {
    try {
      const data = {
        keys: this._keys,
        mouseSensitivity: this._mouseSensitivity
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save controls config:', e);
    }
  }

  /**
   * Notifies all listeners of a config change
   * @private
   */
  _notifyListeners() {
    for (const listener of this._listeners) {
      try {
        listener();
      } catch (e) {
        console.warn('Config listener error:', e);
      }
    }
  }

  /**
   * Adds a listener for config changes
   * @param {Function} callback - Callback function
   */
  addListener(callback) {
    if (typeof callback === 'function' && !this._listeners.includes(callback)) {
      this._listeners.push(callback);
    }
  }

  /**
   * Removes a listener
   * @param {Function} callback - Callback to remove
   */
  removeListener(callback) {
    const index = this._listeners.indexOf(callback);
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  }

  /**
   * Gets the keys bound to an action
   * @param {string} action - Action name (e.g., 'forward', 'jump')
   * @returns {string[]} Array of bound keys
   */
  getKeys(action) {
    return this._keys[action] || [];
  }

  /**
   * Checks if a key matches any binding for an action (case-insensitive)
   * @param {string} key - Key to check
   * @param {string} action - Action name
   * @returns {boolean} True if key matches
   */
  matchesKey(key, action) {
    const normalizedKey = this._normalizeKey(key);
    const keys = this.getKeys(action);
    return keys.some(k => this._normalizeKey(k) === normalizedKey);
  }

  /**
   * Gets all key bindings
   * @returns {Object} All key bindings
   */
  getAllKeys() {
    return this._deepClone(this._keys);
  }

  /**
   * Gets all action names
   * @returns {string[]} Array of action names
   */
  getActions() {
    return Object.keys(this._keys);
  }

  /**
   * Sets keys for an action
   * @param {string} action - Action name
   * @param {string[]} keys - Array of keys to bind
   */
  setKeys(action, keys) {
    if (this._keys.hasOwnProperty(action)) {
      // Normalize all keys
      this._keys[action] = keys.map(k => this._normalizeKey(k));
      // Remove duplicates
      this._keys[action] = [...new Set(this._keys[action])];
      this._save();
      this._notifyListeners();
    }
  }

  /**
   * Adds a key to an action
   * @param {string} action - Action name
   * @param {string} key - Key to add
   */
  addKey(action, key) {
    if (this._keys.hasOwnProperty(action)) {
      const normalizedKey = this._normalizeKey(key);
      // Check if normalized key already exists
      if (!this._keys[action].some(k => this._normalizeKey(k) === normalizedKey)) {
        this._keys[action].push(normalizedKey);
        this._save();
        this._notifyListeners();
      }
    }
  }

  /**
   * Removes a key from an action
   * @param {string} action - Action name
   * @param {string} key - Key to remove
   */
  removeKey(action, key) {
    if (this._keys.hasOwnProperty(action)) {
      const normalizedKey = this._normalizeKey(key);
      const index = this._keys[action].findIndex(k => this._normalizeKey(k) === normalizedKey);
      if (index !== -1) {
        this._keys[action].splice(index, 1);
        this._save();
        this._notifyListeners();
      }
    }
  }

  /**
   * Clears all keys for an action
   * @param {string} action - Action name
   */
  clearKeys(action) {
    if (this._keys.hasOwnProperty(action)) {
      this._keys[action] = [];
      this._save();
      this._notifyListeners();
    }
  }

  /**
   * Gets the mouse sensitivity
   * @returns {number} Mouse sensitivity value
   */
  getSensitivity() {
    return this._mouseSensitivity;
  }

  /**
   * Sets the mouse sensitivity
   * @param {number} value - New sensitivity value
   */
  setSensitivity(value) {
    // Clamp to reasonable range
    this._mouseSensitivity = Math.max(0.01, Math.min(2.0, value));
    this._save();
    this._notifyListeners();
  }

  /**
   * Adjusts sensitivity by a delta
   * @param {number} delta - Amount to adjust
   */
  adjustSensitivity(delta) {
    this.setSensitivity(this._mouseSensitivity + delta * 0.05);
  }

  /**
   * Resets all settings to defaults
   */
  resetToDefaults() {
    this._keys = this._normalizeAllKeys(this._deepClone(DEFAULT_KEYS));
    this._mouseSensitivity = DEFAULT_SENSITIVITY;
    this._save();
    this._notifyListeners();
  }

  /**
   * Gets a display name for an action
   * @param {string} action - Action name
   * @returns {string} Human-readable name
   */
  getActionDisplayName(action) {
    const names = {
      forward: 'Move Forward',
      backward: 'Move Backward',
      strafeLeft: 'Strafe Left',
      strafeRight: 'Strafe Right',
      sprint: 'Sprint',
      jump: 'Jump',
      crouch: 'Crouch',
      reset: 'Reset Level',
      noclip: 'Toggle Noclip',
      pathReveal: 'Reveal Path',
      mapSelector: 'Map Selector'
    };
    return names[action] || action;
  }

  /**
   * Gets a display name for a key
   * @param {string} key - Key value
   * @returns {string} Human-readable key name
   */
  getKeyDisplayName(key) {
    const names = {
      ' ': 'Space',
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'ArrowLeft': '←',
      'ArrowRight': '→',
      'Shift': 'Shift',
      'Control': 'Ctrl',
      'Alt': 'Alt',
      'Tab': 'Tab',
      'Enter': 'Enter',
      'Escape': 'Esc',
      'Backspace': 'Backspace',
      'Delete': 'Delete'
    };
    return names[key] || key.toUpperCase();
  }
}

// Export singleton instance
export const ControlsConfig = new ControlsConfigManager();
