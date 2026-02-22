export interface SliderOptions {
  containerEl: HTMLElement;
  originalUrl: string;
  resultUrl: string;
}

export interface SliderControls {
  destroy: () => void;
}

export function initSlider(options: SliderOptions): SliderControls {
  const { containerEl, originalUrl, resultUrl } = options;
  const controller = new AbortController();
  const { signal } = controller;

  let position = 50;
  let isDragging = false;

  // ── Build DOM ──
  const sliderEl = document.createElement('div');
  sliderEl.className = 'slider';
  sliderEl.tabIndex = 0;
  sliderEl.setAttribute('role', 'slider');
  sliderEl.setAttribute('aria-label', 'Before/after comparison');
  sliderEl.setAttribute('aria-valuemin', '0');
  sliderEl.setAttribute('aria-valuemax', '100');
  sliderEl.setAttribute('aria-valuenow', '50');

  // Before layer
  const beforeEl = document.createElement('div');
  beforeEl.className = 'slider-before';
  const beforeImg = document.createElement('img');
  beforeImg.src = originalUrl;
  beforeImg.alt = 'Original';
  beforeImg.draggable = false;
  const beforeLabel = document.createElement('span');
  beforeLabel.className = 'slider-label';
  beforeLabel.textContent = 'Before';
  beforeEl.appendChild(beforeImg);
  beforeEl.appendChild(beforeLabel);

  // After layer
  const afterEl = document.createElement('div');
  afterEl.className = 'slider-after';
  afterEl.style.clipPath = 'inset(0 0 0 50%)';
  const afterImg = document.createElement('img');
  afterImg.src = resultUrl;
  afterImg.alt = 'Background removed';
  afterImg.draggable = false;
  const afterLabel = document.createElement('span');
  afterLabel.className = 'slider-label';
  afterLabel.textContent = 'After';
  afterEl.appendChild(afterImg);
  afterEl.appendChild(afterLabel);

  // Handle
  const handleEl = document.createElement('div');
  handleEl.className = 'slider-handle';
  handleEl.style.left = '50%';
  const gripEl = document.createElement('div');
  gripEl.className = 'slider-grip';
  gripEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/><polyline points="9 18 15 12 9 6" transform="translate(6,0)"/></svg>`;
  handleEl.appendChild(gripEl);

  sliderEl.appendChild(beforeEl);
  sliderEl.appendChild(afterEl);
  sliderEl.appendChild(handleEl);
  containerEl.appendChild(sliderEl);

  // ── Position update ──
  function updatePosition(percent: number): void {
    position = Math.max(0, Math.min(100, percent));
    afterEl.style.clipPath = `inset(0 0 0 ${position}%)`;
    handleEl.style.left = `${position}%`;
    sliderEl.setAttribute('aria-valuenow', String(Math.round(position)));
  }

  function calcPercent(clientX: number): number {
    const rect = sliderEl.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * 100;
  }

  // ── Mouse events ──
  sliderEl.addEventListener('mousedown', (e: MouseEvent) => {
    isDragging = true;
    updatePosition(calcPercent(e.clientX));
  }, { signal });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return;
    updatePosition(calcPercent(e.clientX));
  }, { signal });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  }, { signal });

  // ── Touch events ──
  sliderEl.addEventListener('touchstart', (e: TouchEvent) => {
    e.preventDefault();
    isDragging = true;
    updatePosition(calcPercent(e.touches[0].clientX));
  }, { signal, passive: false });

  document.addEventListener('touchmove', (e: TouchEvent) => {
    if (!isDragging) return;
    updatePosition(calcPercent(e.touches[0].clientX));
  }, { signal, passive: false });

  document.addEventListener('touchend', () => {
    isDragging = false;
  }, { signal });

  // ── Keyboard ──
  sliderEl.addEventListener('keydown', (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        updatePosition(position - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        updatePosition(position + 1);
        break;
      case 'Home':
        e.preventDefault();
        updatePosition(0);
        break;
      case 'End':
        e.preventDefault();
        updatePosition(100);
        break;
    }
  }, { signal });

  // ── Cleanup ──
  function destroy(): void {
    controller.abort();
    containerEl.innerHTML = '';
  }

  return { destroy };
}
