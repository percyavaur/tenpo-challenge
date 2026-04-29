export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Operation aborted", "AbortError");
  }
}

export function yieldToMainThread(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Operation aborted", "AbortError"));
      return;
    }

    window.setTimeout(() => {
      if (signal?.aborted) {
        reject(new DOMException("Operation aborted", "AbortError"));
        return;
      }

      resolve();
    }, 0);
  });
}
