import { injectable } from 'tsyringe';
import { IExchangeTimeSyncer } from '../types/interfaces.js';

/**
 * ExchangeTimeSyncer is used to synchronize the local time with the server time for a specific exchange.
 */
@injectable()
export class ExchangeTimeSyncer implements IExchangeTimeSyncer {
  private cachedTimeOffset: number = 0;

  /**
   * Call this to initialize the time syncer with the server time.
   * This should be called once before using the time syncer.
   * @param serverTime Obtained from the exchange's server time endpoint.
   * It should be the server time in milliseconds.
   * This will set the cached time offset to the difference between the server time and the local time.
   * This is used to synchronize the local time with the server time.
   */
  async initFromServer(serverTime: number): Promise<void> {
    this.cachedTimeOffset = serverTime - Date.now();
  }

  /**
   * `getTimestampString()` returns the server time as a string.
   * It is used to create a timestamp string for API requests.
   */
  getTimestampString(): string {
    return this.now().toString();
  }

  /**
   * @returns the current server time in milliseconds
   * This method is used to synchronize the local time with the server time.
   * It can be used to calculate the time offset between the server and the local machine.
   */
  now(): number {
    return this.getSynchronizedTimestamp();
  }

  getSynchronizedTimestamp(): number {
    return Date.now() + this.cachedTimeOffset;
  }
}
