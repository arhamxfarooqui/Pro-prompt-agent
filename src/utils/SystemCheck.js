/**
 * @file src/utils/SystemCheck.js — Hardware diagnostics for WebGPU availability.
 *
 * Probes the browser for WebGPU support and falls back to WASM/CPU mode
 * if the GPU adapter cannot be obtained.
 */

/**
 * Detects whether WebGPU is available and returns the execution mode.
 *
 * @returns {Promise<{supported: boolean, mode: string}>}
 *   - `{ supported: true,  mode: 'webgpu' }`   when a GPU adapter is available.
 *   - `{ supported: false, mode: 'wasm-cpu' }`  when WebGPU is missing or fails.
 */
export async function detectWebGPUSupport() {
  try {
    if (!navigator.gpu) {
      console.warn('[Orchestrator] Degraded Performance Warning:', {
        reason: 'navigator.gpu is undefined — WebGPU API not available.',
        fallback: 'wasm-cpu',
        timestamp: Date.now(),
      });
      return { supported: false, mode: 'wasm-cpu' };
    }

    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter) {
      console.warn('[Orchestrator] Degraded Performance Warning:', {
        reason: 'requestAdapter() returned null — no compatible GPU found.',
        fallback: 'wasm-cpu',
        timestamp: Date.now(),
      });
      return { supported: false, mode: 'wasm-cpu' };
    }

    console.log('[Orchestrator] WebGPU adapter acquired.', {
      mode: 'webgpu',
      timestamp: Date.now(),
    });
    return { supported: true, mode: 'webgpu' };
  } catch (error) {
    console.warn('[Orchestrator] Degraded Performance Warning:', {
      reason: error.message,
      fallback: 'wasm-cpu',
      timestamp: Date.now(),
    });
    return { supported: false, mode: 'wasm-cpu' };
  }
}
