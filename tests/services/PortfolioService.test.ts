import { describe, expect, it, vi } from "vitest"
import { PortfolioService } from "../../src/services/PortfolioService.js"
import { unisatFetch, unisatPagedFetch } from "../../src/utils/unisat/unisatFetch.js"
import { randomAddress } from "../test-utils/btc-random.js"

vi.mock("../../src/utils/unisat/unisatFetch.js")

describe("getAlkaneBalances", () => {
  it("maps Unisat alkane balances into API model", async () => {
    const service = new PortfolioService()
    
    const address = randomAddress()
    vi.mocked(unisatPagedFetch).mockResolvedValueOnce([
      {
        alkaneid: "2:1",
        name: "A",
        symbol: "A",
        divisibility: 2,
        amount: "1000",
      },
      {
        alkaneid: "2:2",
        name: "B",
        symbol: "B",
        divisibility: 0,
        amount: "5",
      },
    ])

    const result = await service.getAlkaneBalances(address)

    expect(unisatPagedFetch).toHaveBeenCalledTimes(1)
    expect(unisatPagedFetch).toHaveBeenCalledWith(
      expect.anything(),
      `/address/${address}/alkanes/token-list`
    )

    expect(result).toEqual([
      { id: "2:1", name: "A", symbol: "A", balance: "10" },
      { id: "2:2", name: "B", symbol: "B", balance: "5" },
    ])
  })
})

describe("getBrc20Balances", () => {
  it("merges default + 6-byte BRC20 balances and maps them", async () => {
    const service = new PortfolioService()

    const address = randomAddress()

    vi.mocked(unisatPagedFetch)
      .mockResolvedValueOnce([
        {
          ticker: "ordi",
          overallBalance: "123",
          decimal: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          ticker: "abcd12",
          overallBalance: "1000",
          decimal: 2,
        },
      ])

    const result = await service.getBrc20Balances(address)

    expect(unisatPagedFetch).toHaveBeenCalledTimes(2)
    expect(unisatPagedFetch).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      `/address/${address}/brc20/summary?tick_filter=24&exclude_zero=true`
    )
    expect(unisatPagedFetch).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      `/address/${address}/brc20-prog/summary`
    )

    expect(result).toEqual([
      { id: "ordi", name: "ordi", symbol: "ordi", balance: "123" },
      { id: "abcd12", name: "abcd12", symbol: "abcd12", balance: "10" },
    ])
  })
})

describe("getPortfolio", () => {
  it("returns alkanes + brc20 from the underlying methods", async () => {
    const service = new PortfolioService()

    const address = randomAddress()

    vi.spyOn(service, "getAlkaneBalances").mockResolvedValueOnce([
      { id: "2:1", name: "A", symbol: "A", balance: "1" },
    ])
    vi.spyOn(service, "getBrc20Balances").mockResolvedValueOnce([
      { id: "2:2", name: "B", symbol: "B", balance: "2" },
    ])

    const result = await service.getPortfolio(address)

    expect(result).toEqual({
      alkanes: [{ id: "2:1", name: "A", symbol: "A", balance: "1" }],
      brc20: [{ id: "2:2", name: "B", symbol: "B", balance: "2" }],
    })
  })
})

describe("hasAlkanes", () => {
  it.each([
    { total: 0, expected: false },
    { total: 1, expected: true },
  ])("returns $expected when total is $total", async ({ total, expected }) => {
    const service = new PortfolioService()

    const address = randomAddress()

    vi.mocked(unisatFetch).mockResolvedValueOnce({ total })

    const result = await service.hasAlkanes(address)

    expect(unisatFetch).toHaveBeenCalledTimes(1)
    expect(unisatFetch).toHaveBeenCalledWith(
      expect.anything(),
      `/address/${address}/alkanes/token-list?start=0&limit=1`
    )
    expect(result).toBe(expected)
  })
})

describe("hasBrc20", () => {
  it("returns true when default endpoint has any tokens", async () => {
    const service = new PortfolioService()

    const address = randomAddress()

    vi.mocked(unisatFetch).mockResolvedValueOnce({ total: 1 })

    const result = await service.hasBrc20(address)

    expect(unisatFetch).toHaveBeenCalledTimes(1)
    expect(unisatFetch).toHaveBeenCalledWith(
      expect.anything(),
      `/address/${address}/brc20/summary?tick_filter=24&exclude_zero=true&start=0&limit=1`
    )
    expect(result).toBe(true)
  })

  it("falls back to 6-byte endpoint when default total is zero", async () => {
    const service = new PortfolioService()

    const address = randomAddress()

    vi.mocked(unisatFetch)
      .mockResolvedValueOnce({ total: 0 })
      .mockResolvedValueOnce({ total: 0 })

    const result = await service.hasBrc20(address)

    expect(unisatFetch).toHaveBeenCalledTimes(2)
    expect(unisatFetch).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      `/address/${address}/brc20/summary?tick_filter=24&exclude_zero=true&start=0&limit=1`
    )
    expect(unisatFetch).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      `/address/${address}/brc20-prog/summary?start=0&limit=1`
    )
    expect(result).toBe(false)
  })

  it("returns true when 6-byte endpoint has any tokens", async () => {
    const service = new PortfolioService()

    const address = randomAddress()

    vi.mocked(unisatFetch)
      .mockResolvedValueOnce({ total: 0 })
      .mockResolvedValueOnce({ total: 1 })

    const result = await service.hasBrc20(address)

    expect(unisatFetch).toHaveBeenCalledTimes(2)
    expect(result).toBe(true)
  })
})

describe("hasAnyTokens", () => {
  it("short-circuits when hasAlkanes is true", async () => {
    const service = new PortfolioService()

    const address = randomAddress()

    vi.spyOn(service, "hasAlkanes").mockResolvedValueOnce(true)
    const hasBrc20Spy = vi.spyOn(service, "hasBrc20")

    const result = await service.hasAnyTokens(address)

    expect(result).toBe(true)
    expect(hasBrc20Spy).not.toHaveBeenCalled()
  })

  it("checks BRC20 when hasAlkanes is false", async () => {
    const service = new PortfolioService()

    const address = randomAddress()

    vi.spyOn(service, "hasAlkanes").mockResolvedValueOnce(false)
    vi.spyOn(service, "hasBrc20").mockResolvedValueOnce(true)

    const result = await service.hasAnyTokens(address)

    expect(result).toBe(true)
  })
})

