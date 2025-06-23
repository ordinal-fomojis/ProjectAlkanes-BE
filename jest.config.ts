import type { Config } from 'jest'
import { createDefaultEsmPreset } from 'ts-jest'

const config: Config = createDefaultEsmPreset({
  displayName: 'server',
  preset: "ts-jest",
  modulePaths: ['<rootDir>'],
  testEnvironment: 'node',
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts'
  ],
  setupFiles: ["<rootDir>/tests/jest.env.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.ts"]
})

export default config;
