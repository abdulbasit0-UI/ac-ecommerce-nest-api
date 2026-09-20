import { ConsoleLogger, type LogLevel as NestLogLevel } from '@nestjs/common';
import { isPrettyLogs, parseLogLevel, shouldLog, type LogLevel } from './log-level';

type JsonLog = {
  ts: string;
  level: string;
  service: string;
  context?: string;
  msg: string;
  requestId?: string;
  stack?: string;
  [key: string]: unknown;
};

const REDACT_KEYS = new Set([
  'password',
  'token',
  'refreshToken',
  'accessToken',
  'authorization',
  'secret',
  'stripeSecretKey',
  'webhookSecret',
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  const record = asRecord(value);
  if (!record) {
    return value;
  }
  const next: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(record)) {
    next[key] = REDACT_KEYS.has(key) ? '[Redacted]' : redact(nested);
  }
  return next;
}

function stringifyMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }
  try {
    return JSON.stringify(redact(message));
  } catch {
    return String(message);
  }
}

export class AppLogger extends ConsoleLogger {
  private readonly jsonMode: boolean;
  private readonly minLevel: ReturnType<typeof parseLogLevel>;
  private readonly service = process.env.APP_NAME ?? 'ac-commerce';

  constructor(context?: string) {
    super(context ?? 'App');
    this.minLevel = parseLogLevel(process.env.LOG_LEVEL);
    this.jsonMode = !isPrettyLogs(process.env.NODE_ENV ?? 'development', process.env.LOG_PRETTY);
    this.setLogLevels(this.nestLevels());
  }

  override log(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('log', message, optionalParams);
  }

  override error(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('error', message, optionalParams);
  }

  override warn(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('warn', message, optionalParams);
  }

  override debug(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('debug', message, optionalParams);
  }

  override verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('verbose', message, optionalParams);
  }

  http(message: string, meta: Record<string, unknown>, level: 'log' | 'warn' | 'error' = 'log'): void {
    this.emit(level, message, [meta, this.context]);
  }

  exception(message: string | string[], meta: Record<string, unknown>, stack?: string, level: 'warn' | 'error' = 'error'): void {
    const text = Array.isArray(message) ? message.join('; ') : message;
    this.emit(level, text, stack ? [stack, meta, this.context] : [meta, this.context]);
  }

  private nestLevels(): NestLogLevel[] {
    const all: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];
    return all.filter((level) => shouldLog(this.minLevel, level));
  }

  private emit(level: ReturnType<typeof parseLogLevel>, message: unknown, optionalParams: unknown[]): void {
    if (!shouldLog(this.minLevel, level)) {
      return;
    }

    const context = this.extractContext(optionalParams);
    const extras = optionalParams.filter((param) => param !== context);
    const stack = extras.find((param) => typeof param === 'string' && param.includes('\n')) as string | undefined;
    const payload = extras.find((param) => param && typeof param === 'object') as Record<string, unknown> | undefined;

    if (!this.jsonMode) {
      const text = stringifyMessage(message);
      if (level === 'error') {
        super.error(text, stack, context);
        return;
      }
      super[level](text, context);
      return;
    }

    const line: JsonLog = {
      ts: new Date().toISOString(),
      level: level === 'log' ? 'info' : level,
      service: this.service,
      context,
      msg: stringifyMessage(message),
      ...((redact(payload) as Record<string, unknown> | undefined) ?? {}),
    };
    if (stack) {
      line.stack = stack;
    }

    const serialized = JSON.stringify(line);
    if (level === 'error') {
      process.stderr.write(`${serialized}\n`);
      return;
    }
    process.stdout.write(`${serialized}\n`);
  }

  private extractContext(optionalParams: unknown[]): string {
    const last = optionalParams[optionalParams.length - 1];
    if (typeof last === 'string' && !last.includes('\n')) {
      return last;
    }
    return this.context ?? 'App';
  }
}
