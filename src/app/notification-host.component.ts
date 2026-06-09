import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notification-host',
  standalone: true,
  imports: [CommonModule],
  template: ``,
  styles: [``]
})
export class NotificationHostComponent {
  @Input() panelOpen = false;
  @Output() panelClosed = new EventEmitter<void>();
}
