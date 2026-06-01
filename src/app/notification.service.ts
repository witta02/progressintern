import { Injectable, signal, computed } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  /** Active toast banners (auto-dismiss) */
  readonly toasts = signal<AppNotification[]>([]);

  /** Full session history for the bell panel */
  readonly history = signal<AppNotification[]>([]);

  private nextId = 1;

  readonly unreadCount = computed(() => this.history().filter(h => !h.read).length);

  notify(
    message: string,
    type: NotificationType = 'info',
    title?: string,
    durationMs = 5000
  ): AppNotification {
    const item: AppNotification = {
      id: this.nextId++,
      type,
      title: title ?? this.defaultTitle(type),
      message,
      read: false,
      createdAt: Date.now()
    };

    this.history.update(h => [item, ...h]);
    this.toasts.update(t => [item, ...t]);

    if (durationMs > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => this.dismissToast(item.id), durationMs);
    }

    return item;
  }

  success(message: string, title?: string): AppNotification {
    return this.notify(message, 'success', title);
  }

  error(message: string, title?: string): AppNotification {
    return this.notify(message, 'error', title, 7000);
  }

  warning(message: string, title?: string): AppNotification {
    return this.notify(message, 'warning', title, 6000);
  }

  info(message: string, title?: string): AppNotification {
    return this.notify(message, 'info', title);
  }

  dismissToast(id: number): void {
    this.toasts.update(toasts => toasts.filter(t => t.id !== id));
  }

  dismiss(id: number): void {
    this.dismissToast(id);
    this.history.update(history => 
      history.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }

  markAllRead(): void {
    this.history.update(history => 
      history.map(n => ({ ...n, read: true }))
    );
  }

  clearAll(): void {
    this.history.set([]);
    this.toasts.set([]);
  }

  private defaultTitle(type: NotificationType): string {
    return {
      success: 'สำเร็จ',
      error: 'ผิดพลาด',
      warning: 'แจ้งเตือน',
      info: 'ข้อมูล'
    }[type];
  }
}
