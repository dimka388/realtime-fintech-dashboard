import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'centsCurrency',
})
export class CentsCurrencyPipe implements PipeTransform {
  private readonly formatter =
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  transform(cents: number | null): string {
    if (cents === null) {
      return '—';
    }

    return this.formatter.format(cents / 100);
  }
}

@Pipe({
  name: 'imbalance',
})
export class ImbalancePipe implements PipeTransform {
  transform(value: number | null): string {
    if (value === null) {
      return '—';
    }

    if (value > 0) {
      return `+${value.toFixed(2)}`;
    }

    if (value < 0) {
      return `−${Math.abs(value).toFixed(2)}`;
    }

    return '0.00';
  }
}
