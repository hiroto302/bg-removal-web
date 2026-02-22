export interface DownloadOptions {
  downloadBtnEl: HTMLButtonElement;
  newImageBtnEl: HTMLButtonElement;
  statsEl: HTMLElement;
  statsBackendEl: HTMLElement;
  statsTimeEl: HTMLElement;
  onReset: () => void;
}

export interface DownloadControls {
  setResult: (resultUrl: string, originalFilename: string) => void;
  showStats: (device: string, timeMs: number) => void;
  reset: () => void;
}

function deriveFilename(original: string): string {
  const dot = original.lastIndexOf('.');
  const base = dot > 0 ? original.substring(0, dot) : original;
  return `${base}_no_bg.png`;
}

export function initDownload(options: DownloadOptions): DownloadControls {
  const { downloadBtnEl, newImageBtnEl, statsEl, statsBackendEl, statsTimeEl, onReset } = options;

  let currentResultUrl: string | null = null;
  let currentFilename = 'image';

  // ── Download click ──
  downloadBtnEl.addEventListener('click', () => {
    if (!currentResultUrl) return;
    const a = document.createElement('a');
    a.href = currentResultUrl;
    a.download = deriveFilename(currentFilename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  // ── New image click ──
  newImageBtnEl.addEventListener('click', () => {
    onReset();
  });

  // ── Controls ──
  function setResult(resultUrl: string, originalFilename: string): void {
    currentResultUrl = resultUrl;
    currentFilename = originalFilename;
  }

  function showStats(device: string, timeMs: number): void {
    const deviceLabel = device === 'webgpu' ? 'WebGPU (fp16)' : 'WASM (q8)';
    statsBackendEl.textContent = `Backend: ${deviceLabel}`;
    statsTimeEl.textContent = `Processing: ${(timeMs / 1000).toFixed(1)}s`;
    statsEl.classList.remove('hidden');
  }

  function reset(): void {
    currentResultUrl = null;
    currentFilename = 'image';
    statsEl.classList.add('hidden');
  }

  return { setResult, showStats, reset };
}
