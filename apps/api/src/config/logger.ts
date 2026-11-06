import winston from 'winston';
import { config } from './index.js';

export const logger = winston.createLogger({
  level: config.isTest ? 'error' : config.logLevel,
  format: config.isProd
    ? winston.format.combine(winston.format.timestamp(), winston.format.json())
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...rest }) => {
          const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
          return `${timestamp} ${level}: ${message}${extra}`;
        })
      ),
  transports: [new winston.transports.Console()],
});
