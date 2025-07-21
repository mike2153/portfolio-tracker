/**
 * Shared logger utility for both Next.js and Expo environments
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: any;
  timestamp: string;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    // Check for development mode in both Next.js and React Native environments
    this.isDevelopment = process.env.NODE_ENV === 'development' || 
                        (typeof (global as any).__DEV__ !== 'undefined' && (global as any).__DEV__);
  }

  private log(level: LogLevel, message: string, context?: any) {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      level,
      message,
      context,
      timestamp
    };

    if (this.isDevelopment || level === 'error' || level === 'warn') {
      const logMethod = level === 'error' ? console.error : 
                       level === 'warn' ? console.warn : 
                       console.log;
      
      logMethod(`[${timestamp}] [${level.toUpperCase()}] ${message}`, context || '');
    }
  }

  debug(message: string, context?: any) {
    this.log('debug', message, context);
  }

  info(message: string, context?: any) {
    this.log('info', message, context);
  }

  warn(message: string, context?: any) {
    this.log('warn', message, context);
  }

  error(message: string, context?: any) {
    this.log('error', message, context);
  }
}

export const logger = new Logger();