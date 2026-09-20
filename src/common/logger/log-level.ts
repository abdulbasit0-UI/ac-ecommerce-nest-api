export type LogLevel = 'error' | 'warn' | 'log' | 'debug' | 'verbose';

const RANK: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  log: 2,
  debug: 3,
  verbose: 4,
};

export function parseLogLevel(value?: string): LogLevel {
  const normalized = (value ?? 'log').toLowerCase();
  if (normalized === 'info') {
    return 'log';
  }
  if (normalized in RANK) {
    return normalized as LogLevel;
  }
  return 'log';
}

export function shouldLog(configured: LogLevel, incoming: LogLevel): boolean {
  return RANK[incoming] <= RANK[configured];
}

export function isPrettyLogs(nodeEnv: string, prettyFlag?: string): boolean {
  if (prettyFlag === 'true') {
    return true;
  }
  if (prettyFlag === 'false') {
    return false;
  }
  return nodeEnv !== 'production';
}
