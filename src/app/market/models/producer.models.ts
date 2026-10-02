import { InstrumentMetrics } from './market.models';

export interface ProducerSettings {
  readonly instrumentCount: number;
  readonly updatesPerBatch: number;
  readonly batchIntervalMs: number;
}

export const DEFAULT_PRODUCER_SETTINGS: ProducerSettings = {
  instrumentCount: 5,
  updatesPerBatch: 100,
  batchIntervalMs: 500,
};

export type ProducerStatus =
  | 'idle'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'error';

export type ProducerWorkerCommand =
  | {
      readonly type: 'start';
      readonly runId: number;
      readonly settings: ProducerSettings;
      readonly seed?: number;
    }
  | {
      readonly type: 'pause';
      readonly runId: number;
    }
  | {
      readonly type: 'resume';
      readonly runId: number;
    }
  | {
      readonly type: 'dispose';
    };

export type ProducerWorkerEvent =
  | {
      readonly type: 'status';
      readonly runId: number;
      readonly status: ProducerStatus;
    }
  | {
      readonly type: 'snapshot';
      readonly runId: number;
      readonly metrics: readonly InstrumentMetrics[];
    }
  | {
      readonly type: 'error';
      readonly runId: number;
      readonly message: string;
    };
