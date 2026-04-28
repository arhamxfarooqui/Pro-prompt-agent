/**
 * debounce — Delays invocation until after `wait` ms with no further calls.
 * Returns a debounced function with a .cancel() method.
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  wait: number,
): T & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => { fn(...args); timeout = null; }, wait);
  };

  debounced.cancel = () => {
    if (timeout) { clearTimeout(timeout); timeout = null; }
  };

  return debounced as T & { cancel: () => void };
}
