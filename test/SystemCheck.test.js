/**
 * @file test/SystemCheck.test.js
 *
 * Comprehensive tests for the WebGPU hardware diagnostics utility.
 */

import { detectWebGPUSupport } from '../src/utils/SystemCheck.js';

// ─── Helpers ─────────────────────────────────────────────────

let logSpy;
let warnSpy;

beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
  // Clean up any navigator.gpu mock between tests.
  delete globalThis.navigator.gpu;
});

// ─── Test Suite ──────────────────────────────────────────────

describe('detectWebGPUSupport', () => {
  it('should return webgpu mode when a GPU adapter is available (happy path)', async () => {
    // Mock: navigator.gpu exists and requestAdapter resolves successfully.
    globalThis.navigator.gpu = {
      requestAdapter: jest.fn().mockResolvedValue({ name: 'Mock GPU Adapter' }),
    };

    const result = await detectWebGPUSupport();

    expect(result).toEqual({ supported: true, mode: 'webgpu' });
    expect(logSpy).toHaveBeenCalledWith(
      '[Orchestrator] WebGPU adapter acquired.',
      expect.objectContaining({ mode: 'webgpu' }),
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should fall back to wasm-cpu when navigator.gpu is undefined', async () => {
    // Mock: navigator.gpu does NOT exist.
    delete globalThis.navigator.gpu;

    const result = await detectWebGPUSupport();

    expect(result).toEqual({ supported: false, mode: 'wasm-cpu' });
    expect(warnSpy).toHaveBeenCalledWith(
      '[Orchestrator] Degraded Performance Warning:',
      expect.objectContaining({
        reason: 'navigator.gpu is undefined — WebGPU API not available.',
        fallback: 'wasm-cpu',
      }),
    );
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('should fall back to wasm-cpu when requestAdapter throws an error', async () => {
    // Mock: navigator.gpu exists but requestAdapter rejects (e.g. hardware block).
    globalThis.navigator.gpu = {
      requestAdapter: jest.fn().mockRejectedValue(new Error('GPU access blocked by policy')),
    };

    const result = await detectWebGPUSupport();

    expect(result).toEqual({ supported: false, mode: 'wasm-cpu' });
    expect(warnSpy).toHaveBeenCalledWith(
      '[Orchestrator] Degraded Performance Warning:',
      expect.objectContaining({
        reason: 'GPU access blocked by policy',
        fallback: 'wasm-cpu',
      }),
    );
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('should fall back to wasm-cpu when requestAdapter returns null', async () => {
    // Mock: navigator.gpu exists but no compatible adapter found.
    globalThis.navigator.gpu = {
      requestAdapter: jest.fn().mockResolvedValue(null),
    };

    const result = await detectWebGPUSupport();

    expect(result).toEqual({ supported: false, mode: 'wasm-cpu' });
    expect(warnSpy).toHaveBeenCalledWith(
      '[Orchestrator] Degraded Performance Warning:',
      expect.objectContaining({
        reason: 'requestAdapter() returned null — no compatible GPU found.',
        fallback: 'wasm-cpu',
      }),
    );
  });
});
