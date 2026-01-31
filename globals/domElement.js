/** @typedef {HTMLCanvasElement} Canvas - The main canvas element (3D world). */
const main_canvas = document.getElementById('mainCanvas');
/** @type {CanvasRenderingContext2D} - The 2D context of the main canvas. */
const main_ctx = main_canvas.getContext('2d');

/** @typedef {HTMLCanvasElement} Canvas - The background canvas element (floor/sky). */
const background_canvas = document.getElementById('backgroundCanvas');
/** @type {CanvasRenderingContext2D} - The 2D context of the background canvas. */
const background_ctx = background_canvas.getContext('2d');

/** @typedef {HTMLCanvasElement} Canvas - The minimap canvas element. */
const minimap_canvas = document.getElementById('minimapCanvas');
/** @type {CanvasRenderingContext2D} - The 2D context of the minimap canvas. */
const minimap_ctx = minimap_canvas.getContext('2d');
