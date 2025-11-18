export default {
  testEnvironment: '<rootDir>/tests/custom-jest-environment.js',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/jest-setup.js'],
};

