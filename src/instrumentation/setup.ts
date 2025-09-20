import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { OTLPExporterNodeConfigBase } from '@opentelemetry/otlp-exporter-base'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ConsoleMetricExporter, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { NodeSDK, NodeSDKConfiguration } from '@opentelemetry/sdk-node'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { createAddHookMessageChannel } from 'import-in-the-middle'
import { register } from 'node:module'
import packageInfo from '../../package.json' with { type: "json" }
import { ENV } from '../config/env.js'

// Note: import-in-the-middle support may be removed in the future, but is the best option for esm at the moment,
// see below for reference:
// https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md#instrumentation-hook-required-for-esm
// https://github.com/open-telemetry/opentelemetry-js/issues/4933

const { registerOptions, waitForAllMessagesAcknowledged } = createAddHookMessageChannel()
register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions)

const appEnv = ENV === 'production' ? process.env.APP_ENV : 'local'
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: `shovel-backend-${appEnv}`,
  [ATTR_SERVICE_VERSION]: packageInfo.version,
})

const config: Partial<NodeSDKConfiguration> = {
  resource,
  instrumentations: [getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-mongodb': {
      enhancedDatabaseReporting: true
    }
  })]
}

if (ENV === 'production' || process.env.LOG_SINK === 'axiom') {
  const axiomConfig: OTLPExporterNodeConfigBase = {
    url: 'https://api.axiom.co/v1/traces',
    headers: {
      'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
      'X-Axiom-Dataset': process.env.AXIOM_DATASET_NAME!
    }
  }

  config.traceExporter = new OTLPTraceExporter(axiomConfig)
  config.metricReaders = [new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(axiomConfig),
  })]
} else if (process.env.LOG_SINK === 'console') {
  config.traceExporter = new ConsoleSpanExporter()
  config.metricReaders = [new PeriodicExportingMetricReader({
    exporter: new ConsoleMetricExporter(),
  })]
}

const sdk = new NodeSDK(config)
sdk.start()

await waitForAllMessagesAcknowledged()

export async function shutdownInstrumentation() {
  await sdk.shutdown()
}
