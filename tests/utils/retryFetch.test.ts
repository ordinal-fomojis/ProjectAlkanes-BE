import { z } from 'zod'
import { DEFAULT_RETRY_FETCH_TIMES, RequestError, retryBlobFetch, retryBufferFetch, retryFetch, retryJsonFetch, retryResponseFetch, retrySchemaFetch } from "../../src/utils/retryFetch.js"

it('should return response if successful', async () => {
  fetchMock.mockResponse('success')
  await expect(retryFetch('/a/url')).resolves.toBe('success')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('should retry 4 times if failing and throw error', async () => {
  fetchMock.mockResponse('error', { status: 500 })
  await expect(retryFetch('/a/url')).rejects.toThrow(RequestError)
  expect(fetchMock).toHaveBeenCalledTimes(DEFAULT_RETRY_FETCH_TIMES)
})

it('should return response if recieves response on second try', async () => {
  fetchMock.mockResponses(
    ['error', { status: 500 }],
    ['success', { status: 202 }]
  )
  await expect(retryFetch('/a/url')).resolves.toBe('success')
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('should not retry on a 404 error', async () => {
  fetchMock.mockResponses(
    ['error', { status: 500 }],
    ['error', { status: 404 }],
    ['success', { status: 202 }]
  )
  await expect(retryFetch('/a/url')).rejects.toThrow(RequestError)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('should return response if recieves response on third try', async () => {
  fetchMock.mockResponses(
    ['error', { status: 500 }],
    ['error', { status: 429 }],
    ['success', { status: 202 }]
  )
  await expect(retryFetch('/a/url')).resolves.toBe('success')
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

it('should retry the number of times given', async () => {
  fetchMock.mockResponse('error', { status: 500 })
  await expect(retryFetch('/a/url', undefined, { retries: 10, delay: async () => 0 })).rejects.toThrow(RequestError)
  expect(fetchMock).toHaveBeenCalledTimes(10)
})

it('should rethrow error if fetch is throwing error', async () => {
  const error = new Error('fetch failed')
  fetchMock.mockReject(error)
  await expect(retryFetch('/a/url')).rejects.toThrow('fetch failed')
  expect(fetchMock).toHaveBeenCalledTimes(DEFAULT_RETRY_FETCH_TIMES)
})

it.each([
  ['/api/url', '/api/url'],
  [new Request('/api/request'), '/api/request'],
])('should throw error with correct url (case %$)', async (url, expectedUrl) => {
  fetchMock.mockResponse('error', { status: 500 })
  try {
    await retryFetch(url)
  } catch (error) {
    expect(error).toBeInstanceOf(RequestError)
    expect((error as RequestError).url).toBe(expectedUrl)
  }
  expect(fetchMock).toHaveBeenCalledTimes(DEFAULT_RETRY_FETCH_TIMES)
})

it('should allow custom retry conditions', async () => {
  fetchMock.mockResponses(
    ['error', { status: 404 }],
    ['error', { status: 500 }],
    ['success', { status: 200 }]
  )
  
  await expect(retryFetch('/a/url', undefined, {
    retryCondition: async (error, base) => (error instanceof RequestError && error.status === 404) || base()
  })).resolves.toBe('success')
  
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

it('should allow custom delay function', async () => {
  fetchMock.mockResponses(
    ['error', { status: 500 }],
    ['success', { status: 200 }]
  )
  
  type DelayFn = NonNullable<NonNullable<Parameters<typeof retryFetch>[2]>['delay']>
  const delayFn = jest.fn<DelayFn>(async (attempt, _, base) => attempt === 0 ? 0 : base())
  
  await expect(retryFetch('/a/url', undefined, { delay: delayFn })).resolves.toBe('success')
  
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(delayFn).toHaveBeenCalledWith(1, expect.any(RequestError), expect.any(Function))
})

it('should only retry if the condition is met', async () => {
  fetchMock.mockResponses(
    ['error', { status: 500 }],
    ['error', { status: 404 }],
    ['success', { status: 200 }]
  )
  await expect(retryFetch('/a/url', undefined, {
    retryCondition: async (error) => error instanceof RequestError && error.status >= 500
  })).rejects.toThrow(RequestError)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('should throw DOMException if fetch is aborted', async () => {
  fetchMock.mockAbortOnce()
  
  await expect(retryFetch('/a/url', { signal: new AbortController().signal }))
    .rejects.toThrow(DOMException)
  
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('should throw DOMException if fetch times out', async () => {
  fetchMock.mockRejectOnce(new DOMException('Timeout', 'TimeoutError'))
  
  await expect(retryFetch('/a/url', { signal: AbortSignal.timeout(100) }))
    .rejects.toThrow(DOMException)
  
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('should return blob data on success', async () => {
  fetchMock.mockResponse('blob content', { 
    headers: { 'Content-Type': 'text/plain' }
  })
  
  const result = await retryBlobFetch('/api/blob')
  
  expect(result.type).toBe('text/plain')
  expect(await result.text()).toBe('blob content')
  
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('should parse JSON response data', async () => {
  const jsonData = { success: true, id: 123, name: 'Test Object' }
  fetchMock.mockResponse(JSON.stringify(jsonData))
  
  const result = await retryJsonFetch('/api/json')
  
  expect(result).toEqual(jsonData)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('should return array buffer data', async () => {
  const testString = 'buffer test data'
  fetchMock.mockResponse(testString)
  
  const result = await retryBufferFetch('/api/buffer')
  
  expect(Buffer.from(result).toString('utf-8')).toBe(testString)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('should validate successful response with schema', async () => {
  const data = { 
    id: 1234, 
    username: 'testuser', 
    email: 'test@example.com',
    active: true
  }
  
  const schema = z.object({
    id: z.number(),
    username: z.string(),
    email: z.string().email(),
    active: z.boolean()
  })
  
  fetchMock.mockResponse(JSON.stringify(data))
  
  const result = await retrySchemaFetch(schema, '/api/users/1234')
  
  expect(result).toEqual(data)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('should throw when response fails schema validation', async () => {
  const invalidData = { 
    id: 'not-a-number',
    username: 123,
    email: 'not-an-email',
    active: 'yes'
  }
  
  const schema = z.object({
    id: z.number(),
    username: z.string(),
    email: z.string().email(),
    active: z.boolean()
  })
  
  fetchMock.mockResponseOnce(JSON.stringify(invalidData))
  
  await expect(retrySchemaFetch(schema, '/api/users/1234'))
    .rejects.toThrow(z.ZodError)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('should return response from retryResponseFetch', async () => {
  fetchMock.mockResponse('response text')
  
  const result = await retryResponseFetch('/api/retry-response')

  expect(result).toBeInstanceOf(Response)
  expect(await result.text()).toBe('response text')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
