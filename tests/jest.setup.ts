import { jest } from '@jest/globals'
import fetchMock from 'jest-fetch-mock'
import { toBeNullish } from './matchers.js'

fetchMock.default.enableMocks()
global.jest = jest

expect.extend({
  toBeNullish
})

beforeEach(() => {
  jest.resetAllMocks()
  fetchMock.default.resetMocks()
})

afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})
