/** Main thread -> Worker */
export type WorkerRequest =
  | { type: 'init' }
  | { type: 'process'; imageUrl: string };

/** Worker -> Main thread */
export type WorkerResponse =
  | { type: 'init_progress'; data: ProgressData }
  | { type: 'init_complete'; device: 'webgpu' | 'wasm' }
  | { type: 'processing' }
  | { type: 'result'; maskData: ImageData }
  | { type: 'error'; message: string };

/** Transformers.js progress callback data */
export interface ProgressData {
  status: 'initiate' | 'download' | 'progress' | 'done' | 'ready';
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  name?: string;
}
