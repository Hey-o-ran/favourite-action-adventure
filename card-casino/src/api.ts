/** Client for the account API (battle-bricks-backliners). */
const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'https://absent-attackers-api.haoran.cloud';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export interface RegisterRequest {
  displayName: string;
  email: string;
  password: string;
}
export interface RegisterResponse {
  userId: string;
  email: string;
  displayName: string;
  status: 'UNCONFIRMED';
}
export interface ConfirmRequest {
  email: string;
  code: string;
}
export interface ConfirmResponse {
  email: string;
  status: 'CONFIRMED';
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface LoginResponse {
  idToken: string;
  /** Seconds until the token expires. */
  expiresIn: number;
  user: { userId: string; email: string; displayName: string; isAdmin: boolean };
}
export interface PendingUser {
  userId: string;
  email: string;
  displayName: string;
  createdAt: string;
}

interface ErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string>; details?: Record<string, unknown> };
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, token?: string): Promise<T | undefined> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const err = (data as ErrorBody | undefined)?.error;
    // API Gateway rejects a missing/expired token itself, with a body that has no `error`.
    const code = err?.code ?? (res.status === 401 ? 'UNAUTHORIZED' : 'UNKNOWN');
    throw new ApiError(res.status, code, err?.message ?? 'Request failed', err?.fields, err?.details);
  }
  return data as T | undefined;
}

export const registerUser = async (req: RegisterRequest) => (await request<RegisterResponse>('POST', '/v1/users', req))!;
export const confirmUser = async (req: ConfirmRequest) =>
  (await request<ConfirmResponse>('POST', '/v1/users/confirm', req))!;
export const resendCode = async (req: { email: string }) => {
  await request('POST', '/v1/users/resend-code', req);
};
export const login = async (req: LoginRequest) => (await request<LoginResponse>('POST', '/v1/auth/login', req))!;

export const listPendingUsers = async (token: string) =>
  (await request<{ users: PendingUser[] }>('GET', '/v1/admin/users', undefined, token))!;
export const approveUser = async (token: string, userId: string) =>
  (await request<{ userId: string; status: 'ACTIVE' }>(
    'POST',
    `/v1/admin/users/${encodeURIComponent(userId)}/approve`,
    undefined,
    token,
  ))!;

/** An "admin abuse" event: the admin starts it and every player is told about it. */
export type AbuseEventType = 'FREE_COINS' | 'UNLOSEABLE';
export interface AbuseEvent {
  eventId: string;
  type: AbuseEventType;
  title: string;
  message: string;
  /** Coins given to each player, for FREE_COINS events. */
  amount?: number;
  startedAt: string;
  expiresAt: string;
}
export interface StartEventRequest {
  type: AbuseEventType;
  /** FREE_COINS only. */
  amount?: number;
  durationMinutes?: number;
}

export const startEvent = async (token: string, req: StartEventRequest) =>
  (await request<{ event: AbuseEvent }>('POST', '/v1/admin/events', req, token))!;
export const listActiveEvents = async (token: string) =>
  (await request<{ events: AbuseEvent[] }>('GET', '/v1/events/active', undefined, token))!;
/** `claimed` is true only the first time this player claims this event, so apply its effect only then. */
export const claimEvent = async (token: string, eventId: string) =>
  (await request<{ eventId: string; claimed: boolean }>('POST', `/v1/events/${encodeURIComponent(eventId)}/claim`, undefined, token))!;
