import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: Date;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private items: NotificationItem[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private saveToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        'intern-manager-notifications-v1',
        JSON.stringify(this.items),
      );
    }
  }

  private loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('intern-manager-notifications-v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          this.items = parsed.map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp),
          }));
        }
      } catch (e) {
        console.error('Failed to load notifications from storage', e);
      }
    }
  }

  hasNotificationSupport(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  get permissionStatus(): string {
    if (this.hasNotificationSupport()) {
      return Notification.permission;
    }
    return 'unsupported';
  }

  async requestPermission(): Promise<boolean> {
    if (!this.hasNotificationSupport()) {
      console.warn('This browser does not support desktop notifications.');
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (err) {
      // Legacy browsers might use callbacks instead of promises
      return new Promise<boolean>((resolve) => {
        try {
          Notification.requestPermission((permission) => {
            resolve(permission === 'granted');
          });
        } catch (e) {
          resolve(false);
        }
      });
    }
  }

  notify(
    message: string,
    type: NotificationType = 'info',
    title?: string,
    durationMs = 3000,
    showPopup: boolean = true,
  ): void {
    const itemTitle = title || this.defaultTitle(type);

    // Add to local history list
    const newItem: NotificationItem = {
      id: Math.random().toString(36).substring(2, 11),
      title: itemTitle,
      message,
      type,
      timestamp: new Date(),
      read: false,
    };

    this.items.unshift(newItem);
    if (this.items.length > 50) {
      this.items.pop();
    }
    this.saveToStorage();

    // Trigger native desktop/mobile notification if supported, permission granted, and tab backgrounded
    if (showPopup) {
      if (
        this.hasNotificationSupport() &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(itemTitle, {
            body: message,
            icon: '/favicon.ico',
          });
        } catch (err) {
          console.error('Error triggering native browser notification:', err);
        }
      }

      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        showCloseButton: true,
        timer: durationMs,
        timerProgressBar: true,
        customClass: {
          popup:
            '!font-sans !bg-white/95 !backdrop-blur-xl !border !border-slate-200/60 !shadow-2xl !rounded-2xl !p-4 !mt-4 !mr-4',
          title: '!text-slate-900 !font-black !text-sm !mt-1',
          htmlContainer: '!text-slate-500 !font-bold !text-xs !mt-1',
          timerProgressBar: '!bg-blue-600/30',
          closeButton:
            '!text-slate-400 hover:!text-slate-700 hover:!bg-slate-100 !rounded-xl !transition-all !mt-2 !mr-2',
          icon: '!border-0 !scale-75 !m-0 !mr-3',
        },
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });

      Toast.fire({
        icon: type,
        title: itemTitle,
        text: message,
      });
    }
  }

  success(message: string, title?: string, showPopup: boolean = false): void {
    this.notify(message, 'success', title, 3000, showPopup);
  }

  error(message: string, title?: string, showPopup: boolean = true): void {
    this.notify(message, 'error', title, 5000, showPopup);
  }

  warning(message: string, title?: string, showPopup: boolean = true): void {
    this.notify(message, 'warning', title, 3000, showPopup);
  }

  info(message: string, title?: string, showPopup: boolean = false): void {
    this.notify(message, 'info', title, 3000, showPopup);
  }

  confirm(title: string, text: string): Promise<boolean> {
    return Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
    }).then((result) => result.isConfirmed);
  }

  private defaultTitle(type: NotificationType): string {
    return {
      success: 'สำเร็จ',
      error: 'ผิดพลาด',
      warning: 'แจ้งเตือน',
      info: 'ข้อมูล',
    }[type];
  }

  // Compatibility and utility methods
  markAllRead(): void {
    this.items.forEach((item) => (item.read = true));
    this.saveToStorage();
  }

  clearAll(): void {
    this.items = [];
    this.saveToStorage();
  }

  dismiss(id: string | number): void {
    const idStr = id.toString();
    this.items = this.items.filter((item) => item.id !== idStr);
    this.saveToStorage();
  }

  dismissToast(id: number): void {
    this.dismiss(id);
  }

  get toasts() {
    return () => this.items;
  }

  get history() {
    return () => this.items;
  }

  get unreadCount() {
    return () => this.items.filter((item) => !item.read).length;
  }
}
