import {
  Injectable,
  InjectionToken,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';

import { InstrumentMetrics } from './models/market.models';
import {
  DEFAULT_PRODUCER_SETTINGS,
  ProducerSettings,
  ProducerStatus,
  ProducerWorkerCommand,
  ProducerWorkerEvent,
} from './models/producer.models';

export interface ProducerWorkerPort {
  onmessage:
    | ((
        event: MessageEvent<ProducerWorkerEvent>,
      ) => void)
    | null;

  postMessage(message: ProducerWorkerCommand): void;
  terminate(): void;
}

export type ProducerWorkerFactory =
  () => ProducerWorkerPort;

export const PRODUCER_WORKER_FACTORY =
  new InjectionToken<ProducerWorkerFactory>(
    'PRODUCER_WORKER_FACTORY',
    {
      providedIn: 'root',
      factory: () => {
        return () =>
          new Worker(
            new URL(
              './producer.worker',
              import.meta.url,
            ),
            {
              type: 'module',
              name: 'market-producer',
            },
          ) as unknown as ProducerWorkerPort;
      },
    },
  );

@Injectable({
  providedIn: 'root',
})
export class ProducerClientService
  implements OnDestroy
{
  private readonly workerFactory = inject(
    PRODUCER_WORKER_FACTORY,
  );

  private readonly worker = this.workerFactory();

  private readonly metricsState =
    signal<readonly InstrumentMetrics[]>([]);

  private readonly statusState =
    signal<ProducerStatus>('idle');

  private readonly errorState =
    signal<string | null>(null);

  private readonly settingsState =
    signal<ProducerSettings>({
      ...DEFAULT_PRODUCER_SETTINGS,
    });

  readonly metrics = this.metricsState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly settings = this.settingsState.asReadonly();

  private activeRunId = 0;
  private disposed = false;

  constructor() {
    this.worker.onmessage = (event) => {
      this.handleWorkerEvent(event.data);
    };

    this.apply(DEFAULT_PRODUCER_SETTINGS);
  }

  /**
   * Начинает новый run и очищает предыдущие результаты.
   */
  apply(
    settings: ProducerSettings,
    seed?: number,
  ): void {
    if (this.disposed) {
      return;
    }

    const activeSettings = {
      ...settings,
    };

    this.activeRunId += 1;

    this.settingsState.set(activeSettings);
    this.metricsState.set([]);
    this.errorState.set(null);
    this.statusState.set('initializing');

    const command:
      Extract<
        ProducerWorkerCommand,
        { type: 'start' }
      > =
      seed === undefined
        ? {
            type: 'start',
            runId: this.activeRunId,
            settings: activeSettings,
          }
        : {
            type: 'start',
            runId: this.activeRunId,
            settings: activeSettings,
            seed,
          };

    this.worker.postMessage(command);
  }

  pause(): void {
    if (this.disposed) {
      return;
    }

    this.worker.postMessage({
      type: 'pause',
      runId: this.activeRunId,
    });
  }

  resume(): void {
    if (this.disposed) {
      return;
    }

    this.worker.postMessage({
      type: 'resume',
      runId: this.activeRunId,
    });
  }

  togglePause(): void {
    if (this.statusState() === 'paused') {
      this.resume();
      return;
    }

    if (this.statusState() === 'running') {
      this.pause();
    }
  }

  ngOnDestroy(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.worker.onmessage = null;

    this.worker.postMessage({
      type: 'dispose',
    });

    this.worker.terminate();
  }

  private handleWorkerEvent(
    event: ProducerWorkerEvent,
  ): void {
    /*
     * Поздние сообщения предыдущего run игнорируются.
     */
    if (event.runId !== this.activeRunId) {
      return;
    }

    switch (event.type) {
      case 'status':
        this.statusState.set(event.status);
        break;

      case 'snapshot':
        this.metricsState.set(event.metrics);
        break;

      case 'error':
        this.errorState.set(event.message);
        this.statusState.set('error');
        break;
    }
  }
}
