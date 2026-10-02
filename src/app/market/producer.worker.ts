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

type WasmProducerModule =
  typeof import('../../../public/wasm/producer.js');

const UI_SNAPSHOT_INTERVAL_MS = 100;

let producerModulePromise:
  | Promise<WasmProducerModule>
  | null = null;

let producerModule: WasmProducerModule | null = null;
let aggregator: MarketMetricsAggregator | null = null;
let instruments: readonly string[] = [];
let activeSettings: ProducerSettings | null = null;

let activeRunId = 0;
let running = false;
let timerId: number | null = null;
let lastSnapshotTime = 0;

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
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
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
  if (producerModulePromise === null) {
    /*
     * producer.js и producer.wasm находятся рядом в public/wasm.
     * Переменная URL оставляет import динамическим: файл загружается
     * браузером во время выполнения worker.
     */
    const moduleUrl = new URL(
      'wasm/producer.js',
      self.location.href,
    ).href;

    producerModulePromise = import(
      /* @vite-ignore */
      moduleUrl
    ) as Promise<WasmProducerModule>;
  }

  return producerModulePromise;
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

    /*
     * Каждый update учитывается, даже если snapshot
     * не отправляется в UI после каждого batch.
     */
    aggregator.processBatch(updates);

    const currentTime = performance.now();

    if (
      currentTime - lastSnapshotTime >=
      UI_SNAPSHOT_INTERVAL_MS
    ) {
      emitSnapshot(runId);
    }

    timerId = setTimeout(
      () => produceNextBatch(runId),
      activeSettings.batchIntervalMs,
    );
  } catch (error) {
    handleRunError(runId, error);
  }
}

function scheduleNextBatch(runId: number): void {
  stopTimer();

  timerId = setTimeout(
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

    /*
     * Пока Wasm загружался, мог прийти новый start.
     * Старый run не должен продолжать инициализацию.
     */
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

    // UI сразу получает строки с недоступными значениями.
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

  // Отправляем последнее полностью обработанное состояние.
  emitSnapshot(runId);
  postStatus(runId, 'paused');
}

function resumeProducer(runId: number): void {
  if (runId !== activeRunId) {
    return;
  }

  running = true;

  /*
   * Если Wasm ещё загружается, startProducer сам увидит
   * running === true после окончания инициализации.
   */
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
