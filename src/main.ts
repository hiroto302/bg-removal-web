import './style.css';
import type { WorkerResponse, ProgressData } from './types';
import { checkWebGPU } from './utils/device';
import {
  fileToObjectUrl,
  urlToImageData,
  applyMask,
  imageDataToBlobUrl,
  revokeObjectUrl,
  validateImageFile,
} from './utils/image';
import { initDropzone } from './ui/dropzone';
import { initSlider } from './ui/slider';
import { initDownload } from './ui/download';

// ── State ──────────────────────────────────────────
type AppState = 'idle' | 'loading_model' | 'processing' | 'result' | 'error';

interface AppStore {
  state: AppState;
  device: 'webgpu' | 'wasm' | null;
  modelReady: boolean;
  originalUrl: string | null;
  resultUrl: string | null;
  processingTime: number | null;
  errorMessage: string | null;
  originalFilename: string | null;
}

const store: AppStore = {
  state: 'idle',
  device: null,
  modelReady: false,
  originalUrl: null,
  resultUrl: null,
  processingTime: null,
  errorMessage: null,
  originalFilename: null,
};

// ── DOM ────────────────────────────────────────────
const $backendBadge = document.getElementById('backend-badge')!;

// Sections
const $dropzoneSection = document.getElementById('dropzone-section')!;
const $progressSection = document.getElementById('progress-section')!;
const $resultSection = document.getElementById('result-section')!;

// Dropzone
const $dropzone = document.getElementById('dropzone')!;
const $fileInput = document.getElementById('file-input') as HTMLInputElement;
const $uploadBtn = document.getElementById('upload-btn') as HTMLButtonElement;
const $dropzoneError = document.getElementById('dropzone-error')!;

// Progress
const $progressBarContainer = document.getElementById('progress-bar-container')!;
const $progressBar = document.getElementById('progress-bar')!;
const $progressText = document.getElementById('progress-text')!;
const $spinner = document.getElementById('spinner')!;

// Result
const $sliderContainer = document.getElementById('slider-container')!;
const $downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const $newImageBtn = document.getElementById('new-image-btn') as HTMLButtonElement;
const $resultStats = document.getElementById('result-stats')!;
const $statsBackend = document.getElementById('stats-backend')!;
const $statsTime = document.getElementById('stats-time')!;

// ── UI Modules ────────────────────────────────────
const dropzone = initDropzone({
  dropzoneEl: $dropzone,
  fileInputEl: $fileInput,
  uploadBtnEl: $uploadBtn,
  errorEl: $dropzoneError,
  onFile: (file: File) => {
    store.originalFilename = file.name;
    handleImageFile(file);
  },
});

const download = initDownload({
  downloadBtnEl: $downloadBtn,
  newImageBtnEl: $newImageBtn,
  statsEl: $resultStats,
  statsBackendEl: $statsBackend,
  statsTimeEl: $statsTime,
  onReset: resetToIdle,
});

let sliderControls: { destroy: () => void } | null = null;

// ── Worker ─────────────────────────────────────────
const worker = new Worker(
  new URL('./worker.ts', import.meta.url),
  { type: 'module' },
);

worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
  handleWorkerMessage(event.data);
});

worker.addEventListener('error', (event: ErrorEvent) => {
  console.error('[Worker error]', event.message);
  transition('error', `Worker error: ${event.message}`);
});

// ── Worker Message Handler ─────────────────────────
let processingStartTime = 0;

function handleWorkerMessage(msg: WorkerResponse): void {
  switch (msg.type) {
    case 'init_progress':
      onInitProgress(msg.data);
      break;

    case 'init_complete':
      store.device = msg.device;
      store.modelReady = true;
      $backendBadge.textContent = msg.device === 'webgpu' ? 'WebGPU (fp16)' : 'WASM (q8)';
      transition('idle');
      console.log(`[Model ready] device=${msg.device}`);
      break;

    case 'processing':
      processingStartTime = performance.now();
      transition('processing');
      break;

    case 'result':
      onResult(msg.maskData);
      break;

    case 'error':
      console.error('[Worker]', msg.message);
      transition('error', msg.message);
      break;
  }
}

function onInitProgress(data: ProgressData): void {
  if (data.status === 'progress' && data.progress !== undefined) {
    const pct = Math.round(data.progress);
    $progressBar.style.width = `${pct}%`;
    $progressText.textContent = `モデルをダウンロード中... ${pct}%`;
  } else if (data.status === 'initiate') {
    $progressText.textContent = `${data.file ?? 'ファイル'} を準備中...`;
  } else if (data.status === 'done') {
    $progressText.textContent = 'モデルの準備が完了しました';
  }
  console.log(`[Init] ${data.status}`, data.file ?? '', data.progress ?? '');
}

