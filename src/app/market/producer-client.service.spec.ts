import { TestBed } from '@angular/core/testing';

import {
  DEFAULT_PRODUCER_SETTINGS,
  ProducerSettings,
  ProducerWorkerCommand,
  ProducerWorkerEvent,
} from './models/producer.models';

import {
  PRODUCER_WORKER_FACTORY,
  ProducerClientService,
  ProducerWorkerPort,
} from './producer-client.service';

class FakeProducerWorker
  implements ProducerWorkerPort
{
  onmessage:
    | ((
        event: MessageEvent<ProducerWorkerEvent>,
      ) => void)
    | null = null;

  readonly messages: ProducerWorkerCommand[] = [];
  terminated = false;

  postMessage(
    message: ProducerWorkerCommand,
  ): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(event: ProducerWorkerEvent): void {
    this.onmessage?.({
      data: event,
    } as MessageEvent<ProducerWorkerEvent>);
  }
}

describe('ProducerClientService', () => {
  let worker: FakeProducerWorker;
  let service: ProducerClientService;

  beforeEach(() => {
    worker = new FakeProducerWorker();

    TestBed.configureTestingModule({
      providers: [
        ProducerClientService,
        {
          provide: PRODUCER_WORKER_FACTORY,
          useValue: () => worker,
        },
      ],
    });

    service = TestBed.inject(
      ProducerClientService,
    );
  });

  it('starts one run with default settings', () => {
    expect(worker.messages).toEqual([
      {
        type: 'start',
        runId: 1,
        settings: DEFAULT_PRODUCER_SETTINGS,
      },
    ]);

    expect(service.status()).toBe(
      'initializing',
    );

    expect(service.settings()).toEqual(
      DEFAULT_PRODUCER_SETTINGS,
    );
  });

  it('clears previous values when settings are applied', () => {
    worker.emit({
      type: 'snapshot',
      runId: 1,
      metrics: [
        {
          instrument: 'ALFA',
          lastPriceCents: 10_000,
          spreadCents: 2,
          volume: 50,
          vwapCents: 10_000,
          imbalance: 0,
        },
      ],
    });

    expect(service.metrics()).toHaveLength(1);

    const settings: ProducerSettings = {
      instrumentCount: 10,
      updatesPerBatch: 250,
      batchIntervalMs: 200,
    };

    service.apply(settings, 123);

    expect(service.metrics()).toEqual([]);
    expect(service.error()).toBeNull();
    expect(service.status()).toBe(
      'initializing',
    );

    expect(worker.messages.at(-1)).toEqual({
      type: 'start',
      runId: 2,
      settings,
      seed: 123,
    });
  });

  it('preserves metrics during pause and resume', () => {
    const metrics = [
      {
        instrument: 'ALFA',
        lastPriceCents: 10_200,
        spreadCents: 4,
        volume: 40,
        vwapCents: 10_150,
        imbalance: 0.2,
      },
    ];

    worker.emit({
      type: 'snapshot',
      runId: 1,
      metrics,
    });

    worker.emit({
      type: 'status',
      runId: 1,
      status: 'running',
    });

    service.pause();

    expect(worker.messages.at(-1)).toEqual({
      type: 'pause',
      runId: 1,
    });

    worker.emit({
      type: 'status',
      runId: 1,
      status: 'paused',
    });

    expect(service.status()).toBe('paused');
    expect(service.metrics()).toEqual(metrics);

    service.resume();

    expect(worker.messages.at(-1)).toEqual({
      type: 'resume',
      runId: 1,
    });

    expect(service.metrics()).toEqual(metrics);
  });

  it('ignores results from a previous run', () => {
    service.apply({
      instrumentCount: 3,
      updatesPerBatch: 20,
      batchIntervalMs: 100,
    });

    expect(service.status()).toBe(
      'initializing',
    );

    worker.emit({
      type: 'snapshot',
      runId: 1,
      metrics: [
        {
          instrument: 'OLD',
          lastPriceCents: 50_000,
          spreadCents: 10,
          volume: 999,
          vwapCents: 50_000,
          imbalance: 1,
        },
      ],
    });

    worker.emit({
      type: 'error',
      runId: 1,
      message: 'Old run error',
    });

    expect(service.metrics()).toEqual([]);
    expect(service.error()).toBeNull();
    expect(service.status()).toBe(
      'initializing',
    );
  });

  it('accepts results from the active run', () => {
    service.apply({
      instrumentCount: 3,
      updatesPerBatch: 20,
      batchIntervalMs: 100,
    });

    worker.emit({
      type: 'status',
      runId: 2,
      status: 'running',
    });

    worker.emit({
      type: 'snapshot',
      runId: 2,
      metrics: [
        {
          instrument: 'ALFA',
          lastPriceCents: 10_000,
          spreadCents: 4,
          volume: 20,
          vwapCents: 10_000,
          imbalance: 0,
        },
      ],
    });

    expect(service.status()).toBe('running');
    expect(service.metrics()).toHaveLength(1);
    expect(
      service.metrics()[0].instrument,
    ).toBe('ALFA');
  });

  it('terminates its worker when destroyed', () => {
    service.ngOnDestroy();

    expect(worker.messages.at(-1)).toEqual({
      type: 'dispose',
    });

    expect(worker.terminated).toBe(true);
    expect(worker.onmessage).toBeNull();
  });
});
