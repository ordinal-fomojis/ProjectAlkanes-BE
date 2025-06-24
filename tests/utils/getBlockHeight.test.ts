import { expect, it, vi } from "vitest"
import z from "zod"
import { callRpc } from "../../src/utils/callRpc.js"
import { getBlockHeight } from "../../src/utils/getBlockHeight.js"

vi.mock("../../src/utils/callRpc.js")

it('should call rpc with correct parameters', async () => {
  const mockResponse = 900123
  vi.mocked(callRpc).mockResolvedValue(mockResponse)

  const response = await getBlockHeight()

  expect(callRpc).toHaveBeenCalledWith(expect.any(z.ZodType), 'btc_getblockcount')

  expect(response).toEqual(mockResponse)
})
