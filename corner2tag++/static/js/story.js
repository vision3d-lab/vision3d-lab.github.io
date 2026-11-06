/* Continuous display of recorded event observations and refined corners.
 * Paired-event mode interpolates only supplied coordinate pairs. Endpoint-image
 * mode crossfades genuine raw/aligned rasters and never invents event motion.
 * Signed examples preserve blue/red polarity with a pure-white zero value.
 * Detection follows the approved source ordering and row-snake connections.
 */
const POSITIVE = 'rgba(43,108,176,.48)';
const NEGATIVE = 'rgba(192,57,43,.48)';
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const smooth = (x) => x * x * (3 - 2 * x);
let initialization;

export function interpolateStoryPoint(observation, index, amount) {
  const t = clamp(Number(amount));
  if (observation.eventData) {
    const d = observation.eventData, j = index * 5;
    return [d[j] + (d[j+2] - d[j]) * t, d[j+1] + (d[j+3] - d[j+1]) * t];
  }
  const a = observation.raw[index], b = observation.warped[index];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function decodeStoryEvents(buffer, count) {
  if (buffer.byteLength !== count * 20) throw new Error('Incomplete recorded event buffer.');
  const view = new DataView(buffer), data = new Float32Array(count * 5);
  for (let i = 0; i < data.length; i++) {
    const value = view.getFloat32(i * 4, true);
    if (!Number.isFinite(value) || (i % 5 === 4 && value !== -1 && value !== 1)) {
      throw new Error('Invalid recorded event coordinate or polarity.');
    }
    data[i] = value;
  }
  return data;
}

// Match the supplied native event-raster convention exactly at both endpoints.
// Intermediate positions replay the same paired coordinates; no synthetic events.
export function rasterizeStoryEvents(observation, amount, pixels) {
  const { width, height, eventData: d } = observation, t = clamp(amount);
  pixels ||= new Uint8ClampedArray(width * height * 4);
  pixels.fill(255);
  for (let j = 0; j < d.length; j += 5) {
    const x = Math.floor(d[j] + (d[j+2] - d[j]) * t + .5);
    const y = Math.floor(d[j+1] + (d[j+3] - d[j+1]) * t + .5);
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const k = (y * width + x) * 4, positive = d[j+4] > 0;
    pixels[k] = positive ? 0 : 230;
    pixels[k+1] = positive ? 90 : 45;
    pixels[k+2] = positive ? 255 : 45;
  }
  return pixels;
}

export function storyState(progress, renderMode = 'paired-events') {
  const p = clamp(Number(progress), 0, 200);
  if (renderMode === 'image-endpoints') {
    return { warp: null, image: smooth(clamp(p / 100)), corners: clamp((p - 100) / 100) };
  }
  return { warp: clamp(p / 80), image: smooth(clamp((p - 80) / 20)), corners: clamp((p - 100) / 100) };
}

const modeOf = (data) => data.renderMode || 'paired-events';
const kindOf = (data) => data.accumulationKind || 'pIWE';
const alignedPath = (data) => modeOf(data) === 'image-endpoints' ? data.images.aligned : data.images.piweWhite;

export function storyViewport(cssWidth, cssHeight, bounds, deviceScale = 1) {
  const cropWidth = bounds[2] - bounds[0], cropHeight = bounds[3] - bounds[1];
  const aspect = cropWidth / cropHeight;
  const width = Math.min(cssWidth, cssHeight * aspect), height = width / aspect;
  const dpr = Math.min(Math.max(deviceScale, 1), 2);
  let pixelsX = Math.max(1, Math.floor(width * dpr)), pixelsY = Math.max(1, Math.floor(height * dpr));
  if (Number.isInteger(cropWidth) && Number.isInteger(cropHeight)) {
    let a = cropWidth, b = cropHeight;
    while (b) { const remainder = a % b; a = b; b = remainder; }
    const unitX = cropWidth / a, unitY = cropHeight / a;
    const units = Math.floor(Math.min(width / unitX, height / unitY) * dpr);
    if (units >= 1) { pixelsX = unitX * units; pixelsY = unitY * units; }
  }
  return { width, height, pixelsX, pixelsY };
}

function assertObservation(data) {
  const finitePoint = (point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite);
  if (!data || !['general', 'parallel'].includes(data.id) || !Number.isFinite(data.width) || !Number.isFinite(data.height)
    || data.width <= 0 || data.height <= 0 || !Array.isArray(data.corners) || !data.corners.every(finitePoint)) {
    throw new Error('Invalid recorded observation data.');
  }
  if (modeOf(data) === 'paired-events') {
    if (data.eventsBinary) {
      if (data.eventsBinary.format !== 'xy-warped-polarity-f32le' || data.eventsBinary.stride !== 5
        || typeof data.eventsBinary.url !== 'string' || !Number.isInteger(data.eventCount) || data.eventCount < 1
        || data.sampleCount !== data.eventCount || data.eventsBinary.bytes !== data.eventCount * 20) {
        throw new Error('Invalid recorded binary event metadata.');
      }
    } else if (!Array.isArray(data.raw) || !data.raw.length || !Array.isArray(data.warped) || !Array.isArray(data.polarity)
      || data.raw.length !== data.warped.length || data.raw.length !== data.polarity.length
      || data.sampleCount !== data.raw.length || !data.raw.every(finitePoint) || !data.warped.every(finitePoint)
      || !data.polarity.every((sign) => sign === -1 || sign === 1)) throw new Error('Invalid paired event data.');
  } else if (modeOf(data) === 'image-endpoints') {
    if (typeof data.images?.raw !== 'string' || typeof data.images?.aligned !== 'string'
      || !['IWE', 'pIWE'].includes(data.accumulationKind)
      || !['unsigned', 'polarity'].includes(data.endpointStyle)) throw new Error('Invalid recorded endpoint images.');
  } else {
    throw new Error('Unknown observation rendering mode.');
  }
  for (const bounds of [data.bounds, data.sensorBounds]) {
    if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite)
      || bounds[2] <= bounds[0] || bounds[3] <= bounds[1]) throw new Error('Invalid observation bounds.');
  }
  if (typeof alignedPath(data) !== 'string') throw new Error('The native accumulation image is missing.');
  const order = data.snakeIndices;
  if (!Array.isArray(order) || order.length !== data.corners.length || new Set(order).size !== order.length
    || !order.every((i) => Number.isInteger(i) && i >= 0 && i < data.corners.length)) throw new Error('Invalid recorded corner ordering.');
  if (!Array.isArray(data.snakeSegments) || data.snakeSegments.length !== Math.max(0, order.length - 1)) {
    throw new Error('The recorded row-snake connections are incomplete.');
  }
  data.snakeSegments.forEach((segment, i) => {
    if (!Array.isArray(segment.indices) || segment.indices.length !== 2
      || segment.indices[0] !== order[i] || segment.indices[1] !== order[i + 1]
      || !['row', 'inter_row_diagonal'].includes(segment.kind) || !/^#[0-9a-f]{6}$/i.test(segment.color)) {
      throw new Error('Invalid recorded row-snake connection.');
    }
  });
}

