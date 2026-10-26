import { vertexSource, pixelFragmentSource, SKY_PRESETS, MAX_PIXEL_RIPPLES, PIXEL_RIPPLE_SPEED, PIXEL_RIPPLE_TAIL } from './hero-sky-shaders.js?v=20261017-ripple-1';
import { playNextNote } from './hero-piano.js?v=20261026-vocal-verse-1';
import { initHeroKeyboard } from './hero-keyboard.js?v=20261026-vocal-verse-1';
import { getSkyFrame, SKY_CELL_SIZE } from './sky-framing.js?v=20261019-ctasky-1';

const art = document.querySelector('.world-art');
const sky = document.getElementById('sky-canvas');
const flockCanvas = document.getElementById('flock-canvas');
const flockCtx = flockCanvas.getContext('2d');

// ?sky=<id> is only a testing/screenshot override. Unknown ids use the same
// fresh random choice as a normal page load; no storage or controls are needed.
const requestedPreset = new URLSearchParams(window.location.search).get('sky');
const preset = SKY_PRESETS.find(candidate => candidate.id === requestedPreset)
  || SKY_PRESETS[Math.floor(Math.random() * SKY_PRESETS.length)];
art.dataset.skyPreset = preset.id;
sky.dataset.skyPreset = preset.id;

// The existing still, recoloured only for palette modes, sits behind WebGL.
// It stays in the card and survives missing/lost WebGL without inline styles.
const fallback = document.createElement('canvas');
fallback.id = 'sky-fallback';
fallback.setAttribute('aria-hidden', 'true');
art.insertBefore(fallback, sky);
const fallbackCtx = fallback.getContext('2d');
const fallbackImage = new Image();
fallbackImage.onload = () => { drawFallback(); renderer?.loadPixel?.(); draw(); };
fallbackImage.src = preset.image || 'assets/loading-pixel-sky.png';
function drawFallback() {
  if (!fallbackCtx) return;
  fallback.width = sky.width;
  fallback.height = sky.height;
  fallbackCtx.fillStyle = preset.image ? '#0b131e' : `rgb(${preset.palette[2].map(channel => Math.round(channel * 255)).join(',')})`;
  fallbackCtx.fillRect(0, 0, fallback.width, fallback.height);
  if (!fallbackImage.complete || !fallbackImage.naturalWidth) return;
  const { coverScale: scale } = getSkyFrame(fallback.width * SKY_CELL_SIZE, fallback.height * SKY_CELL_SIZE, fallbackImage.naturalWidth, fallbackImage.naturalHeight);
  const w = fallbackImage.naturalWidth * scale, h = fallbackImage.naturalHeight * scale;
  fallbackCtx.imageSmoothingEnabled = !preset.image;
  fallbackCtx.drawImage(fallbackImage, (fallback.width - w) / 2, (fallback.height - h) / 2, w, h);
  if (preset.image) return;
  const pixels = fallbackCtx.getImageData(0, 0, fallback.width, fallback.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const light = (pixels.data[i] * .2126 + pixels.data[i + 1] * .7152 + pixels.data[i + 2] * .0722) / 255;
    const colour = preset.palette[Math.min(8, Math.round(light * 8))];
    for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = Math.round(colour[channel] * 255);
  }
  fallbackCtx.putImageData(pixels, 0, 0);
}

// All skies and the flock share the reference wave lifetime and input sampling.
class PixelRipplePool {
  active = [];
  aspect = 1;
  expire(now) {
    this.active = this.active.filter(ripple =>
      (now - ripple.born) * PIXEL_RIPPLE_SPEED < Math.hypot(Math.max(ripple.x, 1 - ripple.x) * this.aspect, Math.max(ripple.y, 1 - ripple.y)) + PIXEL_RIPPLE_TAIL);
  }
  add(x, y, now) {
    this.expire(now);
    if (this.active.length < MAX_PIXEL_RIPPLES) this.active.push({ x, y, born: now });
  }
}
const pixelRipples = new PixelRipplePool();
let pixelDots = [];
let lastPixelInput = 0;
let previousPixelPoint = null;
function recordPixelBrush(x, y, down = false) {
  const now = performance.now();
  if (!down && now - lastPixelInput < 24) return;
  lastPixelInput = now;
  const follows = previousPixelPoint && now - previousPixelPoint.time < 180 && !down;
  const dx = follows ? (x - previousPixelPoint.x) * width / height : .025;
  const dy = follows ? y - previousPixelPoint.y : 0;
  pixelDots.push({ x, y, dx, dy, born: time });
  previousPixelPoint = { x, y, time: now };
  pixelDots = pixelDots.slice(-12);
}

const calmButton = document.getElementById('calm-button');
const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
let calm = preference.matches;
let inView = true;
let frame = 0;
let previous = 0;
let time = 0;
let width = 1;
let height = 1;
let renderer = null;
let pointer = null;
const sprites = [];
let seed = 2718;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const birds = Array.from({ length: 34 }, (_, index) => {
  const angle = index * 2.399963;
  return {
    x: .5 + Math.cos(angle) * (.32 + random() * .13),
    y: .49 + Math.sin(angle) * (.31 + random() * .13),
    size: 16 + random() * 34, angle: random() * Math.PI * 2,
    phase: random() * Math.PI * 2, speed: .18 + random() * .22,
    flip: random() > .55 ? -1 : 1, alpha: .5 + random() * .45, sprite: index % 2,
  };
});

