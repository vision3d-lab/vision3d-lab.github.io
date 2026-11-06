/* Inline GIF/image animation: nearby bytes may preload; playback starts only
 * when visible (or explicitly requested), and leaving restores the poster. */
export function initInlineAnimations() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const absolute = path => new URL(path, document.baseURI).href;
  let catalogPromise;
  const catalog = () => catalogPromise ||= fetch(absolute('static/data/extension-animations.json?v=20261106-apriltag-panel-flow')).then(response => {
    if (!response.ok) throw new Error('Animation catalog unavailable');
    return response.json();
  }).catch(error => { catalogPromise = null; throw error; });
  const states = [...document.querySelectorAll('[data-animation-id]')].map(article => ({
    article, image: article.querySelector('.method-animation'),
    button: article.querySelector('.animation-control'),
    status: article.querySelector('.animation-status'),
    poster: article.querySelector('.method-animation').getAttribute('src'),
    ratio: 0, item: null, blob: null, download: null, url: null, ticket: 0,
    playing: false, starting: false, userPaused: false, manual: false, compatibility: false, hasStarted: false,
  }));

  function label(state) {
    const active = state.playing || state.starting;
    const action = active ? 'Stop' : state.hasStarted ? 'Replay' : 'Play';
    state.button.textContent = active ? 'Stop animation' : state.hasStarted ? 'Replay' : 'Play animation';
    state.button.setAttribute('aria-label', `${action} ${state.article.querySelector('h3').textContent} animation`);
    state.button.setAttribute('aria-pressed', String(active));
    state.image.setAttribute('aria-busy', String(state.starting));
  }
  function stop(state) {
    state.ticket++; state.starting = false; state.playing = false;
    state.image.onload = null; state.image.onerror = null;
    state.image.src = state.poster;
    if (state.url) { URL.revokeObjectURL(state.url); state.url = null; }
    state.status.textContent = ''; label(state);
  }
  async function download(state) {
    if (!state.item) {
      const data = await catalog();
      state.item = data.items.find(item => item.id === state.article.dataset.animationId);
      if (!state.item) throw new Error('Animation not found');
    }
    const asset = state.compatibility ? state.item.gifFallback : state.item;
    if (!asset?.src) throw new Error('Animation source missing');
    const response = await fetch(absolute(asset.src));
    if (!response.ok) throw new Error('Animation could not load');
    state.blob = await response.blob();
    return state.blob;
  }
  function prepare(state) {
    if (state.blob) return Promise.resolve(state.blob);
    if (!state.download) state.download = download(state).finally(() => { state.download = null; });
    return state.download;
  }
  async function start(state) {
    if (state.playing || state.starting || document.hidden) return;
    const ticket = ++state.ticket;
    state.hasStarted = true; state.starting = true; label(state);
    try {
      if (!state.blob) state.status.textContent = 'Loading animation...';
      await prepare(state);
      if (ticket !== state.ticket || document.hidden) return;
      state.url = URL.createObjectURL(state.blob);
      state.image.onload = () => {
        if (ticket !== state.ticket) return;
        state.starting = false; state.playing = true; state.status.textContent = ''; label(state);
      };
      state.image.onerror = () => {
        if (ticket !== state.ticket) return;
        const canFallback = !state.compatibility && !!state.item?.gifFallback?.src;
        stop(state); state.blob = null;
        if (canFallback) { state.compatibility = true; start(state); }
        else { state.userPaused = true; state.status.textContent = 'Animation unavailable. Select Replay to try again.'; }
      };
      state.image.src = state.url;
    } catch (error) {
      if (ticket !== state.ticket) return;
      stop(state); state.userPaused = true;
      state.status.textContent = 'Animation unavailable. Select Replay to try again.';
    }
  }
  function synchronize() {
    for (const state of states) {
      const canPlay = !document.hidden && state.ratio >= .25 && !state.userPaused && (!reduced.matches || state.manual);
      if (canPlay) start(state);
      else if (state.playing || state.starting) stop(state);
    }
  }
  states.forEach(state => {
    state.button.addEventListener('click', () => {
      if (state.playing || state.starting) { state.userPaused = true; state.manual = false; stop(state); }
      else { state.userPaused = false; state.manual = true; start(state); }
    });
    label(state);
  });
  if ('IntersectionObserver' in window) {
    const near = new window.IntersectionObserver(entries => {
      if (document.hidden || reduced.matches) return;
      for (const entry of entries) {
        const state = states.find(state => state.image === entry.target);
        // A speculative transfer must not start an image or surface a transient
        // error. The visible/manual start path retries a failed preload.
        if (state && entry.isIntersecting) prepare(state).catch(() => {});
      }
    }, { rootMargin: '300px 0px', threshold: 0 });
    const visible = new window.IntersectionObserver(entries => {
      for (const entry of entries) {
        const state = states.find(state => state.image === entry.target);
        if (!state) continue;
        state.ratio = entry.intersectionRatio;
        if (!entry.isIntersecting) state.manual = false;
      }
      synchronize();
    }, { threshold: [0, .25, .5, .75, 1] });
    states.forEach(state => { near.observe(state.image); visible.observe(state.image); });
  }
  document.addEventListener('visibilitychange', synchronize);
  reduced.addEventListener('change', () => { states.forEach(state => { state.manual = false; }); synchronize(); });
  window.addEventListener('pagehide', () => states.forEach(stop));
  window.addEventListener('pageshow', synchronize);
  return { snapshot: () => states.map(state => ({
    id: state.article.dataset.animationId, playing: state.playing, loading: state.starting,
    preloading: !!state.download, loaded: !!state.blob, visible: state.ratio >= .25,
    format: state.compatibility ? 'gif' : (state.item?.kind || null),
  })) };
}
