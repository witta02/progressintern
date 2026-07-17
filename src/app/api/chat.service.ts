import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { ChatMessage, ChatContact } from '../internship.models';
import { environment } from '../../environments/environment';
import { ApiService } from '../core/services/api.service';

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
    if (this.socket) {
      this.socket.close();
    }
    
    // Construct WS URL from HTTP URL
    const wsUrl = this.apiUrl.replace(/^http/, 'ws') + `/chat/ws?userId=${userId}`;
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
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    } else {
      console.error('Cannot send message, WebSocket is not open');
    }
  }

  getContacts(): Observable<ChatContact[]> {
    return this.api.get<ChatContact[]>('/chat/contacts').pipe(
      map(res => res.data || [])
    );
  }

  getHistory(userId: number): Observable<ChatMessage[]> {
    return this.api.get<ChatMessage[]>(`/chat/history/${userId}`).pipe(
      map(res => res.data || [])
    );
  }

  updateTotalUnreadCount(contacts: ChatContact[]): void {
    const total = contacts.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    this.unreadCountSubject.next(total);
  }
}
