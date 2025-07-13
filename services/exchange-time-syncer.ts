export interface IExchangeTimeSyncer {
  getTimestampString(): string;
  now(): number;
  initFromServer(serverTime: number): void;
  getSynchronizedTimestamp(): number;
}

/**
 * ExchangeTimeSyncer is used to synchronize the local time with the server time for a specific exchange.
 */
export class ExchangeTimeSyncer {
  private exchangeName: string;
  private cachedTimeOffset: number = 0;

  constructor(exchangeName: string) {
    this.exchangeName = exchangeName;
  }
  /**
   * Call this to initialize the time syncer with the server time.
   * This should be called once before using the time syncer.
   * @param serverTime Obtained from the exchange's server time endpoint.
   * It should be the server time in milliseconds.
   * This will set the cached time offset to the difference between the server time and the local time.
   * This is used to synchronize the local time with the server time.
   */
  initFromServer(serverTime: number) {
    this.cachedTimeOffset = serverTime - Date.now();
  }

  /**
   * `now()` is the server time in milliseconds.
   * It is used to create a timestamp string for API requests.
   * @returns 
   */
  getTimestampString(): string {
    return this.now().toString();
  }

  /**
   * @returns the current server time in milliseconds
   * This method is used to synchronize the local time with the server time.
   * It can be used to calculate the time offset between the server and the local machine.
   */
  now() {
    return this.getSynchronizedTimestamp();
    // return new Date().toISOString();
  }

  getSynchronizedTimestamp(): number {
    return Date.now() + this.cachedTimeOffset;
  }
} 