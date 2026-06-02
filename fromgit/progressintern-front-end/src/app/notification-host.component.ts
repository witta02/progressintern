import { CommonModule } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { AppNotification, NotificationService } from './notification.service';

@Component({
  selector: 'app-notification-host',
  imports: [CommonModule],
  styleUrl: './notification-host.component.css',
  template: `
    <button
      type="button"
      class="notification-panel-backdrop"
      *ngIf="panelOpen()"
      aria-label="ปิดรายการแจ้งเตือน"
      (click)="panelClosed.emit()"
    ></button>

    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      <article
        *ngFor="let toast of notifications.toasts()"
        class="toast"
        [ngClass]="'toast-' + toast.type"
        role="alert"
        style="animation: slideIn 0.3s ease-out;"
      >
        <div class="toast-body">
          <strong>{{ toast.title }}</strong>
          <p>{{ toast.message }}</p>
        </div>
        <button type="button" class="toast-close" aria-label="ปิด" (click)="notifications.dismissToast(toast.id)">
          &times;
        </button>
      </article>
    </div>

    <div class="notification-panel" *ngIf="panelOpen()">
      <div class="notification-panel-header">
        <h3>การแจ้งเตือน</h3>
        <span class="notification-count" *ngIf="notifications.unreadCount() > 0">
          {{ notifications.unreadCount() }} ใหม่
        </span>
      </div>
      <div class="notification-panel-actions">
        <button type="button" class="small secondary" (click)="notifications.markAllRead()">อ่านทั้งหมด</button>
        <button type="button" class="small secondary" (click)="notifications.clearAll(); panelClosed.emit()">
          ล้างทั้งหมด
        </button>
      </div>
      <ul class="notification-list" *ngIf="notifications.history().length > 0; else emptyNotifications">
        <li
          *ngFor="let item of notifications.history()"
          class="notification-item"
          [ngClass]="['notification-' + item.type, { unread: !item.read }]"
        >
          <div class="notification-item-main">
            <strong style="display: block; color: #1e293b; font-size: 14px; margin-bottom: 2px;">{{ item.title }}</strong>
            <p style="margin: 0; color: #475569; font-size: 13px; line-height: 1.4;">{{ item.message }}</p>
            <time style="display: block; margin-top: 4px; color: #94a3b8; font-size: 11px;">{{ formatTime(item.createdAt) }}</time>
          </div>
          <button type="button" class="toast-close" style="align-self: center;" aria-label="ลบ" (click)="notifications.dismiss(item.id)">×</button>
        </li>
      </ul>
      <ng-template #emptyNotifications>
        <p class="notification-empty">ยังไม่มีการแจ้งเตือน</p>
      </ng-template>
    </div>
  `
})
export class NotificationHostComponent {
  protected readonly notifications = inject(NotificationService);

  readonly panelOpen = input(false);
  readonly panelClosed = output<void>();

  protected formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short'
    });
  }
}
