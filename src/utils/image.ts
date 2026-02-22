const MAX_DIMENSION = 4096;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Validate a file for image processing.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'サポートされていないファイル形式です。JPG, PNG, WebP のみ対応しています。';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'ファイルサイズが大きすぎます。20MB 以下の画像を選択してください。';
  }
  return null;
}

/**
 * Create an object URL from a File.
 */
export function fileToObjectUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Revoke an object URL to free memory.
 */
export function revokeObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

/**
 * Load an image URL and return its ImageData.
 * Images exceeding MAX_DIMENSION are resized proportionally.
 */
export async function urlToImageData(url: string): Promise<{
  imageData: ImageData;
  width: number;
  height: number;
}> {
  const img = await loadImage(url);
  let { naturalWidth: w, naturalHeight: h } = img;

  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);

  return {
    imageData: ctx.getImageData(0, 0, w, h),
    width: w,
    height: h,
  };
}

function resizeImageData(
  imageData: ImageData,
  targetWidth: number,
  targetHeight: number,
): ImageData {
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = imageData.width;
  srcCanvas.height = imageData.height;
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.putImageData(imageData, 0, 0);

  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = targetWidth;
  dstCanvas.height = targetHeight;
  const dstCtx = dstCanvas.getContext('2d')!;
  dstCtx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);

  return dstCtx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * Apply a mask to an image by setting alpha = mask's R channel.
 * Resizes mask to match original dimensions if they differ.
 */
export function applyMask(original: ImageData, mask: ImageData): ImageData {
  const { width, height } = original;

  let maskToUse = mask;
  if (mask.width !== width || mask.height !== height) {
    maskToUse = resizeImageData(mask, width, height);
  }

  const src = original.data;
  const msk = maskToUse.data;
  const out = new Uint8ClampedArray(src.length);

  for (let i = 0; i < width * height; i++) {
    const si = i * 4;
    out[si] = src[si];
    out[si + 1] = src[si + 1];
    out[si + 2] = src[si + 2];
    out[si + 3] = msk[si]; // mask R channel -> alpha
  }

  return new ImageData(out, width, height);
}

/**
 * Convert ImageData to a PNG blob URL.
 */
export async function imageDataToBlobUrl(imageData: ImageData): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
      'image/png',
    );
  });

  return URL.createObjectURL(blob);
}
