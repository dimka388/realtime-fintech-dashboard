import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { InstrumentMetrics } from '../../../market/models/market.models';
import { ProducerClientService } from '../../../market/producer-client.service';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  const metrics = signal<readonly InstrumentMetrics[]>([]);
  const status = signal<
    'idle' | 'initializing' | 'running' |
    'paused' | 'error'
  >('running');

  const error = signal<string | null>(null);

  const producer = {
    metrics,
    status,
    error,
    settings: signal({
      instrumentCount: 5,
      updatesPerBatch: 100,
      batchIntervalMs: 500,
    }),
    togglePause: vi.fn(),
    apply: vi.fn(),
  };

  beforeEach(async () => {
    metrics.set([]);
    status.set('running');
    error.set(null);

    producer.togglePause.mockClear();
    producer.apply.mockClear();

    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        {
          provide: ProducerClientService,
          useValue: producer,
        },
      ],
    }).compileComponents();
  });

  it('renders calculated market metrics', () => {
    metrics.set([
      {
        instrument: 'ALFA',
        lastPriceCents: 10_200,
        spreadCents: 4,
        volume: 40,
        vwapCents: 10_150,
        imbalance: 0.2,
      },
    ]);

    const fixture =
      TestBed.createComponent(Dashboard);

    fixture.detectChanges();

    const text =
      fixture.nativeElement.textContent as string;

    expect(text).toContain('ALFA');
    expect(text).toContain('$102.00');
    expect(text).toContain('$0.04');
    expect(text).toContain('40');
    expect(text).toContain('$101.50');
    expect(text).toContain('+0.20');
  });

  it('renders unavailable values and zero volume', () => {
    metrics.set([
      {
        instrument: 'ALFA',
        lastPriceCents: null,
        spreadCents: null,
        volume: 0,
        vwapCents: null,
        imbalance: null,
      },
    ]);

    const fixture =
      TestBed.createComponent(Dashboard);

    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector(
      'tbody tr',
    ) as HTMLElement;

    expect(row.textContent).toContain('ALFA');
    expect(row.textContent).toContain('0');
    expect(row.textContent).toContain('—');
  });

  it('toggles pause through the producer service', () => {
    const fixture =
      TestBed.createComponent(Dashboard);

    fixture.detectChanges();

    const button =
      fixture.nativeElement.querySelector(
        '.control-button',
      ) as HTMLButtonElement;

    button.click();

    expect(
      producer.togglePause,
    ).toHaveBeenCalledOnce();
  });

  it('shows Resume while paused', () => {
    status.set('paused');

    const fixture =
      TestBed.createComponent(Dashboard);

    fixture.detectChanges();

    const button =
      fixture.nativeElement.querySelector(
        '.control-button',
      ) as HTMLButtonElement;

    expect(button.textContent).toContain('Resume');
    expect(button.disabled).toBe(false);
  });

  it('shows producer errors', () => {
    status.set('error');
    error.set('Unable to load Wasm');

    const fixture =
      TestBed.createComponent(Dashboard);

    fixture.detectChanges();

    const alert =
      fixture.nativeElement.querySelector(
        '[role="alert"]',
      ) as HTMLElement;

    expect(alert.textContent).toContain(
      'Unable to load Wasm',
    );
  });
});
