import z from "zod"
import { BITCOIN_RPC_URL } from "../../src/config/constants.js"
import { callRpc } from "../../src/utils/callRpc.js"

it('should return correct response from rpc', async () => {
  fetchMock.mockResponse(JSON.stringify({ result: 1234 }))

  const response = await callRpc(z.number(), 'btc_getblockcount')
  expect(response).toBe(1234)
})

it('should throw error when rpc returns error', async () => {
  fetchMock.mockResponse(JSON.stringify({ error: { code: -1, message: 'RPC error' } }))

  await expect(callRpc(z.number(), 'btc_getblockcount', []))
    .rejects.toThrow('Bitcoin RPC error: {"code":-1,"message":"RPC error"}')
})

it('should throw unknown error if no error or data is returned', async () => {
  fetchMock.mockResponse(JSON.stringify({}))

  await expect(callRpc(z.null(), 'btc_getblockcount', []))
    .rejects.toThrow('Bitcoin RPC error: Unknown error')
})

it('should provide correct request body', async () => {
  fetchMock.mockResponse(JSON.stringify({ result: 'success' }))

  const params = [1, 'test']
  await callRpc(z.string(), 'btc_testmethod', params)

  expect(fetchMock).toHaveBeenCalledWith(BITCOIN_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: 'btc_testmethod',
      params
    })
  })
})
