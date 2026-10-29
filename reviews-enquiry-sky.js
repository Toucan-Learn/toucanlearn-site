import {
  vertexSource,
  pixelFragmentSource,
  SKY_PRESETS,
  MAX_PIXEL_RIPPLES,
  PIXEL_RIPPLE_SPEED,
  PIXEL_RIPPLE_TAIL,
} from './hero-sky-shaders.js?v=20261017-ripple-1';
import { getSkyFrame } from './sky-framing.js?v=20261019-ctasky-1';

const scene = document.querySelector('[data-enquiry-sky]');
const art = scene?.querySelector('[data-enquiry-sky-button]');
const fallback = scene?.querySelector('[data-enquiry-sky-fallback]');
const sky = scene?.querySelector('[data-enquiry-sky-canvas]');
const heroArt = document.querySelector('.world-art');
// Round 64 (Joshua, 18 Oct 2026): "every cta should have that pixel art, a new
// one can come up each time". Inner pages have no opening: they frame the sky
// at the opening art's laptop/phone size and pick a random sky on every visit.
const STANDALONE_FRAME = { width: 638, height: 450, phoneHeight: 340 };

if (
  scene
  && art
  && fallback instanceof HTMLCanvasElement
  && sky instanceof HTMLCanvasElement
) {
  const fallbackCtx = fallback.getContext('2d');
  const heroPreset = document.getElementById('ripple-button')?.dataset.skyPreset;
  const followsPageTheme = scene.dataset.skyTheme === 'page';
  const deviceTheme = followsPageTheme ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const pagePreset = () => {
    const dark = document.documentElement.dataset.theme === 'dark'
      || (document.documentElement.dataset.theme !== 'light' && deviceTheme.matches);
    return SKY_PRESETS.find(candidate => candidate.id === (dark ? 'og' : 'earth'));
  };
  let preset = followsPageTheme ? pagePreset() : (
    SKY_PRESETS.find(candidate => candidate.id === heroPreset)
    || (heroArt ? SKY_PRESETS[0] : SKY_PRESETS[Math.floor(Math.random() * SKY_PRESETS.length)])
  );
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let fallbackImage = new Image();
  let imageRevision = 0;

  function drawFallback() {
    if (!fallbackCtx) return;
    fallback.width = sky.width;
    fallback.height = sky.height;
    fallbackCtx.fillStyle = preset.image
      ? '#0b131e'
      : `rgb(${preset.palette[2].map(channel => Math.round(channel * 255)).join(',')})`;
    fallbackCtx.fillRect(0, 0, fallback.width, fallback.height);
    if (!fallbackImage.complete || !fallbackImage.naturalWidth) return;
    const scale = framing.coverScale;
    const imageWidth = fallbackImage.naturalWidth * scale;
    const imageHeight = fallbackImage.naturalHeight * scale;
    fallbackCtx.imageSmoothingEnabled = !preset.image;
    const left = (fallback.width - imageWidth) / 2;
    // The centre tile has the opening's crop; adjacent tiles meet at the same
    // image edge, matching the WebGL texture's mirrored horizontal repeat.
    for (let tile = Math.floor(-left / imageWidth); left + tile * imageWidth < fallback.width; tile++) {
      const x = left + tile * imageWidth;
      const mirrored = Math.abs(tile % 2) === 1;
      fallbackCtx.save();
      fallbackCtx.translate(mirrored ? x + imageWidth : x, 0);
      fallbackCtx.scale(mirrored ? -1 : 1, 1);
      fallbackCtx.drawImage(fallbackImage, 0, (fallback.height - imageHeight) / 2, imageWidth, imageHeight);
      fallbackCtx.restore();
    }
    if (preset.image) return;
    const pixels = fallbackCtx.getImageData(0, 0, fallback.width, fallback.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const light = (
        pixels.data[index] * .2126
        + pixels.data[index + 1] * .7152
        + pixels.data[index + 2] * .0722
      ) / 255;
      const colour = preset.palette[Math.min(8, Math.round(light * 8))];
      for (let channel = 0; channel < 3; channel++) {
        pixels.data[index + channel] = Math.round(colour[channel] * 255);
      }
    }
    fallbackCtx.putImageData(pixels, 0, 0);
  }

  class PixelRipplePool {
    active = [];
    aspect = 1;

    expire(now) {
      this.active = this.active.filter(ripple => (
        (now - ripple.born) * PIXEL_RIPPLE_SPEED
        < Math.hypot(
          Math.max(ripple.x, 1 - ripple.x) * this.aspect,
          Math.max(ripple.y, 1 - ripple.y),
        ) + PIXEL_RIPPLE_TAIL
      ));
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
  let calm = preference.matches;
  let inView = true;
  let frame = 0;
  let previous = 0;
  let time = 0;
  let renderer = null;
  let framing = getSkyFrame(1, 1);

  function recordPixelBrush(x, y, down = false) {
    const now = performance.now();
    if (!down && now - lastPixelInput < 24) return;
    lastPixelInput = now;
    const follows = previousPixelPoint && now - previousPixelPoint.time < 180 && !down;
    const aspect = sky.width / Math.max(1, sky.height);
    const dx = follows ? (x - previousPixelPoint.x) * aspect : .025;
    const dy = follows ? y - previousPixelPoint.y : 0;
    pixelDots.push({ x, y, dx, dy, born: time });
    previousPixelPoint = { x, y, time: now };
    pixelDots = pixelDots.slice(-12);
  }

  function createSky() {
    // Each renderer owns its palette and image even if a theme changes mid-load.
    const renderPreset = preset;
    const sourceImage = fallbackImage;
    let disposed = false;
    sky.hidden = true;
    const gl = sky.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'low-power',
    });
    if (!gl) return null;

    // Only the CTA needs extra horizontal image coverage. Keep the opening's
    // shader unchanged and supply its cover scale to this image-mode variant.
    const framedPixelFragmentSource = pixelFragmentSource.replace(
      'uniform vec2 pixel_size;',
      'uniform vec2 pixel_size;\nuniform float pixel_cover_scale;',
    ).replace(
      'float cover_scale=max(grid.x/pixel_size.x,grid.y/pixel_size.y);',
      'float cover_scale=pixel_cover_scale;',
    );
    const fragment = renderPreset.image ? framedPixelFragmentSource : pixelFragmentSource.replace(
      /const vec3 PALETTE\[9\]=vec3\[\]\([\s\S]*?\);/,
      `const vec3 PALETTE[9]=vec3[](${renderPreset.palette.map(colour => `vec3(${colour.map(channel => channel.toFixed(3)).join(',')})`).join(',')});`,
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
    if (!vertex || !pixel) {
      if (vertex) gl.deleteShader(vertex);
      if (pixel) gl.deleteShader(pixel);
      return null;
    }
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, pixel);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(pixel);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const noiseTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.uniform1i(gl.getUniformLocation(program, 'nebula_noise'), 0);
    gl.uniform1f(gl.getUniformLocation(program, 'home_view'), 1);
    gl.uniform1f(gl.getUniformLocation(program, 'pixel_view'), renderPreset.image ? 1 : 0);
    if (!renderPreset.image) {
      gl.uniform3fv(gl.getUniformLocation(program, 'star_low'), renderPreset.stars[0]);
      gl.uniform3fv(gl.getUniformLocation(program, 'star_high'), renderPreset.stars[1]);
      gl.uniform3fv(gl.getUniformLocation(program, 'meteor_tint'), renderPreset.meteor);
    }

    const pixelTexture = renderPreset.image ? gl.createTexture() : null;
    let pixelLoaded = false;
    if (pixelTexture) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, pixelTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([11, 19, 30, 255]),
      );
      gl.uniform1i(gl.getUniformLocation(program, 'pixel_sky'), 1);
      gl.uniform3fv(gl.getUniformLocation(program, 'ink'), renderPreset.ink);
    }

    const resolution = gl.getUniformLocation(program, 'resolution');
    const clock = gl.getUniformLocation(program, 'clock');
    let noiseLoaded = false;

    function loadPixel() {
      if (disposed || !pixelTexture || !sourceImage.complete || !sourceImage.naturalWidth || gl.isContextLost()) return;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, pixelTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceImage);
      gl.uniform2f(
        gl.getUniformLocation(program, 'pixel_size'),
        sourceImage.naturalWidth,
        sourceImage.naturalHeight,
      );
      pixelLoaded = true;
      sky.hidden = !noiseLoaded;
    }

    loadPixel();
    const noise = new Image();
    noise.onload = () => {
      if (disposed || gl.isContextLost()) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, noise);
      noiseLoaded = true;
      sky.hidden = Boolean(renderPreset.image && !pixelLoaded);
      draw();
    };
    noise.src = 'assets/galaxy-noise.png';

    return {
      loadPixel,
      destroy() {
        if (disposed) return;
        disposed = true;
        noise.onload = null;
        gl.deleteTexture(noiseTexture);
        if (pixelTexture) gl.deleteTexture(pixelTexture);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
      },
      draw(seconds) {
        if (disposed || !noiseLoaded || (renderPreset.image && !pixelLoaded) || gl.isContextLost()) return;
        gl.viewport(0, 0, sky.width, sky.height);
        gl.uniform2f(resolution, sky.width, sky.height);
        if (renderPreset.image) gl.uniform1f(gl.getUniformLocation(program, 'pixel_cover_scale'), framing.coverScale);
        gl.uniform1f(clock, seconds);

        const brushValues = new Float32Array(48);
        const swashes = new Float32Array(24);
        pixelDots = pixelDots.filter(point => seconds - point.born < 1.5);
        pixelDots.forEach((point, index) => {
          brushValues.set([point.x, point.y, seconds - point.born, 1], index * 4);
          swashes.set([point.dx, point.dy], index * 2);
        });
        const rippleValues = new Float32Array(MAX_PIXEL_RIPPLES * 3);
        pixelRipples.active.forEach((ripple, index) => {
          rippleValues.set([ripple.x, ripple.y, seconds - ripple.born], index * 3);
        });
        gl.uniform4fv(gl.getUniformLocation(program, 'brush[0]'), brushValues);
        gl.uniform2fv(gl.getUniformLocation(program, 'swash[0]'), swashes);
        gl.uniform3fv(gl.getUniformLocation(program, 'ripples[0]'), rippleValues);
        gl.uniform1i(gl.getUniformLocation(program, 'rippleCount'), pixelRipples.active.length);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },
    };
  }

  function draw() {
    pixelRipples.aspect = sky.width / Math.max(1, sky.height);
    pixelRipples.expire(time);
    renderer?.draw(time);
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

  function applyMotionPreference() {
    art.disabled = calm;
    draw();
    sync();
  }

  function pointInSky(event) {
    const canvas = sky.hidden ? fallback : sky;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: .5, y: .5 };
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  scene.addEventListener('click', event => {
    if (calm) return;
    const keyboard = event.detail === 0;
    const point = keyboard ? { x: .5, y: .5 } : pointInSky(event);
    const { x, y } = point;
    pixelRipples.add(x, y, time);
    recordPixelBrush(x, y, true);
    draw();
  });
  scene.addEventListener('pointermove', event => {
    if (calm || event.pointerType === 'touch') return;
    const { x, y } = pointInSky(event);
    recordPixelBrush(x, y);
  }, { passive: true });
  scene.addEventListener('pointerleave', () => { previousPixelPoint = null; });
  preference.addEventListener('change', event => {
    calm = event.matches;
    applyMotionPreference();
  });
  sky.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    sky.hidden = true;
    renderer?.destroy();
    renderer = null;
  });
  sky.addEventListener('webglcontextrestored', () => {
    renderer?.destroy();
    renderer = createSky();
    draw();
  });
  function resizeSky() {
    const phone = window.matchMedia('(max-width: 760px)').matches;
    // The homepage piano is mounted only while selected. A detached or newly
    // remounted sky has no size, which collapsed this one to a 1px line.
    const hero = [heroArt, document.querySelector('.world-art')].find(node => node?.isConnected && node.clientHeight > 0);
    framing = getSkyFrame(
      Math.max(1, art.clientWidth),
      Math.max(1, hero ? hero.clientHeight : Math.max(scene.clientHeight, phone ? STANDALONE_FRAME.phoneHeight : STANDALONE_FRAME.height)),
      fallbackImage.naturalWidth,
      fallbackImage.naturalHeight,
      hero ? hero.getBoundingClientRect().width : Math.min(art.clientWidth, STANDALONE_FRAME.width),
    );
    sky.width = framing.width;
    sky.height = framing.height;
    // Direct style properties follow the existing carousel's CSP-safe sizing
    // pattern. Explicit height avoids aspect-ratio rounding stretching cells.
    sky.style.height = `${framing.cssHeight}px`;
    fallback.style.height = `${framing.cssHeight}px`;
    drawFallback();
    draw();
  }
  function rebuildSky(nextPreset) {
    renderer?.destroy();
    renderer = null;
    fallbackImage.onload = null;
    preset = nextPreset;
    scene.dataset.skyPreset = preset.id;
    art.dataset.skyPreset = preset.id;
    sky.dataset.skyPreset = preset.id;
    const revision = ++imageRevision;
    const image = new Image();
    fallbackImage = image;
    image.onload = () => {
      if (revision !== imageRevision || fallbackImage !== image) return;
      resizeSky();
      renderer?.loadPixel?.();
      draw();
    };
    image.src = preset.image || 'assets/loading-pixel-sky.png';
    resizeSky();
    renderer = createSky();
    draw();
  }

  if (followsPageTheme) {
    const syncPageTheme = () => {
      const nextPreset = pagePreset();
      if (nextPreset.id !== preset.id) rebuildSky(nextPreset);
    };
    new MutationObserver(syncPageTheme).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    deviceTheme.addEventListener('change', syncPageTheme);
  }

  const resizeObserver = new ResizeObserver(resizeSky);
  resizeObserver.observe(scene);
  if (heroArt) resizeObserver.observe(heroArt);
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    sync();
  }, { threshold: .01 }).observe(scene);
  document.addEventListener('visibilitychange', sync);

  rebuildSky(preset);
  applyMotionPreference();
}
