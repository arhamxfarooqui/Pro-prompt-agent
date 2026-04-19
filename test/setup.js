/**
 * @file test/setup.js — Global test setup that runs before every test suite.
 *
 * Mocks the `chrome` browser API so tests can import extension code
 * without throwing ReferenceErrors in Node.
 */

globalThis.chrome = {
  runtime: {
    onInstalled: {
      addListener: jest.fn(),
    },
    onMessage: {
      addListener: jest.fn(),
    },
    getManifest: jest.fn(() => ({
      version: '0.1.0',
    })),
  },
};
