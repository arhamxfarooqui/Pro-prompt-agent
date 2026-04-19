/**
 * @file test/setup.js — Global test setup that runs before every test suite.
 *
 * Mocks the `chrome` browser API and `navigator` so tests can import
 * extension code without throwing ReferenceErrors in Node.
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

// Provide a base navigator object so tests can add/remove `navigator.gpu`.
// Node 21+ already has a globalThis.navigator, but older versions do not.
if (!globalThis.navigator) {
  globalThis.navigator = {};
}
