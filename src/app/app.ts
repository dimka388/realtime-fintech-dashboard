import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ProducerClientService } from './market/producer-client.service';

@Component({
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly producer = inject(ProducerClientService);
  protected readonly title = signal('realtime-fintech-dashboard');
}
