// src/auth/tokenStore.ts
export type Tokens = {
  accessToken: string;
  refreshToken: string;
  tokenType?: string; // "bearer"
};

const KEY = "aiorg_tokens_v1";

export function getTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Tokens;
  } catch {
    return null;
  }
}

export function setTokens(tokens: Tokens): void {
  localStorage.setItem(KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  localStorage.removeItem(KEY);
}

export function getAccessToken(): string | null {
  return getTokens()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return getTokens()?.refreshToken ?? null;
}
