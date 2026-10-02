import {
  CentsCurrencyPipe,
  ImbalancePipe,
} from './market-value.pipes';

describe('CentsCurrencyPipe', () => {
  const pipe = new CentsCurrencyPipe();

  it('formats cents as US dollars', () => {
    expect(pipe.transform(10_150)).toBe(
      '$101.50',
    );
  });

  it('returns unavailable marker for null', () => {
    expect(pipe.transform(null)).toBe('—');
  });
});

describe('ImbalancePipe', () => {
  const pipe = new ImbalancePipe();

  it('formats positive, negative and zero values', () => {
    expect(pipe.transform(0.2)).toBe('+0.20');
    expect(pipe.transform(-0.25)).toBe('−0.25');
    expect(pipe.transform(0)).toBe('0.00');
  });

  it('returns unavailable marker for null', () => {
    expect(pipe.transform(null)).toBe('—');
  });
});
