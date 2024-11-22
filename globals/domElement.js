
/** @typedef {HTMLCanvasElement} Canvas - The main canvas element. */
const main_canvas = document.getElementById('mainCanvas');
/** @type {CanvasRenderingContext2D} - The 2D context of the main canvas. */
const main_ctx = main_canvas.getContext('2d');

/** @typedef {HTMLCanvasElement} Canvas - The background canvas element. */
const background_canvas = document.getElementById('backgroundCanvas');
/** @type {CanvasRenderingContext2D} - The 2D context of the background canvas. */
const background_ctx = background_canvas.getContext('2d');

// /** @typedef {HTMLCanvasElement} Canvas - The canvas element to render user interface elements. */
// const ui_canvas = document.getElementById('uiCanvas');
// /** @type {CanvasRenderingContext2D} - The 2D context of the user interface canvas. */
// const ui_ctx = ui_canvas.getContext('2d');
