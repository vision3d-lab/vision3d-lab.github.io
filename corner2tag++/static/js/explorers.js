/* Scientific explorers. Values and coordinates come from recorded exports.
 * Display geometry is calculated here; no detector or calibration is run.
 */
const INK = '#162c38';
const BLUE = '#2b6cb0';
const RED = '#c0392b';
const MAGENTA = '#d33682';
const CYAN = '#00a6d6';
const MUTED = '#758795';
const GRID = '#dfe7ed';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const $ = (id) => document.getElementById(id);

export function bilinear(data, x, y) {
  const px = clamp(x - data.origin[0], 0, data.width - 1);
  const py = clamp(y - data.origin[1], 0, data.height - 1);
  const x0 = Math.floor(px), y0 = Math.floor(py);
  const x1 = Math.min(x0 + 1, data.width - 1), y1 = Math.min(y0 + 1, data.height - 1);
  const a = px - x0, b = py - y0;
  const at = (xx, yy) => data.values[yy * data.width + xx];
  return (1 - b) * ((1 - a) * at(x0, y0) + a * at(x1, y0))
    + b * ((1 - a) * at(x0, y1) + a * at(x1, y1));
}

export function weightedDisagreement(data, offset, xi) {
  let weight = 0, disagreement = 0;
  for (let i = 0; i < data.samples.weight.length; i += 1) {
    const w = data.samples.weight[i];
    const predicted = Number(xi) * (data.samples.projection[i] <= offset ? -1 : 1);
    weight += w;
    if (predicted !== data.samples.sign[i]) disagreement += w;
  }
  return weight ? disagreement / weight : 0;
}

function frame(canvas) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(w * scale), height = Math.round(h * scale);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width; canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  return { ctx, w, h };
}

function nativeImage(width, height, values, color) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  values.forEach((value, i) => {
    const c = color(value);
    image.data.set([c[0], c[1], c[2], 255], 4 * i);
  });
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function patchTransform(data, w, h, pad = 0) {
  const scale = Math.min((w - pad * 2) / data.width, (h - pad * 2) / data.height);
  const width = data.width * scale, height = data.height * scale;
  const x = (w - width) / 2, y = (h - height) / 2;
  return {
    x, y, width, height, scale,
    point: (p) => [x + (p[0] - data.origin[0] + .5) * scale, y + (p[1] - data.origin[1] + .5) * scale],
    inverse: (p) => [data.origin[0] + (p[0] - x) / scale - .5, data.origin[1] + (p[1] - y) / scale - .5],
    contains: (p) => p[0] >= x && p[0] <= x + width && p[1] >= y && p[1] <= y + height,
  };
}

function eventPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return [event.clientX - rect.left, event.clientY - rect.top];
}

function stroke(ctx, points, color, width = 1.5, dash = []) {
  if (points.length < 2) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(...points[0]);
  points.slice(1).forEach((p) => ctx.lineTo(...p));
  ctx.stroke(); ctx.restore();
}