async function createStory() {
  const canvas = document.getElementById('story-canvas');
  if (!canvas) return null;
  const fallback = document.getElementById('story-fallback');
  const slider = document.getElementById('story-progress');
  const description = document.getElementById('story-description');
  const status = document.getElementById('story-status');
  const caseButtons = [...document.querySelectorAll('[data-story-case]')];
  const controls = [...caseButtons, slider].filter(Boolean);
  const api = { ready: false };
  window.corner2tagStory = api;
  let controlsDisabled = true;
  function disableControls(disabled) {
    controlsDisabled = disabled;
    controls.forEach((control) => { control.disabled = disabled; });
    canvas.setAttribute('aria-disabled', String(disabled));
  }
  function setStatus(message, state = 'ready') {
    if (status) { status.textContent = message; status.dataset.state = state; }
  }
  disableControls(true);
  canvas.hidden = true; canvas.dataset.ready = 'loading';
  if (fallback) fallback.hidden = false;
  setStatus('Loading observation...', 'loading');

  try {
    if (!slider) throw new Error('The observation scrubber is missing.');
    const response = await fetch(new URL('static/data/motion-story.json?v=20261106-parallel-w256', document.baseURI));
    if (!response.ok) throw new Error(`Observation data returned HTTP ${response.status}.`);
    const source = await response.json();
    if (![1, 2].includes(source.schema) || !Array.isArray(source.cases)) throw new Error('Unknown observation schema.');
    source.cases.forEach(assertObservation);
    const cases = new Map(source.cases.map((data) => [data.id, data]));
    if (!cases.has('general') || !cases.has('parallel')) throw new Error('Both recorded cases are required.');
    const loadedImages = new Map();
    function imageFor(data) {
      if (!loadedImages.has(data.id)) {
        const loadImage = (path) => new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            if (image.naturalWidth !== data.width || image.naturalHeight !== data.height) {
              reject(new Error('Image dimensions do not match the recorded coordinates.'));
            } else resolve(image);
          };
          image.onerror = () => reject(new Error('The native observation image could not be loaded.'));
          image.src = new URL(path, document.baseURI).href;
        });
        const loadEvents = async () => {
          if (!data.eventsBinary || data.eventData) return;
          const response = await fetch(new URL(data.eventsBinary.url, document.baseURI));
          if (!response.ok) throw new Error('The recorded event data could not be loaded.');
          data.eventData = decodeStoryEvents(await response.arrayBuffer(), data.eventCount);
        };
        const promise = Promise.all([
          loadImage(alignedPath(data)), modeOf(data) === 'image-endpoints' ? loadImage(data.images.raw) : Promise.resolve(null),
          loadEvents(),
        ]).then(([aligned, raw]) => ({ aligned, raw }));
        loadedImages.set(data.id, promise);
        promise.catch(() => { if (loadedImages.get(data.id) === promise) loadedImages.delete(data.id); });
      }
      return loadedImages.get(data.id);
    }

    let current = cases.get('general'), currentImages = await imageFor(current);
    let progress = 0, drawFrame = 0, visible = true, switchVersion = 0, drag = null;
    const eventRasters = new Map();
    function eventRaster(data, warp) {
      if (!eventRasters.has(data.id)) {
        const surface = document.createElement('canvas');
        surface.width = data.width; surface.height = data.height;
        const context = surface.getContext('2d');
        eventRasters.set(data.id, { surface, context, pixels: context.createImageData(data.width, data.height), warp: -1 });
      }
      const raster = eventRasters.get(data.id);
      if (raster.warp !== warp) {
        rasterizeStoryEvents(data, warp, raster.pixels.data);
        raster.context.putImageData(raster.pixels, 0, 0);
        raster.warp = warp;
      }
      return raster.surface;
    }
    const indices = new Map(source.cases.map((data) => {
      const groups = { positive: [], negative: [] };
      data.polarity?.forEach((sign, index) => (sign > 0 ? groups.positive : groups.negative).push(index));
      return [data.id, groups];
    }));
    const cornerColors = new Map(source.cases.map((data) => {
      const colors = new Map();
      (data.snakeRows || []).forEach((row, i) => row.forEach((index) => colors.set(index, data.rowColors[i])));
      return [data.id, colors];
    }));

    function syncCopy() {
      const visual = storyState(progress, modeOf(current)), accumulation = kindOf(current);
      caseButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.storyCase === current.id)));
      slider.value = String(progress);
      let text, valueText;
      if (modeOf(current) === 'image-endpoints' && progress < 100) {
        text = progress === 0 ? 'Events trace the moving checkerboard.' : 'Motion compensation brings the checkerboard into focus.';
        valueText = progress === 0 ? 'Raw events' : `Raw-to-${accumulation} comparison, ${Math.round(visual.image * 100)} percent aligned image`;
      } else if (progress < 100) {
        text = progress === 0 ? 'Raw events trace the moving checkerboard.' : 'Motion compensation aligns events to a common reference time.';
        valueText = progress === 0 ? 'Raw events' : `${Math.round(visual.warp * 100)} percent motion compensation`;
      } else if (progress === 100) {
        text = 'Warped events align the checkerboard edges at a common reference time.';
        valueText = 'Warped raw events, ready for corner detection';
      } else {
        text = current.cornerScope === 'recorded_patch_only'
          ? 'The recorded refined corner is shown on the aligned events.'
          : 'Ordered corners establish correspondences for calibration.';
        valueText = `${Math.floor(visual.corners * current.corners.length + 1e-9)} of ${current.corners.length} recorded corner${current.corners.length === 1 ? '' : 's'} revealed`;
      }
      if (description) description.textContent = text;
      slider.setAttribute('aria-valuetext', valueText);
      canvas.setAttribute('aria-label', `${current.label}. ${valueText}. ${text}`);
      canvas.setAttribute('aria-description', modeOf(current) === 'image-endpoints'
        ? 'Recorded raw and aligned event images share one native crop. Intermediate views crossfade these two real images. Drag horizontally to scrub, or use the range control.'
        : 'Recorded event coordinates and native polarity-weighted accumulation. Drag horizontally to scrub, or use the range control. Positive events are blue and negative events are red.');
      canvas.dataset.progress = String(progress);
    }

    function draw() {
      const rect = canvas.getBoundingClientRect();
      const { width, height, pixelsX: px, pixelsY: py } = storyViewport(rect.width, rect.height, current.bounds, window.devicePixelRatio || 1);
      if (width < 2 || height < 2) return;
      if (canvas.width !== px || canvas.height !== py) { canvas.width = px; canvas.height = py; }
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas rendering is unavailable.');
      ctx.setTransform(px / width, 0, 0, py / height, 0, 0);
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
      const [xmin, ymin, xmax, ymax] = current.bounds;
      const pad = width < 360 ? 5 : 8;
      const scale = Math.min((width - pad * 2) / (xmax - xmin), (height - pad * 2) / (ymax - ymin));
      const ox = (width - (xmax - xmin) * scale) / 2, oy = (height - (ymax - ymin) * scale) / 2;
      const point = (p) => [ox + (p[0] - xmin) * scale, oy + (p[1] - ymin) * scale];
      const visual = storyState(progress, modeOf(current));
      ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, (xmax - xmin) * scale, (ymax - ymin) * scale); ctx.clip();
      const drawRaster = (image, alpha) => {
        const [left, top, right, bottom] = current.sensorBounds, [x, y] = point([left, top]);
        ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, x, y, (right - left) * scale, (bottom - top) * scale);
      };
      if (modeOf(current) === 'image-endpoints' && visual.image < 1) {
        // Keep the opaque raw endpoint underneath: source-over alpha then
        // gives the exact linear blend of the two real raster colors.
        drawRaster(currentImages.raw, 1);
      } else if (current.eventData && visual.image < 1) {
        drawRaster(eventRaster(current, visual.warp), 1);
      } else if (modeOf(current) === 'paired-events' && visual.image < 1) {
        ctx.globalAlpha = 1 - visual.image;
        const dot = clamp(scale * .72, .7, 1.55), half = dot / 2, groups = indices.get(current.id);
        for (const [group, color] of [[groups.negative, NEGATIVE], [groups.positive, POSITIVE]]) {
          ctx.fillStyle = color;
          for (const index of group) {
            const p = interpolateStoryPoint(current, index, visual.warp);
            const x = ox + (p[0] - xmin) * scale, y = oy + (p[1] - ymin) * scale;
            ctx.fillRect(x - half, y - half, dot, dot);
          }
        }
      }
      if (visual.image > 0) {
        drawRaster(currentImages.aligned, visual.image);
      }
      if (visual.corners > 0) {
        const revealed = visual.corners * current.snakeIndices.length;
        const radius = current.corners.length === 1 ? clamp(scale * 3, 3.8, 5.2) : clamp(scale * 2.4, 2.6, 4.2);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // Explicit source segments include the canonical inter-row diagonals.
        current.snakeSegments.forEach((segment, index) => {
          const fraction = clamp(revealed - (index + 1));
          if (!fraction) return;
          const a = point(current.corners[segment.indices[0]]), b = point(current.corners[segment.indices[1]]);
          const end = [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
          ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...end);
          ctx.strokeStyle = 'rgba(22,44,56,.42)'; ctx.lineWidth = clamp(scale * 1.2, 2.2, 3.3); ctx.stroke();
          ctx.strokeStyle = segment.color; ctx.lineWidth = clamp(scale * .7, 1, 1.8); ctx.stroke();
        });
        current.snakeIndices.forEach((index, order) => {
          const fraction = clamp(revealed - order);
          if (!fraction) return;
          const [x, y] = point(current.corners[index]);
          ctx.globalAlpha = fraction; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = cornerColors.get(current.id).get(index) || '#d33682'; ctx.fill();
          ctx.strokeStyle = '#162c38'; ctx.lineWidth = 1; ctx.stroke();
        });
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    function requestDraw() {
      if (drawFrame || !visible || document.hidden) return;
      drawFrame = requestAnimationFrame(() => { drawFrame = 0; draw(); });
    }
    function setProgress(value) {
      if (!Number.isFinite(Number(value))) return;
      progress = clamp(Number(value), 0, 200);
      syncCopy(); requestDraw();
    }
    function endDrag(event) {
      if (!drag || (event && event.pointerId !== drag.id)) return;
      const id = drag.id; drag = null;
      if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
    }
    async function setCase(id) {
      if (!cases.has(id) || id === current.id) return;
      const version = ++switchVersion, next = cases.get(id);
      endDrag(); disableControls(true); setStatus('Loading observation...', 'loading');
      try {
        const images = await imageFor(next);
        if (version !== switchVersion) return;
        current = next; currentImages = images;
        if (fallback) fallback.src = new URL(current.images.poster || alignedPath(current), document.baseURI).href;
        syncCopy(); requestDraw(); setStatus('');
      } catch (error) {
        if (version !== switchVersion) return;
        setStatus('This observation could not load. The previous view is still shown.', 'error');
        api.error = String(error.message || error);
      } finally {
        if (version === switchVersion) disableControls(false);
      }
    }

    slider.min = '0'; slider.max = '200'; slider.step = '0.1';
    slider.addEventListener('input', () => setProgress(slider.value));
    // Native arrow keys retain fine steps; Page keys provide a useful larger step.
    slider.addEventListener('keydown', (event) => {
      if (event.key === 'PageUp' || event.key === 'PageDown') {
        event.preventDefault(); setProgress(progress + (event.key === 'PageUp' ? 20 : -20));
      }
    });
    caseButtons.forEach((button) => button.addEventListener('click', () => setCase(button.dataset.storyCase)));
    canvas.style.touchAction = 'pan-y';
    canvas.style.cursor = 'ew-resize';
    canvas.addEventListener('pointerdown', (event) => {
      if (controlsDisabled || event.isPrimary === false || event.button !== 0 || drag) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, progress, active: false };
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.active) {
        if (Math.abs(dx) < 4 || Math.abs(dx) < Math.abs(dy)) return;
        drag.active = true;
      }
      if (event.cancelable) event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, storyViewport(rect.width, rect.height, current.bounds).width);
      setProgress(drag.progress + dx / width * 200);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, endDrag);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        endDrag(); if (drawFrame) cancelAnimationFrame(drawFrame); drawFrame = 0;
      } else requestDraw();
    });
    if ('ResizeObserver' in window) new ResizeObserver(requestDraw).observe(canvas);
    else window.addEventListener('resize', requestDraw, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        if (!visible) { endDrag(); if (drawFrame) cancelAnimationFrame(drawFrame); drawFrame = 0; }
        else requestDraw();
      }).observe(canvas);
    }
    // No autoplay or inertial animation: direct manipulation also respects
    // reduced-motion preferences without changing the scientific sequence.
    canvas.hidden = false; syncCopy(); draw();
    if (fallback) fallback.hidden = true;
    canvas.dataset.ready = 'true'; setStatus(''); disableControls(false);
    Object.assign(api, {
      ready: true, setCase, setProgress,
      snapshot: () => ({ case: current.id, progress, visual: storyState(progress, modeOf(current)), dragging: Boolean(drag?.active),
        renderMode: modeOf(current), accumulationKind: kindOf(current),
        window: current.window, sampleCount: current.sampleCount, eventCount: current.eventCount,
        cornerCount: current.corners.length, revealedCorners: Math.floor(storyState(progress, modeOf(current)).corners * current.corners.length + 1e-9),
        cornerScope: current.cornerScope, snakeIndices: [...current.snakeIndices],
        snakeSegments: current.snakeSegments.map((segment) => ({ ...segment, indices: [...segment.indices] })),
        bounds: [...current.bounds] }),
    });
    imageFor(cases.get('parallel')).catch(() => {});
    return api;
  } catch (error) {
    disableControls(true); canvas.hidden = true; canvas.dataset.ready = 'error';
    if (fallback) fallback.hidden = false;
    setStatus('Interactive observation unavailable. Please reload to try again.', 'error');
    api.error = String(error.message || error);
    console.error('Corner2Tag++ observation:', error);
    return api;
  }
}

export function initStory() {
  if (!initialization) initialization = createStory();
  return initialization;
}
