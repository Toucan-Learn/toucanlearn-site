import { vertexSource, originalFragmentSource } from './hero-sky-shaders.js';
import { RippleField, RIPPLE_TRAIL } from './hero-ripples.js';

const art = document.querySelector('.world-art');
const sky = document.getElementById('sky-canvas');
const rings = document.getElementById('ripple-canvas');
const ctx = rings.getContext('2d');
const flockCanvas = document.getElementById('flock-canvas');
const flockCtx = flockCanvas.getContext('2d');
const calmButton = document.getElementById('calm-button');
const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
const field = new RippleField();
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

function drawFlock(activeRings) {
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
    for (const ripple of activeRings) {
      const distance = Math.hypot(x - ripple.x, y - ripple.y);
      const difference = distance - ripple.radius;
      if (distance > 0 && Math.abs(difference) < 35) {
        const push = Math.sin(difference / 35 * Math.PI) * 11;
        x += (x - ripple.x) / distance * push;
        y += (y - ripple.y) / distance * push;
      }
    }
    flockCtx.save();
    flockCtx.translate(x, y);
    flockCtx.rotate(bird.angle + Math.sin(time * .22 + bird.phase) * .12);
    flockCtx.scale(bird.flip, 1);
    // The flock must occlude the rings underneath, not let them shine through.
    flockCtx.globalAlpha = 1;
    const size = bird.size * scale;
    flockCtx.drawImage(sprite, -size / 2, -size / 2, size, size);
    flockCtx.restore();
  }
}

// Original learner-site pixel art, framed in this section only. The still image
// behind the canvas remains the fallback when WebGL is unavailable or lost.
function createSky() {
  const gl = sky.getContext('webgl2', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const fragment = originalFragmentSource.replace(
    /const vec3 PALETTE\[9\]=vec3\[\]\([\s\S]*?\);/,
    `const vec3 PALETTE[9]=vec3[](
      vec3(.025,.063,.078),vec3(.037,.098,.110),vec3(.051,.137,.145),
      vec3(.086,.192,.184),vec3(.141,.259,.227),vec3(.216,.337,.271),
      vec3(.337,.439,.329),vec3(.490,.561,.420),vec3(.690,.710,.545)
    );`,
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
  const resolution = gl.getUniformLocation(program, 'resolution');
  const clock = gl.getUniformLocation(program, 'clock');
  let loaded = false;
  const noise = new Image();
  noise.onload = () => {
    if (gl.isContextLost()) return;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, noise);
    loaded = true;
    sky.hidden = false;
    draw();
  };
  noise.src = 'assets/galaxy-noise.png';
  sky.hidden = true;
  return {
    draw(seconds) {
      if (!loaded || gl.isContextLost()) return;
      gl.viewport(0, 0, sky.width, sky.height);
      gl.uniform2f(resolution, sky.width, sky.height);
      gl.uniform1f(clock, seconds);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
  };
}

function draw() {
  renderer?.draw(time);
  const activeRings = field.sample(time, width, height);
  drawFlock(activeRings);
  if (!ctx) return;
  ctx.clearRect(0, 0, rings.width, rings.height);
  const scaleX = rings.width / width;
  const scaleY = rings.height / height;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  for (const ring of activeRings) {
    // No opacity countdown: both waves remain visible until physically off-panel.
    for (const [offset, colour] of [[0, '#e6d3a29e'], [RIPPLE_TRAIL - 3, '#a8d9bb55']]) {
      if (ring.radius <= offset) continue;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius - offset, 0, Math.PI * 2);
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1.1 / scaleX;
      ctx.stroke();
    }
  }
  // Tiny rotated sprites have softened edge pixels. Mask the ripple layer as
  // well, so bright rings cannot bleed through those partially covered pixels.
  if (flockCtx) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(flockCanvas, 0, 0, width, height);
    ctx.restore();
  }
  ctx.resetTransform();
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
  calmButton.setAttribute('aria-pressed', String(calm));
  calmButton.textContent = calm ? 'Resume motion' : 'Pause motion';
  art.disabled = calm || !ctx;
  // Freeze the current picture and rings; never clear them on pause.
  draw();
  sync();
}
art.addEventListener('click', event => {
  if (calm || !ctx) return;
  const rect = art.getBoundingClientRect();
  const keyboard = event.detail === 0;
  field.add(keyboard ? .5 : (event.clientX - rect.left) / rect.width, keyboard ? .5 : (event.clientY - rect.top) / rect.height, time);
  draw();
});
art.addEventListener('pointermove', event => {
  if (calm || event.pointerType === 'touch') return;
  const rect = art.getBoundingClientRect();
  pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
}, { passive: true });
art.addEventListener('pointerleave', () => { pointer = null; });
calmButton.addEventListener('click', () => { calm = !calm; applyCalm(); });
preference.addEventListener('change', event => { calm = event.matches; applyCalm(); });
sky.addEventListener('webglcontextlost', event => { event.preventDefault(); sky.hidden = true; renderer = null; });
sky.addEventListener('webglcontextrestored', () => { renderer = createSky(); draw(); });
new ResizeObserver(entries => {
  const rect = entries[0].contentRect;
  width = Math.max(1, rect.width);
  height = Math.max(1, rect.height);
  const pixelSize = 2.5;
  for (const canvas of [sky, rings]) {
    canvas.width = Math.max(1, Math.round(width / pixelSize));
    canvas.height = Math.max(1, Math.round(height / pixelSize));
  }
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  flockCanvas.width = Math.round(width * ratio);
  flockCanvas.height = Math.round(height * ratio);
  draw();
}).observe(art);
new IntersectionObserver(entries => { inView = entries[0].isIntersecting; sync(); }, { threshold: .01 }).observe(art);
document.addEventListener('visibilitychange', sync);
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
