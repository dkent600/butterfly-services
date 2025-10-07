import { ILogService } from '../types/interfaces.js';

export class LogService implements ILogService {

  info(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;

    // In browser environment, just use console.log
    // File logging would need to be implemented differently (e.g., send to server)
    console.log(logMessage);
  }

  warn(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] WARN: ${message}`;
    console.warn(logMessage);
  }

  trace(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] TRACE: ${message}`;
    console.debug(logMessage);
  }

  report(report: string | string[]): void {
    if (!Array.isArray(report)) {
      report = [report];
    }
    const _log = [...report].join('\n');

    this.info(`${_log}\n`);
  }

  async error(err: Error | string): Promise<void> {
    // try {
    //   await this.telegramService.sendTelegramErrorMessage(errorToTelegramMessage(err));
    // } catch { }

    if (err instanceof Error) {
      this.info(err.stack ?? err.message);
    } else {
      this.info(String(err));
    }
  }
}
