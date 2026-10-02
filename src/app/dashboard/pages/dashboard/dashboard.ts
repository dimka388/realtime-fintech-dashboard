import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';

import {
  CentsCurrencyPipe,
  ImbalancePipe,
} from '../../../market/formatters/market-value.pipes';
import { ProducerClientService } from '../../../market/producer-client.service';

@Component({
  selector: 'app-dashboard',
  imports: [
    DecimalPipe,
    CentsCurrencyPipe,
    ImbalancePipe,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  protected readonly producer =
    inject(ProducerClientService);

  protected readonly statusLabel = computed(() => {
    switch (this.producer.status()) {
      case 'idle':
        return 'Idle';

      case 'initializing':
        return 'Initializing';

      case 'running':
        return 'Running';

      case 'paused':
        return 'Paused';

      case 'error':
        return 'Error';
    }
  });

  protected readonly canTogglePause = computed(() => {
    const status = this.producer.status();

    return status === 'running' || status === 'paused';
  });

  protected retry(): void {
    this.producer.apply(
      this.producer.settings(),
    );
  }
}
