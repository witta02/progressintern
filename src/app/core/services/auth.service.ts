import { Injectable } from '@angular/core';

type SessionUser = {
  id: number;
  role: string;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionKey = 'intern-manager-session-v1';

  isLoggedIn(): boolean {
    return this.getCurrentUser() !== null;
  }

  getCurrentUser(): SessionUser | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const rawId = localStorage.getItem(this.sessionKey);
    if (!rawId) {
      return null;
    }

    const id = Number(rawId);
    return Number.isFinite(id) ? { id, role: 'user' } : null;
  }
}
