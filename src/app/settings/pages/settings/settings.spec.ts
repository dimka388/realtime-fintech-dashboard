import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ProducerClientService } from '../../../market/producer-client.service';
import { Settings } from './settings';

describe('Settings', () => {
  const activeSettings = signal({
    instrumentCount: 5,
    updatesPerBatch: 100,
    batchIntervalMs: 500,
  });

  const producer = {
    settings: activeSettings,
    status: signal<
      'idle' | 'initializing' | 'running' |
      'paused' | 'error'
    >('running'),
    apply: vi.fn(),
  };

  beforeEach(async () => {
    activeSettings.set({
      instrumentCount: 5,
      updatesPerBatch: 100,
      batchIntervalMs: 500,
    });

    producer.status.set('running');
    producer.apply.mockClear();

    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        {
          provide: ProducerClientService,
          useValue: producer,
        },
      ],
    }).compileComponents();
  });

  it('initializes the form from active settings', () => {
    const fixture =
      TestBed.createComponent(Settings);

    expect(
      fixture.componentInstance.form.getRawValue(),
    ).toEqual({
      instrumentCount: 5,
      updatesPerBatch: 100,
      batchIntervalMs: 500,
    });
  });

  it('does not apply settings while editing', () => {
    const fixture =
      TestBed.createComponent(Settings);

    fixture.componentInstance.form.patchValue({
      instrumentCount: 10,
    });

    expect(producer.apply).not.toHaveBeenCalled();
    expect(activeSettings().instrumentCount).toBe(5);
  });

  it('rejects fractional values', () => {
    const fixture =
      TestBed.createComponent(Settings);

    const control =
      fixture.componentInstance.form.controls
        .updatesPerBatch;

    control.setValue(10.5);

    expect(control.hasError('integer')).toBe(true);
    expect(fixture.componentInstance.form.invalid)
      .toBe(true);
  });

  it('rejects values outside allowed ranges', () => {
    const fixture =
      TestBed.createComponent(Settings);

    const form =
      fixture.componentInstance.form;

    form.controls.instrumentCount.setValue(0);
    expect(
      form.controls.instrumentCount.hasError('min'),
    ).toBe(true);

    form.controls.updatesPerBatch.setValue(1_001);
    expect(
      form.controls.updatesPerBatch.hasError('max'),
    ).toBe(true);

    form.controls.batchIntervalMs.setValue(49);
    expect(
      form.controls.batchIntervalMs.hasError('min'),
    ).toBe(true);
  });

  it('does not submit an invalid form', () => {
    const fixture =
      TestBed.createComponent(Settings);

    fixture.componentInstance.form.controls
      .instrumentCount.setValue(0);

    fixture.detectChanges();

    const form =
      fixture.nativeElement.querySelector(
        'form',
      ) as HTMLFormElement;

    form.dispatchEvent(
      new Event('submit'),
    );

    expect(producer.apply).not.toHaveBeenCalled();
  });

  it('applies valid settings explicitly', () => {
    const fixture =
      TestBed.createComponent(Settings);

    fixture.componentInstance.form.setValue({
      instrumentCount: 10,
      updatesPerBatch: 250,
      batchIntervalMs: 200,
    });

    fixture.detectChanges();

    const form =
      fixture.nativeElement.querySelector(
        'form',
      ) as HTMLFormElement;

    form.dispatchEvent(
      new Event('submit'),
    );

    expect(producer.apply).toHaveBeenCalledOnce();

    expect(producer.apply).toHaveBeenCalledWith({
      instrumentCount: 10,
      updatesPerBatch: 250,
      batchIntervalMs: 200,
    });

    expect(
      fixture.componentInstance.form.pristine,
    ).toBe(true);
  });

  it('applies settings when the previous run is paused', () => {
    producer.status.set('paused');

    const fixture =
      TestBed.createComponent(Settings);

    fixture.componentInstance.form.patchValue({
      updatesPerBatch: 500,
    });

    fixture.detectChanges();

    const form =
      fixture.nativeElement.querySelector(
        'form',
      ) as HTMLFormElement;

    form.dispatchEvent(
      new Event('submit'),
    );

    expect(producer.apply).toHaveBeenCalledOnce();
  });
});
