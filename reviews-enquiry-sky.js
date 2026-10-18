import {
  vertexSource,
  pixelFragmentSource,
  SKY_PRESETS,
  MAX_PIXEL_RIPPLES,
  PIXEL_RIPPLE_SPEED,
  PIXEL_RIPPLE_TAIL,
} from './hero-sky-shaders.js?v=20261017-ripple-1';

const scene = document.querySelector('[data-enquiry-sky]');
const art = scene?.querySelector('[data-enquiry-sky-button]');
const fallback = scene?.querySelector('[data-enquiry-sky-fallback]');
const sky = scene?.querySelector('[data-enquiry-sky-canvas]');

if (
  scene
  && art
  && fallback instanceof HTMLCanvasElement
  && sky instanceof HTMLCanvasElement
) {
  const fallbackCtx = fallback.getContext('2d');
  const heroPreset = document.getElementById('ripple-button')?.dataset.skyPreset;
  const preset = SKY_PRESETS.find(candidate => candidate.id === heroPreset) || SKY_PRESETS[0];
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');

  scene.dataset.skyPreset = preset.id;
  art.dataset.skyPreset = preset.id;
  sky.dataset.skyPreset = preset.id;

  const fallbackImage = new Image();
  fallbackImage.onload = () => {
    drawFallback();
    renderer?.loadPixel?.();
    draw();
  };
  fallbackImage.src = preset.image || 'assets/loading-pixel-sky.png';

  function drawFallback() {
    if (!fallbackCtx) return;
    fallback.width = sky.width;
    fallback.height = sky.height;
    fallbackCtx.fillStyle = preset.image
      ? '#0b131e'
      : `rgb(${preset.palette[2].map(channel => Math.round(channel * 255)).join(',')})`;
    fallbackCtx.fillRect(0, 0, fallback.width, fallback.height);
    if (!fallbackImage.complete || !fallbackImage.naturalWidth) return;
    const scale = Math.max(
      fallback.width / fallbackImage.naturalWidth,
      fallback.height / fallbackImage.naturalHeight,
    );
    const imageWidth = fallbackImage.naturalWidth * scale;
    const imageHeight = fallbackImage.naturalHeight * scale;
    fallbackCtx.imageSmoothingEnabled = !preset.image;
    fallbackCtx.drawImage(
      fallbackImage,
      (fallback.width - imageWidth) / 2,
      (fallback.height - imageHeight) / 2,
      imageWidth,
      imageHeight,
    );
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
    sky.hidden = true;
    const gl = sky.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'low-power',
    });
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
    gl.uniform1f(gl.getUniformLocation(program, 'pixel_view'), preset.image ? 1 : 0);
    if (!preset.image) {
      gl.uniform3fv(gl.getUniformLocation(program, 'star_low'), preset.stars[0]);
      gl.uniform3fv(gl.getUniformLocation(program, 'star_high'), preset.stars[1]);
      gl.uniform3fv(gl.getUniformLocation(program, 'meteor_tint'), preset.meteor);
    }

    const pixelTexture = preset.image ? gl.createTexture() : null;
    let pixelLoaded = false;
    if (pixelTexture) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, pixelTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
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
      gl.uniform3fv(gl.getUniformLocation(program, 'ink'), preset.ink);
    }

    const resolution = gl.getUniformLocation(program, 'resolution');
    const clock = gl.getUniformLocation(program, 'clock');
    let noiseLoaded = false;

    function loadPixel() {
      if (!pixelTexture || !fallbackImage.complete || !fallbackImage.naturalWidth || gl.isContextLost()) return;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, pixelTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fallbackImage);
      gl.uniform2f(
        gl.getUniformLocation(program, 'pixel_size'),
        fallbackImage.naturalWidth,
        fallbackImage.naturalHeight,
      );
      pixelLoaded = true;
      sky.hidden = !noiseLoaded;
    }

    loadPixel();
    const noise = new Image();
    noise.onload = () => {
      if (gl.isContextLost()) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, noise);
      noiseLoaded = true;
      sky.hidden = Boolean(preset.image && !pixelLoaded);
      draw();
    };
    noise.src = 'assets/galaxy-noise.png';

    return {
      loadPixel,
      draw(seconds) {
        if (!noiseLoaded || (preset.image && !pixelLoaded) || gl.isContextLost()) return;
        gl.viewport(0, 0, sky.width, sky.height);
        gl.uniform2f(resolution, sky.width, sky.height);
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

  scene.addEventListener('click', event => {
    if (calm) return;
    const rect = scene.getBoundingClientRect();
    const keyboard = event.detail === 0;
    const x = keyboard ? .5 : (event.clientX - rect.left) / rect.width;
    const y = keyboard ? .5 : (event.clientY - rect.top) / rect.height;
    pixelRipples.add(x, y, time);
    recordPixelBrush(x, y, true);
    draw();
  });
  scene.addEventListener('pointermove', event => {
    if (calm || event.pointerType === 'touch') return;
    const rect = scene.getBoundingClientRect();
    recordPixelBrush(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    );
  }, { passive: true });
  scene.addEventListener('pointerleave', () => { previousPixelPoint = null; });
  preference.addEventListener('change', event => {
    calm = event.matches;
    applyMotionPreference();
  });
  sky.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    sky.hidden = true;
    renderer = null;
  });
  sky.addEventListener('webglcontextrestored', () => {
    renderer = createSky();
    draw();
  });
  new ResizeObserver(() => {
    // This bar gets its height from padding. ResizeObserver.contentRect omits
    // that padding, which previously crushed the artwork to a 22px-tall
    // bitmap and then stretched it over the whole CTA.
    const rect = scene.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const pixelSize = 2.5;
    sky.width = Math.max(1, Math.round(width / pixelSize));
    sky.height = Math.max(1, Math.round(height / pixelSize));
    drawFallback();
    draw();
  }).observe(scene);
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    sync();
  }, { threshold: .01 }).observe(scene);
  document.addEventListener('visibilitychange', sync);

  drawFallback();
  renderer = createSky();
  applyMotionPreference();
}
