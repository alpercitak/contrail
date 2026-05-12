import pino from 'pino';

const DEV_TRANSPORT = {
  target: 'pino-pretty',
  options: {
    colorize: true,
  },
};

export const createLogger = (name: string) =>
  pino({
    name,
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV !== 'production' ? DEV_TRANSPORT : undefined,
  });
