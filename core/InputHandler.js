import { ControlsConfig } from '../config/ControlsConfig.js';

/**
 * InputHandler - Centralized input management
 * Handles keyboard and mouse input with customizable key bindings
 */
class InputHandler {
  /**
   * Creates an input handler
   * @param {HTMLCanvasElement} canvas - The canvas element to attach listeners to
   * @param {Object} [callbacks={}] - Callback functions for various inputs
   */
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    
    // Movement state
    this.moveState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      crouch: false
    };

    // Input enabled state
    this.enabled = true;
    this.mouseEnabled = true;
    
    // Pointer lock state
    this.isPointerLocked = false;
    
    // Listen for config changes
    this._onConfigChange = this._onConfigChange.bind(this);
    ControlsConfig.addListener(this._onConfigChange);
    
    // Bind methods
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onClick = this._onClick.bind(this);
    
    this._setupListeners();
  }

  /**
   * Called when controls config changes
   * @private
   */
  _onConfigChange() {
    // Config has been updated, no need to do anything special
    // as we read from ControlsConfig directly
  }

  /**
   * Sets up event listeners
   * @private
   */
  _setupListeners() {
    this.canvas.addEventListener('keydown', this._onKeyDown);
    this.canvas.addEventListener('keyup', this._onKeyUp);
    this.canvas.addEventListener('click', this._onClick);
    
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('mozpointerlockchange', this._onPointerLockChange);
  }

  /**
   * Removes event listeners
   */
  destroy() {
    this.canvas.removeEventListener('keydown', this._onKeyDown);
    this.canvas.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('click', this._onClick);
    
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('mozpointerlockchange', this._onPointerLockChange);
    document.removeEventListener('mousemove', this._onMouseMove);
    
    ControlsConfig.removeListener(this._onConfigChange);
  }

  /**
   * Enables or disables input handling
   * @param {boolean} enabled - Whether to enable input
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this._resetMoveState();
    }
  }

  /**
   * Enables or disables mouse input
   * @param {boolean} enabled - Whether to enable mouse
   */
  setMouseEnabled(enabled) {
    this.mouseEnabled = enabled;
  }

  /**
   * Sets a callback function
   * @param {string} name - Callback name
   * @param {Function} fn - Callback function
   */
  setCallback(name, fn) {
    this.callbacks[name] = fn;
  }

  /**
   * Checks if a key matches a binding (case-insensitive)
   * @param {string} key - Pressed key
   * @param {string} action - Action to check
   * @returns {boolean} True if key matches action
   * @private
   */
  _matchesKey(key, action) {
    return ControlsConfig.matchesKey(key, action);
  }

  /**
   * Resets all movement state
   * @private
   */
  _resetMoveState() {
    this.moveState.forward = false;
    this.moveState.backward = false;
    this.moveState.left = false;
    this.moveState.right = false;
    this.moveState.sprint = false;
    this.moveState.crouch = false;
  }

  /**
   * Handles keydown events
   * @param {KeyboardEvent} e - Key event
   * @private
   */
  _onKeyDown(e) {
    // Check for special blocking callbacks (like instructions dismiss)
    if (this.callbacks.onKeyDownBlocking) {
      const blocked = this.callbacks.onKeyDownBlocking(e);
      if (blocked) return;
    }

    if (!this.enabled) return;

    const key = e.key;

    // Movement keys
    if (this._matchesKey(key, 'forward')) {
      this.moveState.forward = true;
    } else if (this._matchesKey(key, 'backward')) {
      this.moveState.backward = true;
    } else if (this._matchesKey(key, 'strafeRight')) {
      this.moveState.right = true;
    } else if (this._matchesKey(key, 'strafeLeft')) {
      this.moveState.left = true;
    }

    // Sprint
    if (this._matchesKey(key, 'sprint')) {
      this.moveState.sprint = true;
      if (this.callbacks.onSprintStart) this.callbacks.onSprintStart();
    }

    // Jump
    if (this._matchesKey(key, 'jump')) {
      e.preventDefault();
      if (this.callbacks.onJump) this.callbacks.onJump();
    }

    // Crouch
    if (this._matchesKey(key, 'crouch')) {
      this.moveState.crouch = true;
      if (this.callbacks.onCrouchStart) this.callbacks.onCrouchStart();
    }

    // Reset
    if (this._matchesKey(key, 'reset')) {
      if (this.callbacks.onReset) this.callbacks.onReset();
    }

    // Noclip toggle
    if (this._matchesKey(key, 'noclip')) {
      if (this.callbacks.onNoclipToggle) this.callbacks.onNoclipToggle();
    }

    // Path reveal
    if (this._matchesKey(key, 'pathReveal')) {
      if (this.callbacks.onPathReveal) this.callbacks.onPathReveal();
    }

    // Map selector
    if (this._matchesKey(key, 'mapSelector')) {
      e.preventDefault();
      if (this.callbacks.onMapSelectorToggle) this.callbacks.onMapSelectorToggle();
    }

    // Number keys for quick map selection
    if (key >= '1' && key <= '9') {
      const index = parseInt(key) - 1;
      if (this.callbacks.onMapQuickSelect) this.callbacks.onMapQuickSelect(index);
    }

    // Arrow navigation (for map selector)
    if (key === 'ArrowUp' && this.callbacks.onNavigateUp) {
      this.callbacks.onNavigateUp();
    }
    if (key === 'ArrowDown' && this.callbacks.onNavigateDown) {
      this.callbacks.onNavigateDown();
    }
    if (key === 'Enter' && this.callbacks.onConfirm) {
      this.callbacks.onConfirm();
    }
    if (key === 'Escape' && this.callbacks.onCancel) {
      this.callbacks.onCancel();
    }
  }

  /**
   * Handles keyup events
   * @param {KeyboardEvent} e - Key event
   * @private
   */
  _onKeyUp(e) {
    const key = e.key;

    // Movement keys
    if (this._matchesKey(key, 'forward')) {
      this.moveState.forward = false;
    } else if (this._matchesKey(key, 'backward')) {
      this.moveState.backward = false;
    } else if (this._matchesKey(key, 'strafeRight')) {
      this.moveState.right = false;
    } else if (this._matchesKey(key, 'strafeLeft')) {
      this.moveState.left = false;
    }

    // Sprint
    if (this._matchesKey(key, 'sprint')) {
      this.moveState.sprint = false;
      if (this.callbacks.onSprintEnd) this.callbacks.onSprintEnd();
    }

    // Crouch
    if (this._matchesKey(key, 'crouch')) {
      this.moveState.crouch = false;
      if (this.callbacks.onCrouchEnd) this.callbacks.onCrouchEnd();
    }
  }

  /**
   * Handles mouse click
   * @param {MouseEvent} e - Mouse event
   * @private
   */
  _onClick(e) {
    if (!this.enabled) return;
    this.canvas.requestPointerLock();
  }

  /**
   * Handles pointer lock changes
   * @private
   */
  _onPointerLockChange() {
    if (document.pointerLockElement === this.canvas ||
        document.mozPointerLockElement === this.canvas) {
      this.isPointerLocked = true;
      document.addEventListener('mousemove', this._onMouseMove);
    } else {
      this.isPointerLocked = false;
      document.removeEventListener('mousemove', this._onMouseMove);
    }
  }

  /**
   * Handles mouse movement
   * @param {MouseEvent} e - Mouse event
   * @private
   */
  _onMouseMove(e) {
    if (!this.enabled || !this.mouseEnabled) return;
    
    if (this.callbacks.onMouseMove) {
      this.callbacks.onMouseMove(e.movementX, e.movementY);
    }
  }

  /**
   * Releases pointer lock
   */
  releasePointerLock() {
    document.exitPointerLock();
  }

  /**
   * Gets the current movement state
   * @returns {Object} Movement state object
   */
  getMoveState() {
    return { ...this.moveState };
  }
}

export default InputHandler;
