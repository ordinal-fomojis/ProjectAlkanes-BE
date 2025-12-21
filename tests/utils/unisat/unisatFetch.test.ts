import { describe, expect, it, vi } from 'vitest'
import z from 'zod'
import { retrySchemaFetch } from '../../../src/utils/retryFetch.js'
import { unisatFetch, unisatPagedFetch } from '../../../src/utils/unisat/unisatFetch.js'

vi.mock('../../../src/utils/retryFetch.js')

describe('unisatFetch', () => {
  it('should make request with correct parameters and return data on success', async () => {
    const testData = { balance: 1000, address: 'bc1qtest...' }
    vi.mocked(retrySchemaFetch).mockResolvedValueOnce({
      code: 0,
      msg: 'Success',
      data: testData
    })

    const schema = z.object({
      balance: z.number(),
      address: z.string()
    })

    const result = await unisatFetch(schema, '/address/bc1qtest.../balance')
    expect(result).toEqual(testData)
  })


  it('should throw error when Unisat returns code -1', async () => {
    vi.mocked(retrySchemaFetch).mockResolvedValueOnce({
      code: -1,
      msg: 'Invalid address format',
      data: null
    })

    const schema = z.object({ balance: z.number() })

    await expect(unisatFetch(schema, '/invalid-address/balance'))
      .rejects.toThrow(`Unisat request to /invalid-address/balance failed with message: Invalid address format`)
  })

  it('should throw error when data is null even with success code', async () => {
    vi.mocked(retrySchemaFetch).mockResolvedValueOnce({
      code: 0,
      msg: 'Success',
      data: null
    })

    const schema = z.object({ balance: z.number() })

    await expect(unisatFetch(schema, '/empty-response'))
      .rejects.toThrow('Unisat request to /empty-response failed with message: Success')
  })
})

describe('unisatPagedFetch', () => {
  it.each([
    {
      name: 'adds ? when no query string',
      path: '/some/path',
      expectedUrlFragment: '/some/path?start=0&limit=500'
    },
    {
      name: 'does not modify when already ends with ?',
      path: '/path?',
      expectedUrlFragment: '/path?start=0&limit=500'
    },
    {
      name: 'adds & when has query string and does not end with &',
      path: '/path?foo=bar',
      expectedUrlFragment: '/path?foo=bar&start=0&limit=500'
    },
    {
      name: 'does not add extra & when already ends with &',
      path: '/path?foo=bar&',
      expectedUrlFragment: '/path?foo=bar&start=0&limit=500'
    }
  ])('$name', async ({ path, expectedUrlFragment }) => {
    vi.mocked(retrySchemaFetch).mockResolvedValueOnce({
      code: 0,
      msg: 'Success',
      data: {
        total: 1,
        detail: ['ok']
      }
    })

    await unisatPagedFetch(z.string(), path)
    expect(retrySchemaFetch).toHaveBeenCalledTimes(1)
    expect(retrySchemaFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining(expectedUrlFragment),
      expect.anything(),
      expect.anything()
    )
  })

  it('should paginate until total items are fetched', async () => {
    vi.mocked(retrySchemaFetch)
      .mockResolvedValueOnce({
        code: 0,
        msg: 'Success',
        data: {
          total: 600,
          detail: Array.from({ length: 500 }, (_, i) => i)
        }
      })
      .mockResolvedValueOnce({
        code: 0,
        msg: 'Success',
        data: {
          total: 600,
          detail: Array.from({ length: 100 }, (_, i) => 500 + i)
        }
      })

    const result = await unisatPagedFetch(z.number(), '/paged')
    expect(result).toHaveLength(600)
    expect(result[0]).toBe(0)
    expect(result[499]).toBe(499)
    expect(result[500]).toBe(500)
    expect(result[599]).toBe(599)

    expect(retrySchemaFetch).toHaveBeenCalledTimes(2)
    expect(retrySchemaFetch).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.stringMatching(/start=0&limit=500/),
      expect.anything(),
      expect.anything()
    )
    expect(retrySchemaFetch).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.stringMatching(/start=500&limit=500/),
      expect.anything(),
      expect.anything()
    )
  })

  it('should reject when Unisat returns code -1', async () => {
    vi.mocked(retrySchemaFetch).mockResolvedValueOnce({
      code: -1,
      msg: 'Bad request',
      data: null
    })

    await expect(unisatPagedFetch(z.number(), '/paged')).rejects.toThrow(
      'Unisat request to /paged?start=0&limit=500 failed with message: Bad request'
    )
  })
})
