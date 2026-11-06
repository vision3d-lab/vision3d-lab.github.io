/* W632 raw-to-warped event visualization.
 * Every displayed point has a paired recorded raw / motion-compensated position.
 * The slider interpolates those coordinates; it does not run motion estimation.
 */
const POSITIVE = 'rgba(43,108,176,.45)';
const NEGATIVE = 'rgba(192,57,43,.45)';
const GREEN = '#2ca25f';
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const ease = (t) => t * t * (3 - 2 * t);
let initialization;

export function interpolatePosition(data, index, amount) {
  const t = clamp(Number(amount), 0, 1);
  const raw = data.raw[index], warped = data.warped[index];
  return [raw[0] + (warped[0] - raw[0]) * t, raw[1] + (warped[1] - raw[1]) * t];
}

function viewport(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelsX = Math.round(width * dpr), pixelsY = Math.round(height * dpr);
  if (canvas.width !== pixelsX || canvas.height !== pixelsY) {
    canvas.width = pixelsX; canvas.height = pixelsY;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  return { ctx, width, height };
}

function message(canvas, text) {
  const { ctx, width, height } = viewport(canvas);
  ctx.fillStyle = '#758795'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${width < 300 ? 11 : 13}px Arial, sans-serif`;
  ctx.fillText(text, width / 2, height / 2);
}

function assertData(data) {
  if (!data || !Array.isArray(data.raw) || !Array.isArray(data.warped) || !Array.isArray(data.polarity)) {
    throw new Error('The event-coordinate export is missing.');
  }
  if (!data.raw.length || data.raw.length !== data.warped.length || data.raw.length !== data.polarity.length
    || data.sampleCount !== data.raw.length) throw new Error('Raw and warped events are not paired.');
  if (!Array.isArray(data.bounds) || data.bounds.length !== 4 || !data.bounds.every(Number.isFinite)
    || data.bounds[2] <= data.bounds[0] || data.bounds[3] <= data.bounds[1]) throw new Error('Invalid common event bounds.');
  for (let i = 0; i < data.raw.length; i += 1) {
    if (data.raw[i].length !== 2 || data.warped[i].length !== 2
      || !data.raw[i].every(Number.isFinite) || !data.warped[i].every(Number.isFinite)
      || ![-1, 1].includes(data.polarity[i])) throw new Error('Invalid source event.');
  }
}

async function createAlignment() {
  const canvas = document.getElementById('alignment-canvas');
  if (!canvas) return null;
  const slider = document.getElementById('alignment-amount');
  const replayButton = document.getElementById('alignment-replay');
  const status = document.getElementById('alignment-status');
  const label = document.getElementById('alignment-label');
  const buttons = [...document.querySelectorAll('[data-alignment]')];
  const controls = [slider, replayButton, ...buttons].filter(Boolean);
  const disableControls = (disabled) => controls.forEach((control) => { control.disabled = disabled; });
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const api = { ready: false };
  window.corner2tagAlignment = api;
  disableControls(true);
  canvas.dataset.ready = 'loading';
  canvas.setAttribute('aria-description', 'The green arrow indicates the recorded motion direction. Its displayed length is illustrative.');
  message(canvas, 'Loading events…');
  if (status) { status.textContent = 'Loading the event observation…'; status.dataset.state = 'loading'; }

  try {
    const response = await fetch(new URL('static/data/motion-explorer.json', document.baseURI));
    if (!response.ok) throw new Error(`Event data returned HTTP ${response.status}.`);
    const exportData = await response.json(), data = exportData.alignment;
    assertData(data);
    const negative = [], positive = [];
    data.polarity.forEach((sign, index) => (sign > 0 ? positive : negative).push(index));
    let amount = 1, animation = null, animationFrame = 0, delayedReplay = 0, redrawFrame = 0, visible = true;

    function syncControls() {
      const percent = Math.round(amount * 100);
      if (slider) {
        slider.value = String(percent);
        slider.setAttribute('aria-valuetext', `${percent} percent motion compensation`);
      }
      buttons.forEach((button) => {
        const selected = button.dataset.alignment === 'raw' ? amount <= .0001 : amount >= .9999;
        button.setAttribute('aria-pressed', String(selected));
      });
      if (label) label.textContent = amount <= .0001 ? 'Raw events' : amount >= .9999 ? 'Warped events' : animation ? 'Aligning events' : 'Partial alignment';
    }

    function drawMotionArrow(ctx, width, height) {
      const motion = data.motion;
      if (width < 260 || height < 140 || !Array.isArray(motion) || motion.length !== 2 || !motion.every(Number.isFinite)) return;
      const magnitude = Math.hypot(...motion); if (!magnitude) return;
      const length = clamp(width * .12, 42, 68), ux = motion[0] / magnitude, uy = motion[1] / magnitude;
      const cx = width - 61, cy = height - 43;
      const a = [cx - ux * length / 2, cy - uy * length / 2], b = [cx + ux * length / 2, cy + uy * length / 2];
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
      ctx.strokeStyle = GREEN; ctx.lineWidth = 2.5; ctx.stroke();
      const head = 8;
      ctx.beginPath(); ctx.moveTo(b[0] - ux * head - uy * head * .45, b[1] - uy * head + ux * head * .45);
      ctx.lineTo(...b); ctx.lineTo(b[0] - ux * head + uy * head * .45, b[1] - uy * head - ux * head * .45); ctx.stroke();
      ctx.restore();
    }

    function draw() {
      const { ctx, width, height } = viewport(canvas);
      if (width < 2 || height < 2) return;
      const [xmin, ymin, xmax, ymax] = data.bounds, pad = width < 400 ? 8 : 12;
      const scale = Math.min((width - 2 * pad) / (xmax - xmin), (height - 2 * pad) / (ymax - ymin));
      const ox = (width - (xmax - xmin) * scale) / 2, oy = (height - (ymax - ymin) * scale) / 2;
      const dot = clamp(scale * .7, .7, 1.45), half = dot / 2;
      for (const [indices, color] of [[negative, NEGATIVE], [positive, POSITIVE]]) {
        ctx.fillStyle = color;
        for (const index of indices) {
          const raw = data.raw[index], warped = data.warped[index];
          const x = raw[0] + (warped[0] - raw[0]) * amount, y = raw[1] + (warped[1] - raw[1]) * amount;
          ctx.fillRect(ox + (x - xmin) * scale - half, oy + (y - ymin) * scale - half, dot, dot);
        }
      }
      drawMotionArrow(ctx, width, height);
      syncControls();
    }

    function requestDraw() {
      if (redrawFrame || animationFrame) return;
      redrawFrame = requestAnimationFrame(() => { redrawFrame = 0; draw(); });
    }

    function cancelMotion() {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (delayedReplay) clearTimeout(delayedReplay);
      animationFrame = 0; delayedReplay = 0; animation = null;
    }

    function animateTo(target) {
      cancelMotion();
      target = clamp(target, 0, 1);
      if (reduced?.matches || !visible || document.hidden || Math.abs(target - amount) < .0001) {
        amount = target; draw(); return;
      }
      animation = { start: amount, target, time: performance.now() };
      const tick = (time) => {
        animationFrame = 0;
        if (!animation) return;
        const t = clamp((time - animation.time) / 900, 0, 1);
        amount = animation.start + (animation.target - animation.start) * ease(t);
        draw();
        if (t < 1) animationFrame = requestAnimationFrame(tick);
        else { amount = animation.target; animation = null; syncControls(); }
      };
      animationFrame = requestAnimationFrame(tick);
    }

    function replay() {
      cancelMotion();
      if (reduced?.matches) { amount = 1; draw(); return; }
      amount = 0; draw();
      delayedReplay = setTimeout(() => {
        delayedReplay = 0;
        if (visible && !document.hidden) animateTo(1);
      }, 220);
    }

    slider?.addEventListener('input', () => { cancelMotion(); amount = clamp(Number(slider.value) / 100, 0, 1); draw(); });
    buttons.forEach((button) => button.addEventListener('click', () => animateTo(button.dataset.alignment === 'raw' ? 0 : 1)));
    replayButton?.addEventListener('click', replay);
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelMotion(); });
    reduced?.addEventListener?.('change', () => {
      if (reduced.matches && animation) { const target = animation.target; cancelMotion(); amount = target; draw(); }
      else if (reduced.matches && delayedReplay) { cancelMotion(); amount = 1; draw(); }
    });
    if ('ResizeObserver' in window) new ResizeObserver(requestDraw).observe(canvas);
    else window.addEventListener('resize', requestDraw, { passive: true });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        if (!visible) cancelMotion(); else requestDraw();
      });
      observer.observe(canvas);
    }

    if (slider) { slider.min = '0'; slider.max = '100'; slider.step = '1'; }
    canvas.dataset.ready = 'true';
    if (status) {
      const count = (number) => Number(number).toLocaleString('en-US');
      status.textContent = `${count(data.sampleCount)} of ${count(data.eventCount)} recorded events · GENERAL observation W${data.window} · ${data.durationMs} ms.`;
      status.dataset.state = 'ready';
    }
    Object.assign(api, {
      ready: true,
      snapshot: () => ({ amount: amount * 100, animating: Boolean(animation), sampleCount: data.sampleCount, eventCount: data.eventCount, window: data.window, bounds: [...data.bounds] }),
      setAmount: (percent, animated = false) => {
        if (!Number.isFinite(Number(percent))) return;
        const target = clamp(Number(percent) / 100, 0, 1);
        if (animated) animateTo(target); else { cancelMotion(); amount = target; draw(); }
      },
      replay,
    });
    draw();
    disableControls(false);
    return api;
  } catch (error) {
    disableControls(true);
    api.ready = false;
    canvas.dataset.ready = 'error';
    if (status) { status.textContent = 'The event observation could not be loaded. Please reload the page.'; status.dataset.state = 'error'; }
    message(canvas, 'Event preview unavailable');
    // A recorded raster remains useful when the interactive coordinate payload
    // is unavailable. Controls stay disabled and the fallback is identified.
    const fallback = new Image();
    fallback.onload = () => {
      const drawFallback = () => {
        const { ctx, width, height } = viewport(canvas);
        const scale = Math.min(width / fallback.naturalWidth, height / fallback.naturalHeight);
        const w = fallback.naturalWidth * scale, h = fallback.naturalHeight * scale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(fallback, (width - w) / 2, (height - h) / 2, w, h);
      };
      drawFallback();
      if ('ResizeObserver' in window) new ResizeObserver(drawFallback).observe(canvas);
      else window.addEventListener('resize', drawFallback, { passive: true });
      canvas.dataset.ready = 'fallback';
      canvas.setAttribute('aria-description', 'Recorded warped-event image. Interactive controls are unavailable.');
      api.fallback = true;
      if (label) label.textContent = 'Warped events';
      if (status) status.textContent = 'Interactive data unavailable. Showing a recorded warped-event image. Reload to try again.';
    };
    fallback.src = new URL('static/media/motion-alignment-warped.png', document.baseURI).href;
    api.error = String(error.message || error);
    console.error('Corner2Tag++ event alignment:', error);
    return api;
  }
}

export function initAlignment() {
  if (!initialization) initialization = createAlignment();
  return initialization;
}