async function onResult(maskData: ImageData): Promise<void> {
  try {
    if (!store.originalUrl) {
      throw new Error('No original image URL available');
    }

    const elapsed = performance.now() - processingStartTime;
    store.processingTime = Math.round(elapsed);

    const { imageData: originalImageData } = await urlToImageData(store.originalUrl);
    const resultImageData = applyMask(originalImageData, maskData);
    const resultUrl = await imageDataToBlobUrl(resultImageData);

    if (store.resultUrl) {
      revokeObjectUrl(store.resultUrl);
    }

    store.resultUrl = resultUrl;
    transition('result');

    console.log(
      `[Result] ${maskData.width}x${maskData.height} mask applied in ${store.processingTime}ms`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    transition('error', message);
  }
}

// ── State Transitions ──────────────────────────────
function transition(newState: AppState, errorMessage?: string): void {
  const prevState = store.state;
  store.state = newState;

  if (newState === 'error') {
    store.errorMessage = errorMessage ?? 'Unknown error';
  } else {
    store.errorMessage = null;
  }

  // Section visibility
  $dropzoneSection.classList.toggle('hidden', newState !== 'idle' && newState !== 'error');
  $progressSection.classList.toggle('hidden', newState !== 'loading_model' && newState !== 'processing');
  $resultSection.classList.toggle('hidden', newState !== 'result');

  // State-specific UI
  switch (newState) {
    case 'idle':
      dropzone.clearError();
      dropzone.setDisabled(!store.modelReady);
      if (sliderControls) {
        sliderControls.destroy();
        sliderControls = null;
      }
      download.reset();
      break;

    case 'loading_model':
      dropzone.setDisabled(true);
      $progressBar.style.width = '0%';
      $progressText.textContent = 'モデルを準備中...';
      $progressBarContainer.classList.remove('hidden');
      $spinner.classList.add('hidden');
      break;

    case 'processing':
      $progressBarContainer.classList.add('hidden');
      $spinner.classList.remove('hidden');
      $progressText.textContent = '背景を除去中...';
      break;

    case 'result':
      if (sliderControls) {
        sliderControls.destroy();
        sliderControls = null;
      }
      if (store.originalUrl && store.resultUrl) {
        sliderControls = initSlider({
          containerEl: $sliderContainer,
          originalUrl: store.originalUrl,
          resultUrl: store.resultUrl,
        });

        download.setResult(store.resultUrl, store.originalFilename ?? 'image');

        if (store.device && store.processingTime !== null) {
          download.showStats(store.device, store.processingTime);
        }
      }
      break;

    case 'error':
      $dropzoneSection.classList.remove('hidden');
      dropzone.showError(store.errorMessage!);
      dropzone.setDisabled(!store.modelReady);
      break;
  }

  console.log(`[State] ${prevState} -> ${newState}`);
}

// ── Public API for UI Modules ──────────────────────
export async function handleImageFile(file: File): Promise<void> {
  const validationError = validateImageFile(file);
  if (validationError) {
    transition('error', validationError);
    return;
  }

  if (store.originalUrl) {
    revokeObjectUrl(store.originalUrl);
    store.originalUrl = null;
  }
  if (store.resultUrl) {
    revokeObjectUrl(store.resultUrl);
    store.resultUrl = null;
  }

  const objectUrl = fileToObjectUrl(file);
  store.originalUrl = objectUrl;

  if (!store.modelReady) {
    transition('error', 'モデルがまだ準備中です。しばらくお待ちください。');
    return;
  }

  worker.postMessage({ type: 'process', imageUrl: objectUrl });
}

export function resetToIdle(): void {
  if (store.originalUrl) {
    revokeObjectUrl(store.originalUrl);
    store.originalUrl = null;
  }
  if (store.resultUrl) {
    revokeObjectUrl(store.resultUrl);
    store.resultUrl = null;
  }
  store.processingTime = null;
  store.originalFilename = null;
  transition('idle');
}

export function getStore(): Readonly<AppStore> {
  return store;
}

// ── Init ───────────────────────────────────────────
async function init(): Promise<void> {
  const hasWebGPU = await checkWebGPU();
  $backendBadge.textContent = hasWebGPU ? 'WebGPU checking...' : 'WASM (loading...)';

  transition('loading_model');
  worker.postMessage({ type: 'init' });

  console.log('[App] Initialized. Loading model...');
}

init();
