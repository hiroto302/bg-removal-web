import type { ProgressData } from '../types';

export interface ProgressOptions {
  barContainerEl: HTMLElement;
  barEl: HTMLElement;
  textEl: HTMLElement;
  spinnerEl: HTMLElement;
  errorEl: HTMLElement;
  errorMessageEl: HTMLElement;
  retryBtnEl: HTMLButtonElement;
  onRetry: () => void;
}

export interface ProgressControls {
  showDownloading: () => void;
  showSpinner: (text: string) => void;
  showError: (message: string) => void;
  updateProgress: (data: ProgressData) => void;
  reset: () => void;
}

export function initProgress(options: ProgressOptions): ProgressControls {
  const {
    barContainerEl,
    barEl,
    textEl,
    spinnerEl,
    errorEl,
    errorMessageEl,
    retryBtnEl,
    onRetry,
  } = options;

  // ── Multi-file progress tracking ──
  const fileProgress = new Map<string, { loaded: number; total: number }>();

  // ── Retry click ──
  retryBtnEl.addEventListener('click', () => {
    onRetry();
  });

  // ── Visibility helpers ──
  function setMode(mode: 'bar' | 'spinner' | 'error' | 'none'): void {
    barContainerEl.classList.toggle('hidden', mode !== 'bar');
    spinnerEl.classList.toggle('hidden', mode !== 'spinner');
    errorEl.classList.toggle('hidden', mode !== 'error');
  }

  // ── Controls ──
  function showDownloading(): void {
    fileProgress.clear();
    barEl.style.width = '0%';
    textEl.textContent = 'モデルを準備中...';
    setMode('bar');
  }

  function showSpinner(text: string): void {
    textEl.textContent = text;
    setMode('spinner');
  }

  function showError(message: string): void {
    errorMessageEl.textContent = message;
    textEl.textContent = '';
    setMode('error');
  }

  function updateProgress(data: ProgressData): void {
    const key = data.file ?? '__default__';

    switch (data.status) {
      case 'initiate':
        fileProgress.set(key, { loaded: 0, total: 0 });
        textEl.textContent = `${data.file ?? 'ファイル'} を準備中...`;
        break;

      case 'progress': {
        fileProgress.set(key, {
          loaded: data.loaded ?? 0,
          total: data.total ?? 0,
        });
        let totalLoaded = 0;
        let totalSize = 0;
        for (const f of fileProgress.values()) {
          totalLoaded += f.loaded;
          totalSize += f.total;
        }
        const pct = totalSize > 0 ? Math.round((totalLoaded / totalSize) * 100) : 0;
        barEl.style.width = `${pct}%`;
        textEl.textContent = `モデルをダウンロード中... ${pct}%`;
        break;
      }

      case 'done': {
        const entry = fileProgress.get(key);
        if (entry && entry.total > 0) {
          fileProgress.set(key, { loaded: entry.total, total: entry.total });
        }
        textEl.textContent = 'モデルの準備が完了しました';
        break;
      }
    }
  }

  function reset(): void {
    fileProgress.clear();
    barEl.style.width = '0%';
    textEl.textContent = '';
    setMode('none');
  }

  return { showDownloading, showSpinner, showError, updateProgress, reset };
}
