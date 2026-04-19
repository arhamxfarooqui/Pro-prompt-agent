export default {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  // Ignore the Vite dist output
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
