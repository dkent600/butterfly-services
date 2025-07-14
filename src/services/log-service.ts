import { injectable } from 'tsyringe';
import { ILogService } from '../types/interfaces.js';

@injectable()
export class LogService implements ILogService {

  log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;

    // In browser environment, just use console.log
    // File logging would need to be implemented differently (e.g., send to server)
    console.log(logMessage);
  }

  logReport(report: string | string[]): void {
    if (!Array.isArray(report)) {
      report = [report];
    }
    const _log = [...report].join('\n');

    this.log(`${_log  }\n`);
  }

  async logError(err: Error | unknown): Promise<void> {
    // try {
    //   await this.telegramService.sendTelegramErrorMessage(errorToTelegramMessage(err));
    // } catch { }

    if (err instanceof Error) {
      this.log(err.stack ?? err.message);
    } else {
      this.log(String(err));
    }
  }
}
