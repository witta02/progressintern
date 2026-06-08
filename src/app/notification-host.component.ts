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
      class="fixed inset-0 z-[180] bg-slate-900/40 backdrop-blur-sm cursor-default w-full h-full border-none"
      *ngIf="panelOpen()"
      aria-label="ปิดรายการแจ้งเตือน"
      (click)="panelClosed.emit()"
    ></button>

    <div class="fixed top-6 right-6 z-[200] grid gap-3 w-full max-w-[400px] pointer-events-none" aria-live="polite" aria-atomic="false">
      <article
        *ngFor="let toast of notifications.toasts()"
        class="flex items-start gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-2xl pointer-events-auto animate-in slide-in-from-right-8 duration-300"
        role="alert"
      >
        <div class="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-sm"
             [ngClass]="{
               'bg-emerald-50 text-emerald-600': toast.type === 'success',
               'bg-rose-50 text-rose-600': toast.type === 'error',
               'bg-amber-50 text-amber-600': toast.type === 'warning',
               'bg-blue-50 text-blue-600': toast.type === 'info'
             }">
          <svg *ngIf="toast.type === 'success'" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="3" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <svg *ngIf="toast.type === 'error'" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="3" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
          <svg *ngIf="toast.type === 'warning'" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="3" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>
          <svg *ngIf="toast.type === 'info'" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="3" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        </div>
        <div class="flex-1 min-w-0 py-0.5">
          <strong class="block text-sm font-black text-slate-900 leading-tight uppercase tracking-tight">{{ toast.title }}</strong>
          <p class="mt-1 text-sm font-bold text-slate-500 leading-relaxed">{{ toast.message }}</p>
        </div>
        <button type="button" class="p-2 text-slate-300 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all" (click)="notifications.dismissToast(toast.id)">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </article>
    </div>

    <div class="fixed top-24 right-8 z-[190] w-full max-w-[420px] bg-white rounded-[2rem] shadow-2xl border border-slate-200/60 flex flex-col max-h-[calc(100vh-140px)] animate-in slide-in-from-top-4 duration-300 overflow-hidden" *ngIf="panelOpen()">
      <div class="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div>
          <h3 class="text-xl font-black text-slate-900 tracking-tight">Notifications</h3>
          <p class="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1" *ngIf="notifications.unreadCount() > 0">
            {{ notifications.unreadCount() }} Unread Messages
          </p>
        </div>
        <div class="flex gap-2">
          <button type="button" class="px-4 py-2 bg-white border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm" (click)="notifications.markAllRead()">Read All</button>
          <button type="button" class="px-4 py-2 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-100 transition-all" (click)="notifications.clearAll(); panelClosed.emit()">Clear</button>
        </div>
      </div>
      
      <div class="overflow-y-auto flex-1 p-4 scrollbar-thin">
        <ul class="space-y-2" *ngIf="notifications.history().length > 0; else emptyNotifications">
          <li
            *ngFor="let item of notifications.history()"
            class="flex items-start gap-4 p-5 rounded-2xl transition-all group border border-transparent"
            [ngClass]="{
              'bg-blue-50/40 border-blue-100/50': !item.read,
              'hover:bg-slate-50': item.read
            }"
          >
            <div class="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-sm"
                 [ngClass]="{
                   'bg-white text-emerald-600': item.type === 'success',
                   'bg-white text-rose-600': item.type === 'error',
                   'bg-white text-amber-600': item.type === 'warning',
                   'bg-white text-blue-600': item.type === 'info'
                 }">
              <svg *ngIf="item.type === 'success'" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="3" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              <svg *ngIf="item.type === 'error'" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="3" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              <svg *ngIf="item.type === 'warning'" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="3" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>
              <svg *ngIf="item.type === 'info'" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="3" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            </div>
            <div class="flex-1 min-w-0">
              <strong class="block text-sm font-black text-slate-900 leading-tight">{{ item.title }}</strong>
              <p class="mt-1 text-sm font-bold text-slate-500 line-clamp-2 leading-relaxed">{{ item.message }}</p>
              <time class="mt-2 block text-[10px] font-black text-slate-300 uppercase tracking-widest">{{ formatTime(item.createdAt) }}</time>
            </div>
            <button type="button" class="p-2 text-slate-200 hover:text-rose-500 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100" (click)="notifications.dismiss(item.id)">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </li>
        </ul>
      </div>

      <ng-template #emptyNotifications>
        <div class="py-20 text-center">
          <svg class="w-16 h-16 mx-auto mb-4 text-slate-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path></svg>
          <p class="text-slate-300 font-black uppercase tracking-[0.2em]">No new alerts</p>
        </div>
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