function label(ctx, text, x, y, color = INK, align = 'left', size = 12, halo = false) {
  ctx.save(); ctx.font = `${size}px Arial, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (halo) { ctx.strokeStyle = 'rgba(255,255,255,.96)'; ctx.lineWidth = 4; ctx.strokeText(text, x, y); }
  ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
}

function ring(ctx, p, color, radius = 5, width = 2, fill = '#fff') {
  ctx.save(); ctx.beginPath(); ctx.arc(...p, radius, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke(); ctx.restore();
}

function clipLine(normal, offset, bounds) {
  const [nx, ny] = normal, [xmin, ymin, xmax, ymax] = bounds;
  const result = [];
  const add = (x, y) => {
    if (x >= xmin - 1e-8 && x <= xmax + 1e-8 && y >= ymin - 1e-8 && y <= ymax + 1e-8
      && !result.some((p) => Math.hypot(p[0] - x, p[1] - y) < 1e-8)) result.push([x, y]);
  };
  if (Math.abs(ny) > 1e-12) { add(xmin, (offset - nx * xmin) / ny); add(xmax, (offset - nx * xmax) / ny); }
  if (Math.abs(nx) > 1e-12) { add((offset - ny * ymin) / nx, ymin); add((offset - ny * ymax) / nx, ymax); }
  return result.slice(0, 2);
}

function scheduledDraw(draw) {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; draw(); });
  };
}

function resizeWith(canvases, draw) {
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(draw);
    canvases.forEach((canvas) => observer.observe(canvas));
  } else window.addEventListener('resize', draw, { passive: true });
  draw();
}

function ready(canvases, status, text) {
  canvases.forEach((canvas) => { canvas.dataset.ready = 'true'; });
  if (status) { status.textContent = text; status.dataset.state = 'ready'; }
}

function focusCanvas(canvas, description) {
  if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
  if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label', description);
}

function densityExplorer(data) {
  const flat = $('density-2d'), surface = $('density-3d');
  const angle = $('density-angle'), constraints = $('density-constraints'), reset = $('density-reset');
  const value = $('density-value'), status = $('density-status');
  let azimuth = -57, elevation = 52, point = [...data.corner], drag = null;
  let map;
  const image = nativeImage(data.width, data.height, data.values, (v) => {
    const c = Math.round(clamp(v / data.max, 0, 1) * 255); return [c, c, c];
  });
  const bounds = [data.origin[0] - .5, data.origin[1] - .5, data.origin[0] + data.width - .5, data.origin[1] + data.height - .5];
  const roi = data.computationalROI.map((v) => v - .5);
  const showConstraints = () => constraints?.checked !== false;
  const colors = [CYAN, MAGENTA];
  const palette = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
  const surfaceColor = (z) => {
    const u = clamp(z / data.max, 0, 1) * (palette.length - 1), i = Math.min(3, Math.floor(u)), t = u - i;
    return `rgb(${palette[i].map((v, k) => Math.round(v * (1 - t) + palette[i + 1][k] * t)).join(',')})`;
  };

  function drawFlat() {
    const { ctx, w, h } = frame(flat); map = patchTransform(data, w, h);
    ctx.drawImage(image, map.x, map.y, map.width, map.height);
    if (showConstraints()) {
      const a = map.point([roi[0], roi[1]]), b = map.point([roi[2], roi[3]]);
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.restore();
      data.constraints.forEach((line, i) => {
        const center = clipLine(line.normal, -line.dGlobal, roi);
        stroke(ctx, center.map(map.point), colors[i % colors.length], 1.7);
        for (const sign of [-1, 1]) {
          const edge = clipLine(line.normal, -line.dGlobal + sign * line.halfWidth, roi);
          stroke(ctx, edge.map(map.point), `${colors[i % colors.length]}80`, 1);
        }
      });
    }
    const corner = map.point(data.corner);
    ring(ctx, corner, '#ffe374', 6, 2.1, null);
    label(ctx, 'c*', corner[0] + 10, corner[1] - 10, '#ffe374', 'left', 14);
    const p = map.point(point);
    if (Math.hypot(point[0] - data.corner[0], point[1] - data.corner[1]) > .15) ring(ctx, p, '#fff', 4.5, 2, '#162c38');
  }

  function drawSurface() {
    const { ctx, w, h } = frame(surface);
    const rad = azimuth * Math.PI / 180, el = elevation * Math.PI / 180;
    const cx = (data.width - 1) / 2, cy = (data.height - 1) / 2;
    const zFactor = Math.max(data.width, data.height) * .78 / data.max;
    const raw = (x, y, z) => {
      x -= data.origin[0] + cx; y -= data.origin[1] + cy;
      const xx = x * Math.cos(rad) - y * Math.sin(rad), yy = x * Math.sin(rad) + y * Math.cos(rad), zz = z * zFactor;
      return [xx, yy * Math.sin(el) - zz * Math.cos(el), yy * Math.cos(el) + zz * Math.sin(el)];
    };
    const vertices = [];
    for (let y = 0; y < data.height; y += 1) {
      for (let x = 0; x < data.width; x += 1) vertices.push(raw(x + data.origin[0], y + data.origin[1], data.values[y * data.width + x]));
    }
    const floor = [[bounds[0], bounds[1]], [bounds[2], bounds[1]], [bounds[2], bounds[3]], [bounds[0], bounds[3]]].map((p) => raw(...p, 0));
    const all = [...vertices, ...floor];
    const minx = Math.min(...all.map((v) => v[0])), maxx = Math.max(...all.map((v) => v[0]));
    const miny = Math.min(...all.map((v) => v[1])), maxy = Math.max(...all.map((v) => v[1]));
    const scale = Math.min((w - 36) / (maxx - minx), (h - 62) / (maxy - miny));
    const project = (p) => [(p[0] - (minx + maxx) / 2) * scale + w / 2, (p[1] - (miny + maxy) / 2) * scale + h / 2 + 3];
    ctx.beginPath(); floor.forEach((p, i) => i ? ctx.lineTo(...project(p)) : ctx.moveTo(...project(p))); ctx.closePath();
    ctx.fillStyle = '#f7fafc'; ctx.fill(); ctx.strokeStyle = '#dce6ec'; ctx.lineWidth = 1; ctx.stroke();
    const quads = [];
    for (let y = 0; y < data.height - 1; y += 1) {
      for (let x = 0; x < data.width - 1; x += 1) {
        const indices = [y * data.width + x, y * data.width + x + 1, (y + 1) * data.width + x + 1, (y + 1) * data.width + x];
        quads.push({ indices, depth: indices.reduce((s, i) => s + vertices[i][2], 0) / 4,
          z: indices.reduce((s, i) => s + data.values[i], 0) / 4 });
      }
    }
    quads.sort((a, b) => a.depth - b.depth).forEach((q) => {
      ctx.beginPath(); q.indices.forEach((index, i) => i ? ctx.lineTo(...project(vertices[index])) : ctx.moveTo(...project(vertices[index]))); ctx.closePath();
      ctx.fillStyle = surfaceColor(q.z); ctx.fill();
      ctx.strokeStyle = surfaceColor(q.z); ctx.lineWidth = .6; ctx.stroke();
    });
    if (showConstraints()) data.constraints.forEach((line, i) => {
      const ends = clipLine(line.normal, -line.dGlobal, roi);
      if (ends.length !== 2) return;
      const points = Array.from({ length: 40 }, (_, k) => {
        const t = k / 39, p = ends[0].map((v, j) => v * (1 - t) + ends[1][j] * t);
        return project(raw(...p, bilinear(data, ...p)));
      });
      stroke(ctx, points, colors[i % colors.length], 1.4);
    });
    const z = bilinear(data, ...point), p = project(raw(...point, z));
    stroke(ctx, [project(raw(...point, 0)), p], 'rgba(22,44,56,.45)', 1, [3, 4]);
    ring(ctx, p, '#162c38', 5, 1.7, '#fff');
    const c = project(raw(...data.corner, bilinear(data, ...data.corner)));
    if (Math.hypot(point[0] - data.corner[0], point[1] - data.corner[1]) > .15) ring(ctx, c, '#ffe374', 4.5, 2, null);
    label(ctx, 'IWE height  H(x, y)', 12, 16, INK, 'left', 12);
    label(ctx, `0 – ${data.max.toFixed(1)}`, w - 12, 16, MUTED, 'right', 11);
    label(ctx, 'Drag to rotate', w / 2, h - 13, MUTED, 'center', 11);
  }

  function draw() {
    drawFlat(); drawSurface();
    if (value) value.textContent = `H(${point[0].toFixed(1)}, ${point[1].toFixed(1)}) = ${bilinear(data, ...point).toFixed(3)}`;
    if (angle) { angle.value = String(azimuth); angle.setAttribute('aria-valuetext', `${Math.round(azimuth)} degrees`); }
  }
  const redraw = scheduledDraw(draw);
  function probe(event) {
    if (!map) return;
    const p = eventPoint(flat, event);
    if (!map.contains(p)) return;
    point = map.inverse(p).map((v, i) => clamp(Math.round(v), data.origin[i], data.origin[i] + (i ? data.height : data.width) - 1));
    redraw();
  }
  flat.addEventListener('pointerdown', (event) => { probe(event); flat.focus({ preventScroll: true }); flat.setPointerCapture(event.pointerId); });
  flat.addEventListener('pointermove', (event) => { if (event.pointerType === 'mouse' || event.buttons) probe(event); });
  flat.addEventListener('pointerup', (event) => { if (flat.hasPointerCapture(event.pointerId)) flat.releasePointerCapture(event.pointerId); });
  flat.addEventListener('pointercancel', (event) => { if (flat.hasPointerCapture(event.pointerId)) flat.releasePointerCapture(event.pointerId); });
  flat.addEventListener('keydown', (event) => {
    const keys = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (event.key === 'Home') point = [...data.corner];
    else if (keys[event.key]) point = point.map((v, i) => clamp(Math.round(v) + keys[event.key][i], data.origin[i], data.origin[i] + (i ? data.height : data.width) - 1));
    else return;
    event.preventDefault(); redraw();
  });
  surface.addEventListener('pointerdown', (event) => {
    drag = { x: event.clientX, y: event.clientY, azimuth, elevation };
    surface.setPointerCapture(event.pointerId); surface.focus({ preventScroll: true });
  });
  surface.addEventListener('pointermove', (event) => {
    if (!drag) return;
    azimuth = ((drag.azimuth + (event.clientX - drag.x) * .45 + 540) % 360) - 180;
    elevation = clamp(drag.elevation - (event.clientY - drag.y) * .35, 22, 78); redraw();
  });
  const stopDrag = (event) => { drag = null; if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId); };
  surface.addEventListener('pointerup', stopDrag); surface.addEventListener('pointercancel', stopDrag);
  surface.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') { azimuth = -57; elevation = 52; }
    if (event.key === 'ArrowLeft') azimuth -= 5;
    if (event.key === 'ArrowRight') azimuth += 5;
    if (event.key === 'ArrowUp') elevation = clamp(elevation + 5, 22, 78);
    if (event.key === 'ArrowDown') elevation = clamp(elevation - 5, 22, 78);
    azimuth = ((azimuth + 540) % 360) - 180; redraw();
  });
  angle?.addEventListener('input', () => { azimuth = Number(angle.value); redraw(); });
  constraints?.addEventListener('change', redraw);
  reset?.addEventListener('click', () => { azimuth = -57; elevation = 52; point = [...data.corner]; redraw(); });
  focusCanvas(flat, 'IWE patch. Move over a pixel, or use arrow keys, to inspect its density. Home returns to the refined corner.');
  focusCanvas(surface, 'Three-dimensional surface of the same IWE. Drag or use arrow keys to rotate. Home resets the view.');
  resizeWith([flat, surface], redraw);
  ready([flat, surface], status, 'Same IWE values in 2D and 3D. Select a pixel to inspect its height.');
  return { snapshot: () => ({ point: [...point], value: bilinear(data, ...point), azimuth, elevation, constraints: showConstraints() }),
    setPoint: (x, y) => { point = [clamp(x, data.origin[0], bounds[2] - .5), clamp(y, data.origin[1], bounds[3] - .5)]; redraw(); } };
}

function polarityExplorer(data) {
  const iwe = $('polarity-iwe'), piwe = $('polarity-piwe'), plot = $('polarity-cost');
  const slider = $('polarity-offset'), sign = $('polarity-sign'), reset = $('polarity-reset');
  const value = $('polarity-value'), status = $('polarity-status');
  const min = Math.min(...data.candidates.b), max = Math.max(...data.candidates.b);
  let offset = data.selectedB, xi = data.selectedXi;
  const transforms = new Map();
  const bounds = [data.origin[0] - .5, data.origin[1] - .5, data.origin[0] + data.width - .5, data.origin[1] + data.height - .5];
  const gray = nativeImage(data.width, data.height, data.iwe, (v) => {
    const c = Math.round(clamp(v / data.iweMax, 0, 1) * 255); return [c, c, c];
  });
  const signed = nativeImage(data.width, data.height, data.piwe, (v) => {
    const t = clamp(Math.abs(v) / data.polarityMax, 0, 1), color = v >= 0 ? [43, 108, 176] : [192, 57, 43];
    return color.map((c) => Math.round(245 * (1 - t) + c * t));
  });
  // The exact step boundaries are the sample projections, not interpolated
  // cost values between candidate offsets. Frozen candidate values are audited.
  const breaks = [min, ...new Set(data.samples.projection.filter((r) => r > min && r < max).sort((a, b) => a - b)), max];
  const curves = [1, -1].map((order) => {
    const points = [[min, weightedDisagreement(data, min, order)]];
    for (let i = 1; i < breaks.length; i += 1) {
      points.push([breaks[i], points[points.length - 1][1]]);
      points.push([breaks[i], weightedDisagreement(data, breaks[i], order)]);
    }
    return { xi: order, points };
  });
  for (let i = 0; i < data.candidates.b.length; i += 1) {
    for (const order of [1, -1]) {
      const expected = order === 1 ? data.candidates.positive[i] : data.candidates.negative[i];
      if (Math.abs(weightedDisagreement(data, data.candidates.b[i], order) - expected) > 1e-10) throw new Error('Polarity-cost source verification failed.');
    }
  }
  if (slider) { slider.min = String(min); slider.max = String(max); slider.step = 'any'; }
  function drawPatch(canvas, image) {
    const { ctx, w, h } = frame(canvas), map = patchTransform(data, w, h);
    transforms.set(canvas, map); ctx.drawImage(image, map.x, map.y, map.width, map.height);
    const visible = clipLine(data.visibleNormal, data.visibleTau, bounds);
    stroke(ctx, visible.map(map.point), CYAN, 1.4);
    if (Math.abs(offset - data.selectedB) > .03) {
      stroke(ctx, clipLine(data.normal, data.selectedB, bounds).map(map.point), 'rgba(211,54,130,.5)', 1.1, [4, 4]);
    }
    const suppressed = clipLine(data.normal, offset, bounds).map(map.point);
    stroke(ctx, suppressed, MAGENTA, 2.2);
    if (suppressed.length === 2) {
      const mid = suppressed[0].map((v, i) => .78 * v + .22 * suppressed[1][i]);
      ring(ctx, mid, MAGENTA, 5.5, 2, '#fff');
      const right = suppressed.reduce((a, b) => a[0] > b[0] ? a : b);
      label(ctx, 'ℓsupp', clamp(right[0] - 9, 48, w - 9), clamp(right[1] - 13, 15, h - 14), MAGENTA, 'right', 14, true);
    }
  }
  function drawPlot() {
    const { ctx, w, h } = frame(plot), left = 38, right = 17, top = 30, bottom = 32;
    const pw = w - left - right, ph = h - top - bottom;
    const point = (b, e) => [left + (b - min) / (max - min) * pw, top + (1 - e) * ph];
    for (const error of [0, .5, 1]) {
      const yy = point(min, error)[1]; stroke(ctx, [[left, yy], [w - right, yy]], GRID, .8);
      label(ctx, error.toFixed(error === .5 ? 1 : 0), left - 8, yy, MUTED, 'right', 11);
    }
    for (let i = 0; i < 4; i += 1) {
      const b = min + i / 3 * (max - min), x = point(b, 0)[0];
      label(ctx, b.toFixed(1), x, h - 18, MUTED, 'center', 10);
    }
    for (const curve of [...curves].sort((a) => a.xi === xi ? 1 : -1)) {
      stroke(ctx, curve.points.map(([b, e]) => point(b, e)), curve.xi === xi ? MAGENTA : '#98a7b2', curve.xi === xi ? 2.2 : 1.2, curve.xi === xi ? [] : [4, 3]);
    }
    const score = weightedDisagreement(data, offset, xi), p = point(offset, score);
    stroke(ctx, [[p[0], top], [p[0], top + ph]], 'rgba(211,54,130,.3)', 1, [3, 4]);
    ring(ctx, p, MAGENTA, 4.5, 2, '#fff');
    label(ctx, 'Disagreement', left, 12, INK, 'left', 11);
    label(ctx, `ξ = ${xi === 1 ? '+1' : '−1'}`, w - right, 12, MAGENTA, 'right', 11);
    label(ctx, 'b (px)', w - right, h - 4, MUTED, 'right', 10);
  }
  function draw() {
    drawPatch(iwe, gray); drawPatch(piwe, signed); drawPlot();
    const cost = weightedDisagreement(data, offset, xi);
    if (slider) { slider.value = String(offset); slider.setAttribute('aria-valuetext', `${offset.toFixed(2)} pixels`); }
    if (sign) sign.value = String(xi);
    if (value) {
      value.textContent = `${(cost * 100).toFixed(cost < .001 ? 3 : 1)}%`;
      value.setAttribute('aria-label', `${value.textContent} weighted polarity disagreement, boundary offset ${offset.toFixed(2)} pixels, sign ${xi}`);
    }
    if ($('polarity-offset-value')) $('polarity-offset-value').textContent = `${offset.toFixed(2)} px`;
  }
  const redraw = scheduledDraw(draw);
  function setOffset(b) { offset = clamp(b, min, max); redraw(); }
  for (const canvas of [iwe, piwe]) {
    let dragging = false;
    const move = (event) => {
      const map = transforms.get(canvas); if (!map) return;
      const p = map.inverse(eventPoint(canvas, event));
      setOffset(data.normal[0] * p[0] + data.normal[1] * p[1]);
    };
    canvas.addEventListener('pointerdown', (event) => {
      dragging = true; canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true }); move(event);
    });
    canvas.addEventListener('pointermove', (event) => { if (dragging) move(event); });
    const stop = (event) => { dragging = false; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); };
    canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('keydown', (event) => {
      if (event.key === 'Home') setOffset(data.selectedB);
      else if (['ArrowUp', 'ArrowLeft'].includes(event.key)) setOffset(offset - (max - min) / 100);
      else if (['ArrowDown', 'ArrowRight'].includes(event.key)) setOffset(offset + (max - min) / 100);
      else return;
      event.preventDefault();
    });
    focusCanvas(canvas, 'Drag to move the suppressed edge, or use arrow keys. Home returns to the inferred edge.');
  }
  slider?.addEventListener('input', () => setOffset(Number(slider.value)));
  sign?.addEventListener('change', () => { xi = Number(sign.value); redraw(); });
  reset?.addEventListener('click', () => { offset = data.selectedB; xi = data.selectedXi; redraw(); });
  resizeWith([iwe, piwe, plot], redraw);
  ready([iwe, piwe, plot], status, 'Move the magenta edge across the polarity transition. Both views use the same crop.');
  return { snapshot: () => ({ offset, xi, disagreement: weightedDisagreement(data, offset, xi), inferredOffset: data.selectedB, inferredXi: data.selectedXi }),
    setOffset, setSign: (order) => { if (![1, -1].includes(order)) return; xi = order; redraw(); } };
}

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('A scientific image could not be loaded.'));
    image.src = new URL(path, document.baseURI).href;
  });
}

async function stereoExplorer(data) {
  const canvas = $('stereo-canvas'), slider = $('stereo-mix'), guides = $('stereo-guides');
  const match = $('stereo-match'), status = $('stereo-status');
  const images = {};
  await Promise.all(['left', 'right'].map(async (side) => {
    const d = data.sides[side]; images[side] = await Promise.all([loadImage(d.originalImage), loadImage(d.rectifiedImage)]);
    if (images[side].some((image) => image.naturalWidth !== data.width || image.naturalHeight !== data.height)) throw new Error('Stereo image dimensions do not match their coordinates.');
  }));
  let mix = .5, selected = null, dragPane = null, panes = [];
  const colors = ['#e53935', '#fb8c00', '#fdd835', '#43a047'];
  const drawGuides = () => guides?.checked !== false;
  function draw() {
    const { ctx, w, h } = frame(canvas), gap = w < 500 ? 10 : 18;
    const height = h - 12, width = Math.min((w - gap) / 2, height * data.width / data.height), ih = width * data.height / data.width;
    const sx = (w - width * 2 - gap) / 2, sy = 6 + (height - ih) / 2;
    panes = ['left', 'right'].map((side, i) => ({ side, x: sx + i * (width + gap), y: sy, width, height: ih }));
    for (const pane of panes) {
      const d = data.sides[pane.side], cut = pane.x + (1 - mix) * pane.width;
      const point = (p) => [pane.x + (p[0] + .5) / data.width * pane.width, pane.y + (p[1] + .5) / data.height * pane.height];
      for (let state = 0; state < 2; state += 1) {
        ctx.save(); ctx.beginPath();
        ctx.rect(state ? cut : pane.x, pane.y, state ? pane.x + pane.width - cut : cut - pane.x, pane.height); ctx.clip();
        ctx.drawImage(images[pane.side][state], pane.x, pane.y, pane.width, pane.height);
        if (state && drawGuides()) for (const y of data.guideRows) {
          const yy = point([0, y])[1]; stroke(ctx, [[pane.x, yy], [pane.x + pane.width, yy]], 'rgba(0,207,227,.65)', .9);
        }
        const corners = state ? d.rectifiedCorners : d.corners;
        corners.forEach((corner, i) => {
          const p = point(corner), color = colors[Math.floor(i / 5) % colors.length];
          ring(ctx, p, color, selected === i ? 5.5 : 2.3, selected === i ? 2 : 1.2, selected === i ? '#fff' : color);
        });
        ctx.restore();
      }
      if (mix > .001 && mix < .999) {
        stroke(ctx, [[cut, pane.y], [cut, pane.y + pane.height]], '#fff', 2);
        ring(ctx, [cut, pane.y + pane.height / 2], '#d6e1e8', 11, 1, '#fff');
        stroke(ctx, [[cut - 3, pane.y + pane.height / 2 - 4], [cut - 6, pane.y + pane.height / 2], [cut - 3, pane.y + pane.height / 2 + 4]], INK, 1.1);
        stroke(ctx, [[cut + 3, pane.y + pane.height / 2 - 4], [cut + 6, pane.y + pane.height / 2], [cut + 3, pane.y + pane.height / 2 + 4]], INK, 1.1);
      }
    }
    if (slider) { slider.value = String(Math.round(mix * 100)); slider.setAttribute('aria-valuetext', `${Math.round(mix * 100)} percent rectified view`); }
    if (match) {
      if (selected === null) match.textContent = 'Point to a corner to highlight its match.';
      else {
        const disparity = Math.abs(data.sides.left.rectifiedCorners[selected][1] - data.sides.right.rectifiedCorners[selected][1]);
        match.textContent = `Corner ${selected + 1} · rectified vertical difference ${disparity.toFixed(2)} px`;
      }
    }
  }
  const redraw = scheduledDraw(draw);
  function paneAt(p) { return panes.find((pane) => p[0] >= pane.x && p[0] <= pane.x + pane.width && p[1] >= pane.y && p[1] <= pane.y + pane.height); }
  function nearest(p, pane) {
    const state = p[0] >= pane.x + (1 - mix) * pane.width;
    const points = state ? data.sides[pane.side].rectifiedCorners : data.sides[pane.side].corners;
    let result = null, distance = 15;
    points.forEach((point, i) => {
      const x = pane.x + (point[0] + .5) / data.width * pane.width, y = pane.y + (point[1] + .5) / data.height * pane.height;
      const d = Math.hypot(x - p[0], y - p[1]); if (d < distance) { distance = d; result = i; }
    });
    return result;
  }
  canvas.addEventListener('pointerdown', (event) => {
    const p = eventPoint(canvas, event), pane = paneAt(p); if (!pane) return;
    const point = nearest(p, pane), cut = pane.x + (1 - mix) * pane.width;
    if (point !== null && Math.abs(p[0] - cut) > 14) { selected = point; redraw(); }
    else { dragPane = pane; mix = clamp(1 - (p[0] - pane.x) / pane.width, 0, 1); canvas.setPointerCapture(event.pointerId); redraw(); }
    canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointermove', (event) => {
    const p = eventPoint(canvas, event);
    if (dragPane) { mix = clamp(1 - (p[0] - dragPane.x) / dragPane.width, 0, 1); redraw(); }
    else if (event.pointerType === 'mouse') {
      const pane = paneAt(p), index = pane ? nearest(p, pane) : null;
      if (index !== selected) { selected = index; redraw(); }
    }
  });
  const stop = (event) => { dragPane = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('pointerleave', () => { if (!dragPane) { selected = null; redraw(); } });
  canvas.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') mix = clamp(mix - .05, 0, 1);
    else if (event.key === 'ArrowRight') mix = clamp(mix + .05, 0, 1);
    else if (event.key === 'ArrowUp') selected = ((selected ?? 0) + 19) % 20;
    else if (event.key === 'ArrowDown') selected = ((selected ?? -1) + 1) % 20;
    else if (event.key === 'Home') { mix = .5; selected = null; }
    else return;
    event.preventDefault(); redraw();
  });
  slider?.addEventListener('input', () => { mix = Number(slider.value) / 100; redraw(); });
  guides?.addEventListener('change', redraw);
  focusCanvas(canvas, 'Synchronized stereo comparison. Left and right arrow keys change the original/rectified split; up and down select corresponding corners.');
  resizeWith([canvas], redraw);
  ready([canvas], status, 'One stereo observation, before and after calibrated rectification.');
  return { snapshot: () => ({ mix, selectedCorner: selected, guides: drawGuides() }), setMix: (v) => { mix = clamp(v, 0, 1); redraw(); } };
}

export async function initExplorers() {
  const api = {}, loads = {};
  window.corner2tagExplorers = api;
  const components = [
    { name: 'density', target: 'density-2d', status: 'density-status', create: densityExplorer },
    { name: 'polarity', target: 'polarity-iwe', status: 'polarity-status', create: polarityExplorer },
    { name: 'stereo', target: 'stereo-canvas', status: 'stereo-status', create: stereoExplorer },
  ];
  for (const component of components) {
    const target = $(component.target); if (!target) continue;
    const status = $(component.status);
    const load = () => {
      if (loads[component.name]) return loads[component.name];
      if (status) status.textContent = 'Loading the recorded observation…';
      loads[component.name] = (async () => {
        try {
          const response = await fetch(new URL(`static/data/${component.name}.json`, document.baseURI));
          if (!response.ok) throw new Error(`Scientific data returned HTTP ${response.status}.`);
          const data = await response.json();
          api[component.name] = await component.create(data);
          return api[component.name];
        } catch (error) {
          target.dataset.ready = 'error';
          if (status) { status.textContent = 'This observation could not be loaded. Please reload the page.'; status.dataset.state = 'error'; }
          console.error(`Corner2Tag++ ${component.name} explorer:`, error);
          return null;
        }
      })();
      return loads[component.name];
    };
    component.load = load;
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); load(); }
      }, { rootMargin: '250px' });
      observer.observe(target);
    } else load();
  }
  api.loadAll = () => Promise.all(components.filter((component) => component.load).map((component) => component.load()));
  return api;
}
