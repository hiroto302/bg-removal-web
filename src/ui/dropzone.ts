export interface DropzoneOptions {
  dropzoneEl: HTMLElement;
  fileInputEl: HTMLInputElement;
  uploadBtnEl: HTMLButtonElement;
  errorEl: HTMLElement;
  onFile: (file: File) => void;
}

export interface DropzoneControls {
  showError: (message: string) => void;
  clearError: () => void;
  setDisabled: (disabled: boolean) => void;
}

export function initDropzone(options: DropzoneOptions): DropzoneControls {
  const { dropzoneEl, fileInputEl, uploadBtnEl, errorEl, onFile } = options;

  let disabled = false;
  let dragCounter = 0;

  function processFile(file: File | null | undefined): void {
    if (!file || disabled) return;
    clearError();
    onFile(file);
  }

  // ── File input change ──
  fileInputEl.addEventListener('change', () => {
    const file = fileInputEl.files?.[0];
    processFile(file);
    fileInputEl.value = '';
  });

  // ── Button click ──
  uploadBtnEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (disabled) return;
    fileInputEl.click();
  });

  // ── Dropzone click ──
  dropzoneEl.addEventListener('click', () => {
    if (disabled) return;
    fileInputEl.click();
  });

  // ── Drag events ──
  dropzoneEl.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (disabled) return;
    dragCounter++;
    dropzoneEl.classList.add('dropzone--active');
  });

  dropzoneEl.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  dropzoneEl.addEventListener('dragleave', () => {
    if (disabled) return;
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropzoneEl.classList.remove('dropzone--active');
    }
  });

  dropzoneEl.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzoneEl.classList.remove('dropzone--active');
    dragCounter = 0;
    if (disabled) return;
    const file = e.dataTransfer?.files?.[0];
    processFile(file);
  });

  // ── Paste ──
  document.addEventListener('paste', (e: ClipboardEvent) => {
    if (disabled) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          processFile(file);
          return;
        }
      }
    }
  });

  // ── Controls ──
  function showError(message: string): void {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function clearError(): void {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  function setDisabled(flag: boolean): void {
    disabled = flag;
    dropzoneEl.style.opacity = flag ? '0.5' : '';
    dropzoneEl.style.pointerEvents = flag ? 'none' : '';
  }

  return { showError, clearError, setDisabled };
}