function drawFlock() {
  if (!flockCtx) return;
  const ratio = flockCanvas.width / width;
  flockCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  flockCtx.clearRect(0, 0, width, height);
  const scale = Math.min(width / 520, 1.1);
  for (const bird of birds) {
    const sprite = sprites[bird.sprite];
    if (!sprite) continue;
    let x = bird.x * width + Math.sin(time * bird.speed + bird.phase) * 7;
    let y = bird.y * height + Math.cos(time * bird.speed + bird.phase) * 8;
    if (pointer && !calm) {
      const dx = x - pointer.x, dy = y - pointer.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0 && distance < 80) { x += dx / distance * (1 - distance / 80) * 16; y += dy / distance * (1 - distance / 80) * 16; }
    }
    for (const ripple of pixelRipples.active) {
      // Match the shader's aspect-correct distance, Gaussian front and edge fade.
      // One shader unit is the panel height in CSS pixels (speed = .32 * height/s).
      const dx = (x / width - ripple.x) * pixelRipples.aspect;
      const dy = y / height - ripple.y;
      const distance = Math.hypot(dx, dy);
      const radius = (time - ripple.born) * PIXEL_RIPPLE_SPEED;
      const reach = Math.hypot(Math.max(ripple.x, 1 - ripple.x) * pixelRipples.aspect, Math.max(ripple.y, 1 - ripple.y));
      const edge = Math.max(0, Math.min(1, (radius - reach) / PIXEL_RIPPLE_TAIL));
      const fade = 1 - edge * edge * (3 - 2 * edge);
      if (distance > 0) {
        const push = Math.exp(-Math.pow((distance - radius) * 60, 2)) * fade * 11;
        x += dx / distance / pixelRipples.aspect * width / height * push;
        y += dy / distance * push;
      }
    }
    flockCtx.save();
    flockCtx.translate(x, y);
    flockCtx.rotate(bird.angle + Math.sin(time * .22 + bird.phase) * .12);
    flockCtx.scale(bird.flip, 1);
    // The flock stays opaque above the refracted sky.
    flockCtx.globalAlpha = 1;
    const size = bird.size * scale;
    flockCtx.drawImage(sprite, -size / 2, -size / 2, size, size);
    flockCtx.restore();
  }
}

// Original learner-site pixel art, framed in this section only. The still image
// behind the canvas uses the chosen palette when WebGL is unavailable or lost.
function createSky() {
  sky.hidden = true;
  const gl = sky.getContext('webgl2', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const fragment = preset.image ? pixelFragmentSource : pixelFragmentSource.replace(
    /const vec3 PALETTE\[9\]=vec3\[\]\([\s\S]*?\);/,
    `const vec3 PALETTE[9]=vec3[](${preset.palette.map(colour => `vec3(${colour.map(channel => channel.toFixed(3)).join(',')})`).join(',')});`,
  ).replace('colour*=1.0-navigation*.40;', 'colour*=1.0-navigation*.12;');
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const pixel = compile(gl.FRAGMENT_SHADER, fragment);
  if (!vertex || !pixel) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, pixel);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(pixel);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.uniform1i(gl.getUniformLocation(program, 'nebula_noise'), 0);
  gl.uniform1f(gl.getUniformLocation(program, 'home_view'), 1);
  gl.uniform1f(gl.getUniformLocation(program, 'pixel_view'), preset.image ? 1 : 0);
  if (!preset.image) {
    gl.uniform3fv(gl.getUniformLocation(program, 'star_low'), preset.stars[0]);
    gl.uniform3fv(gl.getUniformLocation(program, 'star_high'), preset.stars[1]);
    gl.uniform3fv(gl.getUniformLocation(program, 'meteor_tint'), preset.meteor);
  }
  // Pixel mode uses the reference texture filtering and cover-framing uniforms.
  const pixelTexture = preset.image ? gl.createTexture() : null;
  let pixelLoaded = false;
  if (pixelTexture) {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, pixelTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([11, 19, 30, 255]));
    gl.uniform1i(gl.getUniformLocation(program, 'pixel_sky'), 1);
    gl.uniform3fv(gl.getUniformLocation(program, 'ink'), preset.ink);
  }
  const resolution = gl.getUniformLocation(program, 'resolution');
  const clock = gl.getUniformLocation(program, 'clock');
  let loaded = false;
  function loadPixel() {
    if (!pixelTexture || !fallbackImage.complete || !fallbackImage.naturalWidth || gl.isContextLost()) return;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, pixelTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fallbackImage);
    gl.uniform2f(gl.getUniformLocation(program, 'pixel_size'), fallbackImage.naturalWidth, fallbackImage.naturalHeight);
    pixelLoaded = true;
    sky.hidden = !loaded;
  }
  loadPixel();
  const noise = new Image();
  noise.onload = () => {
    if (gl.isContextLost()) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, noise);
    loaded = true;
    sky.hidden = Boolean(preset.image && !pixelLoaded);
    draw();
  };
  noise.src = 'assets/galaxy-noise.png';
  sky.hidden = true;
  return {
    loadPixel,
    draw(seconds) {
      if (!loaded || (preset.image && !pixelLoaded) || gl.isContextLost()) return;
      gl.viewport(0, 0, sky.width, sky.height);
      gl.uniform2f(resolution, sky.width, sky.height);
      gl.uniform1f(clock, seconds);
      const values = new Float32Array(48), swashes = new Float32Array(24);
      pixelDots = pixelDots.filter(point => seconds - point.born < 1.5);
      pixelDots.forEach((point, index) => {
        values.set([point.x, point.y, seconds - point.born, 1], index * 4);
        swashes.set([point.dx, point.dy], index * 2);
      });
      const rippleValues = new Float32Array(MAX_PIXEL_RIPPLES * 3);
      pixelRipples.active.forEach((ripple, index) => {
        rippleValues.set([ripple.x, ripple.y, seconds - ripple.born], index * 3);
      });
      gl.uniform4fv(gl.getUniformLocation(program, 'brush[0]'), values);
      gl.uniform2fv(gl.getUniformLocation(program, 'swash[0]'), swashes);
      gl.uniform3fv(gl.getUniformLocation(program, 'ripples[0]'), rippleValues);
      gl.uniform1i(gl.getUniformLocation(program, 'rippleCount'), pixelRipples.active.length);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
  };
}

