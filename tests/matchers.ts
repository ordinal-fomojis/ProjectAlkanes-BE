import type { MatcherFunction } from 'expect';

export const toBeNullish: MatcherFunction<[]> =
  function (actual) {
    if (actual == null) {
      return {
        message: () =>
          // `this` context will have correct typings
          `expected ${this.utils.printReceived(
            actual,
          )} not to be null or undefined`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${this.utils.printReceived(
            actual,
          )} to be null or undefined`,
        pass: false,
      };
    }
  };

export function expectToBeDefined<T>(actual: T): asserts actual is NonNullable<T> {
  expect(actual).not.toBeNullish()
}