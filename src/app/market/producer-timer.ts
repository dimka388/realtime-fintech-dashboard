export interface ProducerTimerDriver {
  set(
    callback: () => void,
    delayMs: number,
  ): number;

  clear(timerId: number): void;
}

const workerTimerDriver: ProducerTimerDriver = {
  set: (callback, delayMs) =>
    setTimeout(callback, delayMs),
  clear: (timerId) => clearTimeout(timerId),
};

export class ProducerTimer {
  private timerId: number | null = null;

  constructor(
    private readonly driver: ProducerTimerDriver =
      workerTimerDriver,
  ) {}

  schedule(
    callback: () => void,
    delayMs: number,
  ): void {
    this.cancel();

    this.timerId = this.driver.set(() => {
      this.timerId = null;
      callback();
    }, delayMs);
  }

  cancel(): void {
    if (this.timerId === null) {
      return;
    }

    this.driver.clear(this.timerId);
    this.timerId = null;
  }
}
