import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { OTLPExporterNodeConfigBase } from '@opentelemetry/otlp-exporter-base'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  ConsoleMetricExporter,
  PeriodicExportingMetricReader
} from '@opentelemetry/sdk-metrics'
import { NodeSDK, NodeSDKConfiguration } from '@opentelemetry/sdk-node'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import packageInfo from '../package.json' with { type: "json" }
import './config/env.js'
import { ENV } from './config/env.js'

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: 'shovel-backend',
  [ATTR_SERVICE_VERSION]: packageInfo.version,
})

const config: Partial<NodeSDKConfiguration> = {
  resource,
  instrumentations: [getNodeAutoInstrumentations()]
}

if (ENV === 'production') {
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
}

if (ENV === 'development') {
  config.traceExporter = new ConsoleSpanExporter()
  config.metricReaders = [new PeriodicExportingMetricReader({
    exporter: new ConsoleMetricExporter(),
  })]
}

const sdk = new NodeSDK(config)
sdk.start()
