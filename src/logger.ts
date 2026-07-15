import winston from 'winston';
import LokiTransport from 'winston-loki';
import { context, trace } from "@opentelemetry/api";

const traceFormat = winston.format((info) => {
    const span = trace.getSpan(context.active());

    if (span) {
        const spanContext = span.spanContext();

        info.traceId = spanContext.traceId;
        info.spanId = spanContext.spanId;
    }

    return info;
});

const logger = winston.createLogger({
  level: 'info',
format: winston.format.combine(
    traceFormat(),
    winston.format.timestamp(),
    winston.format.json()
),
  transports: [
    new winston.transports.Console(),
    new LokiTransport({
      host: process.env.LOKI_HOST || 'http://localhost:3100',
      labels: { app: 'crypto-analytics-api' },
      json: true,
      format: winston.format.json(),
      replaceTimestamp: true,
      onConnectionError: (err) => console.error('Loki Connection Error:', err),
    }),
  ],
});

export default logger;
