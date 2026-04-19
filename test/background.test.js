/**
 * @file test/background.test.js
 *
 * Unit and integration tests for the background service worker.
 */

import { handleInstalled, handleMessage } from '../src/background.js';

// ─── Unit Tests ──────────────────────────────────────────────

describe('handleInstalled (unit)', () => {
  let logSpy;
  let warnSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('should log a structured initialisation message', () => {
    const details = { reason: 'install' };

    handleInstalled(details);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      '[Orchestrator] Service worker installed.',
      expect.objectContaining({
        reason: 'install',
        version: '0.1.0',
        timestamp: expect.any(Number),
      }),
    );
  });

  it('should include the correct reason on updates', () => {
    const details = { reason: 'update' };

    handleInstalled(details);

    expect(logSpy).toHaveBeenCalledWith(
      '[Orchestrator] Service worker installed.',
      expect.objectContaining({ reason: 'update' }),
    );
  });
});

// ─── Integration Tests ───────────────────────────────────────

describe('handleMessage (integration)', () => {
  it('should respond with WORKER_ACTIVE for a PING_TEST action', () => {
    const message = { action: 'PING_TEST' };
    const sender = { id: 'test-sender' };
    const sendResponse = jest.fn();

    const keepOpen = handleMessage(message, sender, sendResponse);

    expect(sendResponse).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({ status: 'WORKER_ACTIVE' });
    expect(keepOpen).toBe(true);
  });

  it('should return true even for unrecognised actions (async channel)', () => {
    const message = { action: 'UNKNOWN_ACTION' };
    const sender = {};
    const sendResponse = jest.fn();

    const keepOpen = handleMessage(message, sender, sendResponse);

    expect(sendResponse).not.toHaveBeenCalled();
    expect(keepOpen).toBe(true);
  });
});
