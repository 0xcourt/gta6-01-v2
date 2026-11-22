// Solmar Heat — keyboard and mouse state.
// The game reads this one object each frame. Keys are tracked as a live set
// plus an edge-triggered "pressed this frame" set, so holding W drives and
// tapping E interacts exactly once. Nothing here touches the DOM: main.js
// wires the browser listeners and feeds events into it.

export class Input {
  constructor() {
    this.keys = new Set(); // codes currently held down
    this.pressed = new Set(); // codes pressed since the last frame ended
    this.mouse = {
      x: 0, y: 0, // screen pixels, relative to the canvas
      down: false,
      clicked: false, // set on mousedown, cleared at end of frame
    };
  }

  keyDown(code) {
    if (!this.keys.has(code)) this.pressed.add(code);
    this.keys.add(code);
  }

  keyUp(code) {
    this.keys.delete(code);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // True only on the frame the key went down.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // True if any of the given codes was pressed this frame.
  wasPressedAny(codes) {
    for (const c of codes) if (this.pressed.has(c)) return true;
    return false;
  }

  mouseDown(x, y) {
    this.mouse.x = x;
    this.mouse.y = y;
    this.mouse.down = true;
    this.mouse.clicked = true;
  }

  mouseUp() {
    this.mouse.down = false;
  }

  mouseMove(x, y) {
    this.mouse.x = x;
    this.mouse.y = y;
  }

  // Call at the end of every frame so edge triggers fire exactly once.
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }

  // WASD / arrow movement as a normalised -1..1 pair in world axes.
  moveAxes() {
    let mx = 0;
    let my = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) mx -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) mx += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) my -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) my += 1;
    if (mx !== 0 && my !== 0) {
      mx *= Math.SQRT1_2;
      my *= Math.SQRT1_2;
    }
    return { x: mx, y: my };
  }

  get sprinting() {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }
}
