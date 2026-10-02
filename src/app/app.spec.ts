import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { App } from './app';
import {
  PRODUCER_WORKER_FACTORY,
  ProducerWorkerPort,
} from './market/producer-client.service';

function createWorkerStub(): ProducerWorkerPort {
  return {
    onmessage: null,
    postMessage: () => undefined,
    terminate: () => undefined,
  };
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: PRODUCER_WORKER_FACTORY,
          useValue: createWorkerStub,
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the application title', () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();

    const compiled =
      fixture.nativeElement as HTMLElement;

    expect(
      compiled.querySelector('h1')?.textContent,
    ).toContain(
      'Realtime Fintech Dashboard',
    );
  });
});
