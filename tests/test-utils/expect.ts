import { expect } from "vitest"

export function expectToBeDefined<T>(value: T | null | undefined): asserts value is T {
  expect(value).toBeDefined()
  expect(value).not.toBeNull()
}
