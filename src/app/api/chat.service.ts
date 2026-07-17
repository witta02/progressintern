import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { map, delay } from 'rxjs/operators';
import { ChatMessage, ChatContact } from '../internship.models';
import { environment } from '../../environments/environment';
import { ApiService } from '../core/services/api.service';

const MOCK_CONTACTS: ChatContact[] = [
  { user_id: 2, name: 'อ.ดร. สมชาย ใจดี', role: 'advisor', unread_count: 2, profile_image: '', online_status: 'online', last_message: 'กำลังดำเนินการครับอาจารย์', last_message_time: new Date().toISOString() },
  { user_id: 3, name: 'HR ก้าวไกลจำกัด', role: 'company', unread_count: 0, profile_image: '', online_status: 'offline', last_message: '', last_message_time: new Date().toISOString() },
  { user_id: 4, name: 'น.ส. เรียนดี ตั้งใจ', role: 'student', unread_count: 1, profile_image: '', online_status: 'AFK', last_message: 'รบกวนตรวจรายงานให้หน่อยค่ะ', last_message_time: new Date().toISOString() }
];

const MOCK_HISTORY: Record<number, ChatMessage[]> = {
  2: [
    { id: 1, sender_id: 2, receiver_id: 1, message: 'สวัสดีครับ ส่งเอกสารหรือยังครับ?', created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 2, sender_id: 1, receiver_id: 2, message: 'กำลังดำเนินการครับอาจารย์', created_at: new Date(Date.now() - 1800000).toISOString() }
  ],
  3: [],
  4: [
    { id: 3, sender_id: 4, receiver_id: 1, message: 'รบกวนตรวจรายงานให้หน่อยค่ะ', created_at: new Date(Date.now() - 7200000).toISOString() }
  ]
};

export interface ChatResponse<T> {
  status: number;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private api = inject(ApiService);
  
  private socket: WebSocket | null = null;
  private messageSubject = new Subject<ChatMessage>();
  public messages$ = this.messageSubject.asObservable();
  
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private apiUrl = environment.apiUrl || 'http://localhost:8080/api';

  connect(userId: number): void {
    if (environment.useMockData) {
      console.log('Chat WebSocket connected (Mock Mode).');
      return;
    }

    if (this.socket) {
      this.socket.close();
    }
    
    // Construct WS URL from HTTP URL properly handling relative /api paths
    let baseUrl = this.apiUrl;
    if (baseUrl.startsWith('/')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      baseUrl = `${protocol}//${window.location.host}${baseUrl}`;
    } else {
      baseUrl = baseUrl.replace(/^http/, 'ws');
    }
    
    const wsUrl = `${baseUrl}/chat/ws?userId=${userId}`;
    this.socket = new WebSocket(wsUrl);

    this.socket.onmessage = (event) => {
      try {
        const msg: ChatMessage = JSON.parse(event.data);
        this.messageSubject.next(msg);
      } catch (e) {
        console.error('Error parsing chat message', e);
      }
    };

    this.socket.onclose = () => {
      console.log('Chat WebSocket closed. Reconnecting in 3s...');
      setTimeout(() => this.connect(userId), 3000);
    };

    this.socket.onerror = (err) => {
      console.error('Chat WebSocket error', err);
    };
  }

  sendMessage(msg: ChatMessage): void {
    if (environment.useMockData) {
      // Simulate own message echoing back locally since we don't have a real WS
      setTimeout(() => {
        const localMsg = { ...msg, id: Date.now(), created_at: new Date().toISOString() };
        this.messageSubject.next(localMsg);
        
        // Auto-reply simulation
        setTimeout(() => {
          this.messageSubject.next({
            id: Date.now() + 1,
            sender_id: msg.receiver_id,
            receiver_id: msg.sender_id,
            message: 'นี่คือข้อความตอบกลับอัตโนมัติ (Mock Data)',
            created_at: new Date().toISOString()
          });
        }, 1500);
      }, 50);
      return;
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    } else {
      console.error('Cannot send message, WebSocket is not open');
    }
  }

  getContacts(): Observable<ChatContact[]> {
    if (environment.useMockData) {
      return of(MOCK_CONTACTS).pipe(delay(500));
    }
    return this.api.get<ChatContact[]>('/chat/contacts').pipe(
      map(res => res.data || [])
    );
  }

  getHistory(userId: number): Observable<ChatMessage[]> {
    if (environment.useMockData) {
      return of(MOCK_HISTORY[userId] || []).pipe(delay(300));
    }
    return this.api.get<ChatMessage[]>(`/chat/history/${userId}`).pipe(
      map(res => res.data || [])
    );
  }

  updateTotalUnreadCount(contacts: ChatContact[]): void {
    const total = contacts.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    this.unreadCountSubject.next(total);
  }
}
