/// <reference lib="webworker" />

import { createInstrumentSymbols } from './instrument-symbols';
import { decodeMarketBatch } from './market-batch-decoder';
import { MarketMetricsAggregator } from './metrics/market-metrics';
import {
  ProducerSettings,
  ProducerStatus,
  ProducerWorkerCommand,
  ProducerWorkerEvent,
} from './models/producer.models';
import { ProducerTimer } from './producer-timer';
import { RetryableLoader } from './retryable-loader';

type WasmProducerModule =
  typeof import('../../../public/wasm/producer.js');

const UI_SNAPSHOT_INTERVAL_MS = 100;

let producerModule: WasmProducerModule | null = null;
let aggregator: MarketMetricsAggregator | null = null;
let instruments: readonly string[] = [];
let activeSettings: ProducerSettings | null = null;

let activeRunId = 0;
let running = false;
let lastSnapshotTime = 0;

const producerTimer = new ProducerTimer();

const producerModuleLoader =
  new RetryableLoader<WasmProducerModule>(() => {
    /*
     * producer.js and producer.wasm are served together from
     * public/wasm. Keeping the URL in a variable makes this a
     * runtime import inside the worker.
     */
    const moduleUrl = new URL(
      'wasm/producer.js',
      self.location.href,
    ).href;

    return import(
      /* @vite-ignore */
      moduleUrl
    ) as Promise<WasmProducerModule>;
  });

function postWorkerEvent(event: ProducerWorkerEvent): void {
  postMessage(event);
}

function postStatus(
  runId: number,
  status: ProducerStatus,
): void {
  postWorkerEvent({
    type: 'status',
    runId,
    status,
  });
}

function stopTimer(): void {
  producerTimer.cancel();
}

function validateSettings(
  settings: ProducerSettings,
): void {
  if (
    !Number.isInteger(settings.instrumentCount) ||
    settings.instrumentCount < 1 ||
    settings.instrumentCount > 50
  ) {
    throw new Error(
      'Instrument count must be an integer between 1 and 50',
    );
  }

  if (
    !Number.isInteger(settings.updatesPerBatch) ||
    settings.updatesPerBatch < 1 ||
    settings.updatesPerBatch > 1_000
  ) {
    throw new Error(
      'Updates per batch must be an integer between 1 and 1000',
    );
  }

  if (
    !Number.isInteger(settings.batchIntervalMs) ||
    settings.batchIntervalMs < 50 ||
    settings.batchIntervalMs > 2_000
  ) {
    throw new Error(
      'Batch interval must be an integer between 50 and 2000',
    );
  }
}

function createSeed(): number {
  const values = new Uint32Array(1);

  crypto.getRandomValues(values);

  return values[0] || 1;
}

function loadProducerModule(): Promise<WasmProducerModule> {
  return producerModuleLoader.get();
}

function emitSnapshot(runId: number): void {
  if (
    runId !== activeRunId ||
    aggregator === null
  ) {
    return;
  }

  postWorkerEvent({
    type: 'snapshot',
    runId,
    metrics: aggregator.getSnapshot(),
  });

  lastSnapshotTime = performance.now();
}

function handleRunError(
  runId: number,
  error: unknown,
): void {
  if (runId !== activeRunId) {
    return;
  }

  running = false;
  stopTimer();

  const message =
    error instanceof Error
      ? error.message
      : 'Unknown producer error';

  postStatus(runId, 'error');

  postWorkerEvent({
    type: 'error',
    runId,
    message,
  });
}

function produceNextBatch(runId: number): void {
  if (
    !running ||
    runId !== activeRunId ||
    producerModule === null ||
    aggregator === null ||
    activeSettings === null
  ) {
    return;
  }

  try {
    const encodedBatch =
      producerModule.generateBatch(
        activeSettings.updatesPerBatch,
      );

    const updates = decodeMarketBatch(
      encodedBatch,
      instruments,
    );

    // Every update is aggregated even when the UI is throttled.
    aggregator.processBatch(updates);

    const currentTime = performance.now();

    if (
      currentTime - lastSnapshotTime >=
      UI_SNAPSHOT_INTERVAL_MS
    ) {
      emitSnapshot(runId);
    }

    producerTimer.schedule(
      () => produceNextBatch(runId),
      activeSettings.batchIntervalMs,
    );
  } catch (error) {
    handleRunError(runId, error);
  }
}

function scheduleNextBatch(runId: number): void {
  stopTimer();

  producerTimer.schedule(
    () => produceNextBatch(runId),
    0,
  );
}

async function startProducer(
  command: Extract<
    ProducerWorkerCommand,
    { type: 'start' }
  >,
): Promise<void> {
  stopTimer();

  activeRunId = command.runId;
  running = true;
  aggregator = null;
  producerModule = null;
  activeSettings = command.settings;
  instruments = [];
  lastSnapshotTime = 0;

  postStatus(command.runId, 'initializing');

  try {
    validateSettings(command.settings);

    const loadedModule = await loadProducerModule();

    // A newer run may have started while the Wasm module loaded.
    if (command.runId !== activeRunId) {
      return;
    }

    producerModule = loadedModule;

    instruments = createInstrumentSymbols(
      command.settings.instrumentCount,
    );

    producerModule.initialize(
      command.settings.instrumentCount,
      command.seed ?? createSeed(),
    );

    aggregator = new MarketMetricsAggregator(
      instruments,
    );

    // Render every instrument before its first update arrives.
    emitSnapshot(command.runId);

    if (running) {
      postStatus(command.runId, 'running');
      scheduleNextBatch(command.runId);
    } else {
      postStatus(command.runId, 'paused');
    }
  } catch (error) {
    handleRunError(command.runId, error);
  }
}

function pauseProducer(runId: number): void {
  if (runId !== activeRunId) {
    return;
  }

  running = false;
  stopTimer();

  // Publish the last fully processed state before pausing.
  emitSnapshot(runId);
  postStatus(runId, 'paused');
}

function resumeProducer(runId: number): void {
  if (runId !== activeRunId) {
    return;
  }

  running = true;

  // startProducer schedules the batch after an in-progress load.
  if (
    producerModule === null ||
    aggregator === null
  ) {
    postStatus(runId, 'initializing');
    return;
  }

  postStatus(runId, 'running');
  scheduleNextBatch(runId);
}

function disposeProducer(): void {
  running = false;
  stopTimer();

  aggregator = null;
  producerModule = null;
  activeSettings = null;
  instruments = [];

  close();
}

addEventListener(
  'message',
  ({ data }: MessageEvent<ProducerWorkerCommand>) => {
    switch (data.type) {
      case 'start':
        void startProducer(data);
        break;

      case 'pause':
        pauseProducer(data.runId);
        break;

      case 'resume':
        resumeProducer(data.runId);
        break;

      case 'dispose':
        disposeProducer();
        break;
    }
  },
);
