import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { ProducerClientService } from '../../../market/producer-client.service';
import { integerValidator } from '../../integer.validator';

@Component({
  selector: 'app-settings',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private readonly formBuilder =
    inject(FormBuilder);

  protected readonly producer =
    inject(ProducerClientService);

  readonly form = this.formBuilder.nonNullable.group({
    instrumentCount: [
      this.producer.settings().instrumentCount,
      [
        Validators.required,
        integerValidator,
        Validators.min(1),
        Validators.max(50),
      ],
    ],

    updatesPerBatch: [
      this.producer.settings().updatesPerBatch,
      [
        Validators.required,
        integerValidator,
        Validators.min(1),
        Validators.max(1_000),
      ],
    ],

    batchIntervalMs: [
      this.producer.settings().batchIntervalMs,
      [
        Validators.required,
        integerValidator,
        Validators.min(50),
        Validators.max(2_000),
      ],
    ],
  });

  protected applySettings(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.producer.apply(
      this.form.getRawValue(),
    );

    this.form.markAsPristine();
  }

  protected nominalUpdateRate(): number | null {
    const {
      updatesPerBatch,
      batchIntervalMs,
    } = this.form.getRawValue();

    if (
      !Number.isInteger(updatesPerBatch) ||
      !Number.isInteger(batchIntervalMs) ||
      updatesPerBatch <= 0 ||
      batchIntervalMs <= 0
    ) {
      return null;
    }

    return (
      updatesPerBatch *
      (1_000 / batchIntervalMs)
    );
  }
}
