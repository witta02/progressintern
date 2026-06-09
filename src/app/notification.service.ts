import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  
  notify(
    message: string,
    type: NotificationType = 'info',
    title?: string,
    durationMs = 3000
  ): void {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: durationMs,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
      }
    });

    Toast.fire({
      icon: type,
      title: title || this.defaultTitle(type),
      text: message
    });
  }

  success(message: string, title?: string): void {
    this.notify(message, 'success', title);
  }

  error(message: string, title?: string): void {
    this.notify(message, 'error', title, 5000);
  }

  warning(message: string, title?: string): void {
    this.notify(message, 'warning', title);
  }

  info(message: string, title?: string): void {
    this.notify(message, 'info', title);
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
      cancelButtonText: 'ยกเลิก'
    }).then((result) => result.isConfirmed);
  }

  private defaultTitle(type: NotificationType): string {
    return {
      success: 'สำเร็จ',
      error: 'ผิดพลาด',
      warning: 'แจ้งเตือน',
      info: 'ข้อมูล'
    }[type];
  }

  // Compatibility methods for old code
  markAllRead(): void {}
  clearAll(): void {}
  dismissToast(id: number): void {}
  dismiss(id: number): void {}
  
  get toasts() { return () => []; }
  get history() { return () => []; }
  get unreadCount() { return () => 0; }
}
