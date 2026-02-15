import { URLSearchParams } from 'https://jslib.k6.io/url/1.0.0/index.js'
import { check } from 'k6'
import http from 'k6/http'
import { Counter, Trend } from 'k6/metrics'
import { Options } from 'k6/options'

export const options: Options = {
  vus: 30,
  duration: '1m'
}

const baseUrl = 'https://api.shovel.space/api'
const searchParams = JSON.parse(open('./data/search-alkanes-params.json', 'utf-8')) as Record<string, string[]>
const totalResponses = new Counter('total_responses')
const responsesTrend = new Trend('responses')

export default function () {
  const params = createRandomSearchParams()

  const url = `${baseUrl}/alkane/token?${params.toString()}`
  const res = http.get(url)

  if (res.status === 200 && res.json('success') === true) {
    const dataLength = (res.json('data') as unknown[]).length
    responsesTrend.add(dataLength)
    totalResponses.add(dataLength)
  }

  check(res, {
    'is status 200': (r) => r.status === 200,
    'is success': (r) => r.json('success') === true
  });
}

function createRandomSearchParams(): URLSearchParams {
  const urlSearchParams = new URLSearchParams({ pageSize: '50' })
  for (const [key, options] of Object.entries(searchParams) as [string, (string | null)[]][]) {
    const value = options[Math.floor(Math.random() * options.length)]
    if (value == null)
      continue
    urlSearchParams.append(key, value)
  }
  return urlSearchParams
}
