type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function configuredLevel(): LogLevel {
  const v = process.env['LOG_LEVEL']?.toLowerCase();
  return v !== undefined && v in LEVEL_RANK ? (v as LogLevel) : 'info';
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[configuredLevel()];
}

function formatMeta(meta?: Record<string, unknown>): string {
  if (meta === undefined || Object.keys(meta).length === 0) return '';
  return ' ' + JSON.stringify(meta);
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>, error?: Error): void {
  if (!shouldLog(level)) return;
  const ts = new Date().toISOString();
  const tag = level.toUpperCase().padEnd(5);
  let line = `[${ts}] ${tag} ${message}${formatMeta(meta)}`;
  if (error !== undefined) line += ` error="${error.message}"`;
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    emit('info', message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    emit('warn', message, meta);
  },
  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    emit('error', message, meta, error);
  },
  debug(message: string, meta?: Record<string, unknown>): void {
    emit('debug', message, meta);
  },
};
