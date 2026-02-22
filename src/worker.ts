import { pipeline, env } from '@huggingface/transformers';
import type { ImageSegmentationPipeline } from '@huggingface/transformers';
import type { WorkerRequest, WorkerResponse, ProgressData } from './types';

// Disable local model check (always download from HF Hub)
env.allowLocalModels = false;

let segmenter: ImageSegmentationPipeline | null = null;
let currentDevice: 'webgpu' | 'wasm' = 'wasm';

function respond(msg: WorkerResponse): void {
  self.postMessage(msg);
}

async function checkWebGPUInWorker(): Promise<boolean> {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

async function initPipeline(): Promise<void> {
  const hasWebGPU = await checkWebGPUInWorker();

  const device = hasWebGPU ? 'webgpu' : 'wasm';
  const dtype = hasWebGPU ? 'fp16' : 'q8';
  currentDevice = device;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  segmenter = (await (pipeline as any)('image-segmentation', 'briaai/RMBG-1.4', {
    device,
    dtype,
    progress_callback: (data: ProgressData) => {
      respond({ type: 'init_progress', data });
    },
  })) as ImageSegmentationPipeline;

  respond({ type: 'init_complete', device: currentDevice });
}

async function processImage(imageUrl: string, processingId: number): Promise<void> {
  if (!segmenter) {
    respond({ type: 'error', message: 'Pipeline not initialized', processingId });
    return;
  }

  respond({ type: 'processing', processingId });

  const result = await segmenter(imageUrl);
  const mask = result[0].mask;

  // Convert single-channel mask to RGBA ImageData
  const { width, height, data } = mask;
  const rgbaData = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const v = data[i];
    rgbaData[i * 4] = v;
    rgbaData[i * 4 + 1] = v;
    rgbaData[i * 4 + 2] = v;
    rgbaData[i * 4 + 3] = 255;
  }
  const maskImageData = new ImageData(rgbaData, width, height);

  respond({ type: 'result', maskData: maskImageData, processingId });
}

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case 'init':
        await initPipeline();
        break;
      case 'process':
        await processImage(msg.imageUrl, msg.processingId);
        break;
      default:
        respond({
          type: 'error',
          message: `Unknown message type: ${(msg as { type: string }).type}`,
        });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const processingId = 'processingId' in msg ? (msg as { processingId: number }).processingId : undefined;
    respond({ type: 'error', message, processingId });
  }
});
