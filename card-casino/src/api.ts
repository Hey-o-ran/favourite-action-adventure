/** Client for the account registration API (battle-bricks-backliners). */
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

async function post<T>(path: string, body: unknown): Promise<T | undefined> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
  }
  const text = await res.text();
  let data: { error?: { code?: string; message?: string; fields?: Record<string, string>; details?: Record<string, unknown> } } | undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? 'Request failed', err?.fields, err?.details);
  }
  return data as T | undefined;
}

export const registerUser = async (req: RegisterRequest) => (await post<RegisterResponse>('/v1/users', req))!;
export const confirmUser = async (req: ConfirmRequest) => (await post<ConfirmResponse>('/v1/users/confirm', req))!;
export const resendCode = async (req: { email: string }) => {
  await post('/v1/users/resend-code', req);
};
