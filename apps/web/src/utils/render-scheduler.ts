const MAX_RENDER_FPS = 10;
const MIN_RENDER_INTERVAL_MS = 1000 / MAX_RENDER_FPS;

const pendingCallbacks = new Set<() => void>();
let renderScheduled = false;
let lastRenderAt = 0;

const flush = () => {
  renderScheduled = false;
  lastRenderAt = performance.now();

  const callbacks = Array.from(pendingCallbacks);
  pendingCallbacks.clear();

  for (const callback of callbacks) {
    callback();
  }
};

const requestFlush = () => {
  const elapsed = performance.now() - lastRenderAt;
  const delay = Math.max(0, MIN_RENDER_INTERVAL_MS - elapsed);

  window.setTimeout(() => {
    requestAnimationFrame(flush);
  }, delay);
};

export const scheduleMapDataRender = (callback: () => void) => {
  pendingCallbacks.add(callback);

  if (renderScheduled) {
    return;
  }

  renderScheduled = true;
  requestFlush();
};