function draw() {
  pixelRipples.aspect = sky.width / sky.height;
  pixelRipples.expire(time);
  renderer?.draw(time);
  drawFlock();
}

function animate(now) {
  frame = 0;
  if (calm || !inView || document.hidden) return;
  if (!previous || now - previous >= 32) {
    time += previous ? Math.min((now - previous) / 1000, .1) : 0;
    previous = now;
    draw();
  }
  frame = requestAnimationFrame(animate);
}
function sync() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  previous = 0;
  if (!calm && inView && !document.hidden) frame = requestAnimationFrame(animate);
}
function applyCalm() {
  document.body.classList.toggle('is-calm', calm);
  if (calmButton) {
    calmButton.setAttribute('aria-pressed', String(calm));
    calmButton.textContent = calm ? 'Resume motion' : 'Pause motion';
  }
  // Freeze motion on pause; the native button stays available for piano notes.
  draw();
  sync();
}
art.addEventListener('click', event => {
  playNextNote();
  if (calm) return;
  const rect = art.getBoundingClientRect();
  const keyboard = event.detail === 0;
  const x = keyboard ? .5 : (event.clientX - rect.left) / rect.width;
  const y = keyboard ? .5 : (event.clientY - rect.top) / rect.height;
  pixelRipples.add(x, y, time);
  recordPixelBrush(x, y, true);
  draw();
});
art.addEventListener('pointermove', event => {
  if (calm || event.pointerType === 'touch') return;
  const rect = art.getBoundingClientRect();
  pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  recordPixelBrush(pointer.x / rect.width, pointer.y / rect.height);
}, { passive: true });
art.addEventListener('pointerleave', () => { pointer = null; });
calmButton?.addEventListener('click', () => { calm = !calm; applyCalm(); });
preference.addEventListener('change', event => { calm = event.matches; applyCalm(); });
sky.addEventListener('webglcontextlost', event => { event.preventDefault(); sky.hidden = true; renderer = null; });
sky.addEventListener('webglcontextrestored', () => { renderer = createSky(); draw(); });
new ResizeObserver(entries => {
  const rect = entries[0].contentRect;
  width = Math.max(1, rect.width);
  height = Math.max(1, rect.height);
  const framing = getSkyFrame(width, height);
  sky.width = framing.width;
  sky.height = framing.height;
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  flockCanvas.width = Math.round(width * ratio);
  flockCanvas.height = Math.round(height * ratio);
  drawFallback();
  draw();
}).observe(art);
new IntersectionObserver(entries => { inView = entries[0].isIntersecting; sync(); }, { threshold: .01 }).observe(art);
document.addEventListener('visibilitychange', sync);
drawFallback();
renderer = createSky();
['assets/toucan-logo-flat.png', 'assets/toucan-logo-outline.png'].forEach((path, index) => {
  const image = new Image();
  image.onload = () => {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 100;
    const spriteContext = sprite.getContext('2d');
    if (spriteContext) { spriteContext.drawImage(image, 0, 0, 100, 100); sprites[index] = sprite; }
    draw();
  };
  image.src = path;
});
applyCalm();

// Keyboard gestures feed the same wave pool and flock as direct sky clicks.
initHeroKeyboard(x => {
  if (calm) return;
  pixelRipples.add(x, .65, time);
  recordPixelBrush(x, .65, true);
  draw();
});
