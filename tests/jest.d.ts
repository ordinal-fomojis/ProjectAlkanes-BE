import 'jest'
import 'jest-fetch-mock'

declare global {
  namespace jest {
    interface Expect {
      toBeNullish(): void;
    }
    interface Matchers<R> {
      toBeNullish(): R;
    }
    function fn(): Mock
    function fn<T extends (...args: never) => void>(implementation?: T): Mock<ReturnType<T>, Parameters<T>>
  }
}

// Jest fetch mock does work when the response is a buffer, but the types 
// only support string, so we need to extend the types
declare module 'jest-fetch-mock' {
  type FullMockResponseInit = MockParams & {
    body?: Buffer | string;
    init?: MockParams;
  }
  type FullMockResponseInitFunction = (request: Request) => Promise<FullMockResponseInit | Buffer | string>;
  interface FetchMock {
    mockResponse(x: FullMockResponseInitFunction): FetchMock;
  }
}
