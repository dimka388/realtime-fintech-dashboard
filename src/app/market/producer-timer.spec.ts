import {
  ProducerTimer,
  ProducerTimerDriver,
} from './producer-timer';

class FakeTimerDriver implements ProducerTimerDriver {
  private nextTimerId = 1;
  private readonly callbacks = new Map<
    number,
    () => void
  >();

  set(callback: () => void): number {
    const timerId = this.nextTimerId++;
    this.callbacks.set(timerId, callback);
    return timerId;
  }

  clear(timerId: number): void {
    this.callbacks.delete(timerId);
  }

  run(timerId: number): void {
    const callback = this.callbacks.get(timerId);
    this.callbacks.delete(timerId);
    callback?.();
  }

  get activeTimerIds(): readonly number[] {
    return [...this.callbacks.keys()];
  }
}

describe('ProducerTimer', () => {
  let driver: FakeTimerDriver;
  let timer: ProducerTimer;

  beforeEach(() => {
    driver = new FakeTimerDriver();
    timer = new ProducerTimer(driver);
  });

  it('prevents a scheduled batch after cancellation', () => {
    const callback = vi.fn();

    timer.schedule(callback, 100);
    const [timerId] = driver.activeTimerIds;

    timer.cancel();
    driver.run(timerId);

    expect(callback).not.toHaveBeenCalled();
    expect(driver.activeTimerIds).toEqual([]);
  });

  it('can schedule a new batch after cancellation', () => {
    const pausedCallback = vi.fn();
    const resumedCallback = vi.fn();

    timer.schedule(pausedCallback, 100);
    timer.cancel();
    timer.schedule(resumedCallback, 0);

    const [resumedTimerId] = driver.activeTimerIds;
    driver.run(resumedTimerId);

    expect(pausedCallback).not.toHaveBeenCalled();
    expect(resumedCallback).toHaveBeenCalledOnce();
  });

  it('replaces an existing scheduled batch', () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    timer.schedule(firstCallback, 100);
    const [firstTimerId] = driver.activeTimerIds;
    timer.schedule(secondCallback, 200);

    const [secondTimerId] = driver.activeTimerIds;
    driver.run(firstTimerId);
    driver.run(secondTimerId);

    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledOnce();
  });
});
