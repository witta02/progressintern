import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from './notification.service';

@Component({
  selector: 'app-notification-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="fixed inset-0 z-50 transition-opacity duration-300"
      [class.opacity-100]="panelOpen"
      [class.opacity-0]="!panelOpen"
      [class.pointer-events-auto]="panelOpen"
      [class.pointer-events-none]="!panelOpen"
    >
      <!-- Backdrop -->
      <div 
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
        [class.opacity-100]="panelOpen"
        [class.opacity-0]="!panelOpen"
        (click)="panelClosed.emit()"
      ></div>

      <!-- Panel content sliding from right -->
      <div 
        class="absolute inset-y-0 right-0 w-full sm:w-[450px] bg-white/95 backdrop-blur-md shadow-2xl border-l border-slate-200/60 flex flex-col transition-transform duration-300 transform"
        [class.translate-x-0]="panelOpen"
        [class.translate-x-full]="!panelOpen"
      >
        <!-- Header -->
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h3 class="text-xl font-black text-slate-900">การแจ้งเตือน</h3>
            <span *ngIf="unreadCount > 0" class="px-2.5 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full shadow-sm animate-pulse">
              {{ unreadCount }} รายการใหม่
            </span>
          </div>
          
          <div class="flex items-center gap-2">
            <button 
              *ngIf="notificationsList.length > 0" 
              (click)="markAllRead()"
              class="text-xs font-black text-blue-600 hover:text-blue-700 px-2.5 py-1.5 rounded-xl hover:bg-blue-55/10 transition-all"
            >
              อ่านทั้งหมด
            </button>
            <button 
              *ngIf="notificationsList.length > 0" 
              (click)="clearAll()"
              class="text-xs font-black text-slate-400 hover:text-rose-600 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 hover:bg-rose-50/50 transition-all"
            >
              ล้างทั้งหมด
            </button>
            <button 
              (click)="panelClosed.emit()" 
              class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Notification List -->
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          <div *ngIf="notificationsList.length === 0" class="h-full flex flex-col items-center justify-center text-center p-8">
            <div class="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-300 mb-4 border border-slate-100/50">
              <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
              </svg>
            </div>
            <h4 class="text-lg font-black text-slate-900 mb-1">ไม่มีการแจ้งเตือน</h4>
            <p class="text-sm text-slate-400 font-bold max-w-[250px]">เมื่อระบบมีประกาศหรือประวัติการทำงานของคุณจะแสดงที่นี่</p>
          </div>

          <div 
            *ngFor="let notification of notificationsList" 
            class="p-4 rounded-2xl border transition-all flex gap-4 relative group hover:shadow-md hover:border-slate-300/40"
            [class.bg-white]="notification.read"
            [class.border-slate-200/50]="notification.read"
            [class.bg-blue-50/20]="!notification.read"
            [class.border-blue-100/50]="!notification.read"
            [class.shadow-sm]="!notification.read"
          >
            <!-- Unread Indicator Dot -->
            <span *ngIf="!notification.read" class="absolute top-4 right-10 w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>

            <!-- Dismiss button -->
            <button 
              (click)="dismiss(notification.id)" 
              class="absolute top-4 right-4 p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>

            <!-- Status Icon -->
            <div 
              class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm border"
              [class.bg-emerald-50]="notification.type === 'success'" [class.text-emerald-650]="notification.type === 'success'" [class.border-emerald-100]="notification.type === 'success'"
              [class.bg-rose-50]="notification.type === 'error'" [class.text-rose-650]="notification.type === 'error'" [class.border-rose-100]="notification.type === 'error'"
              [class.bg-amber-50]="notification.type === 'warning'" [class.text-amber-650]="notification.type === 'warning'" [class.border-amber-100]="notification.type === 'warning'"
              [class.bg-blue-50]="notification.type === 'info'" [class.text-blue-605]="notification.type === 'info'" [class.border-blue-100]="notification.type === 'info'"
            >
              <svg *ngIf="notification.type === 'success'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path d="M5 13l4 4L19 7"></path></svg>
              <svg *ngIf="notification.type === 'error'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <svg *ngIf="notification.type === 'warning'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <svg *ngIf="notification.type === 'info'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>

            <!-- Text Content -->
            <div class="flex-1 pr-6 font-sans">
              <h5 class="text-sm font-black text-slate-900 mb-0.5 leading-snug">{{ notification.title }}</h5>
              <p class="text-xs text-slate-500 font-bold leading-relaxed">{{ notification.message }}</p>
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider block mt-2">{{ getRelativeTime(notification.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
    .text-emerald-655 { color: #059669; }
    .text-rose-655 { color: #dc2626; }
    .text-amber-655 { color: #d97706; }
    .text-blue-605 { color: #2563eb; }
    .font-black, .font-extrabold, .font-bold, .font-semibold, .font-medium, .font-normal {
      font-weight: 400 !important;
    }
    h3, h4, h5, button, span, p {
      font-weight: 400 !important;
    }
    `
  ]
})
export class NotificationHostComponent {
  @Input() panelOpen = false;
  @Output() panelClosed = new EventEmitter<void>();

  private notifications = inject(NotificationService);

  get notificationsList() {
    return this.notifications.toasts();
  }

  get unreadCount() {
    return this.notifications.unreadCount();
  }

  markAllRead() {
    this.notifications.markAllRead();
  }

  clearAll() {
    this.notifications.clearAll();
  }

  dismiss(id: string) {
    this.notifications.dismiss(id);
  }

  getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    if (diffDays === 1) return 'เมื่อวานนี้';
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
