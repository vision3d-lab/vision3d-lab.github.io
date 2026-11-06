/* One on-demand animation at a time, opened from the paper's Fig. 2. */
// Allow the catalog's explicit emphasis without interpreting arbitrary HTML.
function setEmphasis(target, value) {
  const nodes = String(value ?? '').split(/(<em>[\s\S]*?<\/em>)/gi).map(part => {
    const match = /^<em>([\s\S]*?)<\/em>$/i.exec(part);
    if (!match) return document.createTextNode(part);
    const emphasis = document.createElement('em');
    emphasis.textContent = match[1];
    return emphasis;
  });
  target.replaceChildren(...nodes);
}

export async function initPipeline() {
  const dialog = document.getElementById('method-dialog');
  if (!dialog) return null;
  const image = document.getElementById('method-animation');
  const title = document.getElementById('method-dialog-title');
  const description = document.getElementById('method-dialog-description');
  const status = document.getElementById('method-dialog-status');
  const toggle = document.getElementById('method-toggle');
  const close = document.getElementById('method-close');
  const tabs = document.getElementById('method-view-switch');
  const comparison = document.getElementById('method-comparison');
  const triggers = [...document.querySelectorAll('[data-pipeline-id]')];
  const cache = new Map();
  let config, catalog, current, item, opener, ticket = 0, objectURL = null;
  let controller, playing = false, loading = false, paused = false, comparisonMode = false;
  let compatibility = false, resumeOnVisible = false;

  async function json(path) {
    const response = await fetch(new URL(path, document.baseURI));
    if (!response.ok) throw new Error(`Could not load ${path}`);
    return response.json();
  }
  const assets = () => catalog ||= json('static/data/method-animations.json').catch(error => { catalog = null; throw error; });
  const regions = () => config ||= json('static/data/pipeline.json?v=20261106-method-emphasis').catch(error => { config = null; throw error; });
  function label() {
    toggle.textContent = playing || loading ? 'Stop animation' : 'Replay';
    toggle.setAttribute('aria-label', toggle.textContent);
    toggle.setAttribute('aria-pressed', String(playing || loading));
    toggle.disabled = !item || comparisonMode;
    image.setAttribute('aria-busy', String(loading));
  }
  function stop() {
    ticket++;
    controller?.abort(); controller = null;
    image.onload = null; image.onerror = null;
    if (item) image.src = item.poster;
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = null; playing = false; loading = false;
    status.textContent = ''; label();
  }
  async function play() {
    if (!dialog.open || !item || comparisonMode) return;
    if (document.hidden) { resumeOnVisible = !paused; return; }
    resumeOnVisible = false;
    stop(); paused = false; loading = true; label();
    const version = ticket, activeItem = item;
    const asset = compatibility ? activeItem.gifFallback : activeItem;
    if (!asset?.src) { loading = false; status.textContent = 'Animation unavailable.'; label(); return; }
    try {
      let blob = cache.get(asset.src);
      if (!blob) {
        status.textContent = 'Loading animation…';
        controller = new AbortController();
        const response = await fetch(new URL(asset.src, document.baseURI), { signal: controller.signal });
        if (!response.ok) throw new Error('Animation could not load');
        blob = await response.blob();
        cache.set(asset.src, blob);
      }
      if (version !== ticket || !dialog.open || document.hidden || comparisonMode) return;
      controller = null;
      objectURL = URL.createObjectURL(blob);
      image.onload = () => {
        if (version !== ticket) return;
        loading = false; playing = true; status.textContent = ''; label();
      };
      image.onerror = () => {
        if (version !== ticket) return;
        const fallback = !compatibility && activeItem.gifFallback?.src;
        stop(); cache.delete(asset.src);
        if (fallback) { compatibility = true; play(); }
        else { paused = true; status.textContent = 'Animation unavailable. Select Replay to try again.'; }
      };
      image.src = objectURL;
    } catch (error) {
      if (version !== ticket || error.name === 'AbortError') return;
      stop(); paused = true;
      status.textContent = 'Animation unavailable. Select Replay to try again.';
    }
  }
  function chooseView(showComparison) {
    comparisonMode = Boolean(showComparison && current?.id === 'event_representation');
    stop(); image.hidden = comparisonMode; comparison.hidden = !comparisonMode;
    tabs.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String((button.dataset.methodView === 'comparison') === comparisonMode));
    });
    setEmphasis(description, comparisonMode ? current.comparisonDescription : current.description);
    if (comparisonMode) {
      comparison.querySelectorAll('img[data-src]').forEach(img => { if (!img.getAttribute('src')) img.src = img.dataset.src; });
    } else if (item) play();
    label();
  }
  async function open(id, trigger) {
    stop(); current = null; item = null; opener = trigger || document.activeElement;
    compatibility = false; paused = false; comparisonMode = false; resumeOnVisible = false;
    setEmphasis(title, trigger?.dataset.title || 'Method animation');
    description.textContent = ''; tabs.hidden = true; comparison.hidden = true; image.hidden = false;
    image.removeAttribute('src'); status.textContent = 'Loading…'; label();
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('method-open');
    close.focus();
    const version = ticket;
    try {
      const [data, media] = await Promise.all([regions(), assets()]);
      if (version !== ticket || !dialog.open) return;
      current = data.regions.find(region => region.id === id);
      if (!current) throw new Error('Unknown method region');
      item = media.items.find(entry => entry.id === current.animationId);
      if (!item) throw new Error('Missing animation');
      setEmphasis(title, current.label);
      image.alt = current.description.replace(/<\/?em>/gi, ''); image.width = item.width; image.height = item.height;
      image.src = item.poster;
      tabs.hidden = current.id !== 'event_representation';
      chooseView(false);
    } catch (error) {
      if (version !== ticket) return;
      status.textContent = 'This animation could not load. Close and select the stage to retry.';
    }
  }
  triggers.forEach(button => button.addEventListener('click', () => open(button.dataset.pipelineId, button)));
  toggle.addEventListener('click', () => {
    if (playing || loading) { paused = true; resumeOnVisible = false; stop(); }
    else play();
  });
  tabs.querySelectorAll('button').forEach(button => button.addEventListener('click', () => chooseView(button.dataset.methodView === 'comparison')));
  close.addEventListener('click', () => dialog.close());
  let backdropDown = false;
  dialog.addEventListener('pointerdown', event => { backdropDown = event.target === dialog; });
  dialog.addEventListener('click', event => { if (backdropDown && event.target === dialog) dialog.close(); backdropDown = false; });
  dialog.addEventListener('close', () => {
    stop(); resumeOnVisible = false;
    document.documentElement.classList.remove('method-open');
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      resumeOnVisible = dialog.open && !comparisonMode && !paused && (playing || loading || !item);
      // Metadata is not an animation and may finish while hidden. Invalidating
      // its open ticket here would leave the dialog without usable controls.
      // Close/open still invalidate that ticket through stop().
      if (item || !dialog.open) stop();
    } else if (resumeOnVisible && dialog.open && item) { resumeOnVisible = false; play(); }
  });
  window.addEventListener('pagehide', () => { stop(); if (dialog.open) dialog.close(); });
  const api = { open, close: () => dialog.close(), snapshot: () => ({
    open: dialog.open, region: current?.id, animation: item?.id, playing, loading,
    comparison: comparisonMode, cachedAnimations: cache.size,
  }) };
  window.corner2tagPipeline = api;
  return api;
}
