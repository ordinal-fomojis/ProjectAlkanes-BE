import type { Config } from 'jest'
import { createDefaultEsmPreset } from 'ts-jest'

export default {
  ...createDefaultEsmPreset(),
  setupFilesAfterEnv: ['./tests/jest.setup.ts'],
  testEnvironment: 'node',
  collectCoverageFrom: [
    './src/**/*.ts'
  ],
  // moduleNameMapper: {
  //   '^(\\.{1,2}/.*)\\.js$': '$1'
  // },
  roots: ['<rootDir>']
} satisfies Config;
