import { expect, it, vi } from 'vitest'
import z from "zod"
import { callMultiRpc } from "../../src/utils/callMultiRpc.js"
import { callRpc } from "../../src/utils/callRpc.js"

// Mock callRpc to isolate tests
vi.mock("../../src/utils/callRpc.js")

it('should process successful responses correctly', async () => {
  vi.mocked(callRpc).mockResolvedValue([
    { result: 'result1' },
    { result: 'result2' }
  ])

  const params: [string, unknown[]][] = [
    ['method1', ['param1']],
    ['method2', ['param2']]
  ]
  
  const result = await callMultiRpc(z.string(), params)
  
  // Verify callRpc was called with correct parameters
  expect(callRpc).toHaveBeenCalledWith(
    expect.any(z.ZodType),
    'sandshrew_multicall',
    params
  )
  
  // Verify results are processed correctly
  expect(result).toEqual([
    { success: true, response: 'result1' },
    { success: true, response: 'result2' }
  ])
})

it('should handle failed RPC calls correctly', async () => {
  // Mock the callRpc response to simulate a mix of success and failure
  vi.mocked(callRpc).mockResolvedValue([
    { result: 'result1' },
    { error: { code: -1, message: 'RPC error' } }
  ])

  const params: [string, unknown[]][] = [
    ['method1', ['param1']],
    ['method2', ['param2']]
  ]
  
  const result = await callMultiRpc(z.string(), params)
  
  expect(result[0]).toEqual({ success: true, response: 'result1' })
  expect(result[1]).toEqual({ success: false, error: expect.any(Error) })
})

it('should handle empty or null results correctly', async () => {
  // Mock the callRpc response to simulate null results
  vi.mocked(callRpc).mockResolvedValue([
    { result: null }, 
    { result: undefined },
    { error: null }
  ])

  const params: [string, unknown[]][] = [
    ['method1', ['param1']],
    ['method2', ['param2']],
    ['method3', ['param3']]
  ]
  
  const result = await callMultiRpc(z.string().nullish(), params)
  
  expect(result.every(r => r.success === false)).toBe(true)
  expect(result.every(r => r.error instanceof Error)).toBe(true)
})

it('should pass through errors thrown by callRpc', async () => {
  // Mock callRpc to throw an error
  const testError = new Error('Test network error')
  vi.mocked(callRpc).mockRejectedValue(testError)

  const params: [string, unknown[]][] = [
    ['method1', ['param1']],
    ['method2', ['param2']]
  ]
  
  // The error should be passed through
  await expect(callMultiRpc(z.string(), params)).rejects.toThrow('Test network error')
})

it('should handle different schema types correctly', async () => {
  // Mock successful responses with different types
  vi.mocked(callRpc).mockResolvedValue([
    { result: 42 },
    { result: { value: "test" } }
  ])

  const numberSchema = z.number()
  const objectSchema = z.object({ value: z.string() })
  
  const params: [string, unknown[]][] = [
    ['method1', [1]],
    ['method2', [2]]
  ]
  
  // Test with number schema
  const numberResults = await callMultiRpc(numberSchema, params)
  expect(numberResults[0]).toEqual({ success: true, response: 42 })
  
  // Test with object schema
  const objectResults = await callMultiRpc(objectSchema, params)
  expect(objectResults[1]).toEqual({ success: true, response: { value: "test" } })
})

it('should handle a large number of RPC calls correctly', async () => {
  // Create an array of 10 mock responses with a mix of success and errors
  const mockResponses = Array(10).fill(null).map((_, i) => 
    i % 3 === 0 
      ? { error: { code: -1, message: `Error ${i}` } } 
      : { result: `result${i}` }
  )
  
  vi.mocked(callRpc).mockResolvedValue(mockResponses)
  
  // Create parameters for 10 RPC calls
  const params: [string, unknown[]][] = Array(10).fill(null).map((_, i) => 
    [`method${i}`, [`param${i}`]]
  )
  
  const results = await callMultiRpc(z.string(), params)
  
  // Verify we get 10 results
  expect(results.length).toBe(10)
  
  // Verify success and error cases
  results.forEach((result, i) => {
    if (i % 3 === 0) {
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      if (result.success === false) { // TypeScript guard to ensure error is defined
        expect(result.error.message).toContain(`Bitcoin RPC error for method${i}`)
        expect(result.error.message).toContain(`Error ${i}`)
      }
    } else {
      expect(result.success).toBe(true)
      if (result.success === true) { // TypeScript guard to ensure response is defined
        expect(result.response).toBe(`result${i}`)
      }
    }
  })
})

it('should handle complex nested schemas', async () => {
  // Define a complex schema for testing
  const complexSchema = z.object({
    id: z.string(),
    data: z.object({
      value: z.number(),
      items: z.array(z.string())
    }),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  
  // Mock responses with complex objects
  vi.mocked(callRpc).mockResolvedValue([
    { 
      result: {
        id: "tx1",
        data: { value: 100, items: ["a", "b", "c"] },
        metadata: { createdAt: "2023-01-01" }
      } 
    },
    { 
      result: {
        id: "tx2",
        data: { value: 200, items: ["d", "e"] }
      } 
    }
  ])
  
  const params: [string, unknown[]][] = [
    ['getTx', ['hash1']],
    ['getTx', ['hash2']]
  ]
  
  const results = await callMultiRpc(complexSchema, params)
  
  // Verify schema validation worked and complex objects were returned correctly
  expect(results[0]?.success).toBe(true)
  if (results[0] && results[0].success === true) {
    expect(results[0].response).toEqual({
      id: "tx1",
      data: { value: 100, items: ["a", "b", "c"] },
      metadata: { createdAt: "2023-01-01" }
    })
  }
  
  expect(results[1]?.success).toBe(true)
  if (results[1] && results[1].success === true) {
    expect(results[1].response).toEqual({
      id: "tx2",
      data: { value: 200, items: ["d", "e"] }
    })
  }
})

it('should format error messages correctly with complex parameters', async () => {
  // Mock response with an error
  vi.mocked(callRpc).mockResolvedValue([
    { error: { code: -32601, message: "Method not found" } }
  ])
  
  // Use a complex parameter structure
  const complexParams: [string, unknown[]][] = [
    ['complexMethod', [
      { nested: { object: true, array: [1, 2, 3] } },
      ["array", "of", "values"],
      123
    ]]
  ]
  
  const results = await callMultiRpc(z.any(), complexParams)
  
  // Verify the error message contains the method name and formatted parameters
  expect(results[0]?.success).toBe(false)
  if (results[0] && results[0].success === false && results[0].error) {
    expect(results[0].error.message).toContain('Bitcoin RPC error for complexMethod')
    expect(results[0].error.message).toContain('[{"nested":{"object":true,"array":[1,2,3]}},["array","of","values"],123]')
    expect(results[0].error.message).toContain('{"code":-32601,"message":"Method not found"}')
  }
})

it('should handle empty params array gracefully', async () => {
  // Mock a successful response
  vi.mocked(callRpc).mockResolvedValue([])
  
  // Call with empty params array
  const emptyParams: [string, unknown[]][] = []
  const results = await callMultiRpc(z.any(), emptyParams)
  
  // Should return empty array
  expect(results).toEqual([])
  expect(callRpc).toHaveBeenCalledWith(expect.any(z.ZodType), 'sandshrew_multicall', [])
})
