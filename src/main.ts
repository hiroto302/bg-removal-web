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
}

const store: AppStore = {
  state: 'idle',
  device: null,
  modelReady: false,
  originalUrl: null,
  resultUrl: null,
  processingTime: null,
  errorMessage: null,
};

// ── DOM ────────────────────────────────────────────
const $backendBadge = document.getElementById('backend-badge')!;

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
    console.log(`[Download] ${data.file}: ${data.progress.toFixed(1)}%`);
  } else {
    console.log(`[Init] ${data.status}`, data.file ?? '');
  }
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

  console.log(`[State] ${prevState} -> ${newState}`);
}

// ── Public API for UI Modules (Phase 3/4) ──────────
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
