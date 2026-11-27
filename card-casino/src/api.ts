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
/** What a ban tells the player: why, and until when. */
export interface BanDetails {
  title: string;
  description: string;
  /** When the ban ends, as a date and time. */
  until: string;
}
/** A ban as the admin sees it in the list. */
export interface Ban extends BanDetails {
  userId: string;
  displayName: string;
  bannedAt: string;
  bannedBy: string;
}

let bannedHandler: ((ban: BanDetails) => void) | null = null;
/** Called when any request is refused because the player is banned, so the screen can show the ban whatever they were doing. */
export const setBannedHandler = (handler: ((ban: BanDetails) => void) | null) => {
  bannedHandler = handler;
};
const asBanDetails = (details: Record<string, unknown> | undefined): BanDetails | null =>
  details && typeof details.title === 'string' && typeof details.description === 'string' && typeof details.until === 'string'
    ? { title: details.title, description: details.description, until: details.until }
    : null;
/** The ban an error carries, if it is the "banned" error. */
export const banOf = (err: unknown): BanDetails | null => (err instanceof ApiError && err.code === 'BANNED' ? asBanDetails(err.details) : null);

interface ErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string>; details?: Record<string, unknown> };
}

interface RequestOptions {
  /** Lets the request finish even if the page is being closed. */
  keepalive?: boolean;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
  token?: string,
  options: RequestOptions = {},
): Promise<T | undefined> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  let res: Response;
  let text: string;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive: options.keepalive,
    });
    text = await res.text();
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
  }

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
    const failure = new ApiError(res.status, code, err?.message ?? 'Request failed', err?.fields, err?.details);
    const ban = banOf(failure);
    if (ban) bannedHandler?.(ban);
    throw failure;
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

/** Bans a player for a while. The player is shown the title and description. */
export const banUser = async (token: string, userId: string, req: { title: string; description: string; durationMinutes: number }) =>
  (await request<{ ban: Ban }>('POST', `/v1/admin/users/${encodeURIComponent(userId)}/ban`, req, token))!;
export const liftBan = async (token: string, userId: string) =>
  (await request<{ lifted: boolean }>('POST', `/v1/admin/users/${encodeURIComponent(userId)}/unban`, undefined, token))!;
export const listBans = async (token: string) => (await request<{ bans: Ban[] }>('GET', '/v1/admin/bans', undefined, token))!;

/** An active player the admin can give coins to. */
export interface FoundUser {
  userId: string;
  email: string;
  displayName: string;
  balance: number;
}
export const searchUsers = async (token: string, term: string) =>
  (await request<{ users: FoundUser[]; truncated: boolean }>(
    'GET',
    `/v1/admin/users/search?q=${encodeURIComponent(term)}`,
    undefined,
    token,
  ))!;
/** A positive amount gives coins, a negative one takes them away. */
export const giveCoins = async (token: string, userId: string, amount: number) =>
  (await request<{ userId: string; amount: number; balance: number; version: number }>(
    'POST',
    `/v1/admin/users/${encodeURIComponent(userId)}/coins`,
    { amount },
    token,
  ))!;

/** A message to the player, such as "250 coins have been sent to you by <admin>". */
export interface CoinNotice {
  senderUserId?: string;
  noticeId: string;
  /** Positive when coins were sent, negative when they were removed. */
  amount: number;
  senderDisplayName: string;
  createdAt: string;
}
export const listNotices = async (token: string) =>
  (await request<{ notices: CoinNotice[] }>('GET', '/v1/me/notices', undefined, token))!;
export const dismissNotice = async (token: string, noticeId: string) => {
  await request('POST', `/v1/me/notices/${encodeURIComponent(noticeId)}/dismiss`, undefined, token);
};

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
  /** The admin who started it. The screen shows a blue check next to the name. Absent on older events. */
  announcedBy?: { displayName: string; verified: true };
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

export interface BalanceResponse {
  balance: number;
  /** Changes on every save; send it back so a stale save is rejected. */
  version: number;
}

export const getBalance = async (token: string) =>
  (await request<BalanceResponse>('GET', '/v1/me/balance', undefined, token))!;
export const saveBalance = async (token: string, req: BalanceResponse, options?: RequestOptions) =>
  (await request<BalanceResponse>('PUT', '/v1/me/balance', req, token, options))!;

export interface RankedSpin extends BalanceResponse {
  stops: [number, number, number];
  bet: number;
  returned: number;
}
export const getRankedBalance = async (token: string) =>
  (await request<BalanceResponse>('GET', '/v1/me/ranked-balance', undefined, token))!;
export const spinRankedSlots = async (token: string, spin: { bet: number; spinId: string }) =>
  (await request<RankedSpin>('POST', '/v1/me/slots/spin', spin, token))!;

export type GameResult = 'win' | 'draw' | 'loss';
/** A finished game and/or some seconds of play, for the player's stats. */
export interface StatsReport {
  game: string;
  result?: GameResult;
  seconds?: number;
}
export const recordStats = async (token: string, report: StatsReport) =>
  (await request<{ resultRecorded: boolean; secondsCredited: number }>('POST', '/v1/me/stats', report, token))!;

/** One line of the leaderboard: a player's rank, name and coins. Never an email or account id. */
export interface LeaderboardEntry {
  userId?: string;
  rank: number;
  displayName: string;
  coins: number;
  /** True for admins, who get a blue check next to their name. */
  verified?: boolean;
  /** Wins, draws, losses and play time for the chosen period. Missing from an older server, which has no stats yet. */
  stats?: PlayerStats;
}
export interface PlayerProfileData {
  displayName: string;
  createdAt: string;
  lastSeenAt: string | null;
}

export const getPlayerProfile = async (token: string, userId: string) =>
  (await request<PlayerProfileData>('GET', `/v1/users/${encodeURIComponent(userId)}/profile`, undefined, token))!;

export interface LeaderboardResponse {
  /** The top players, best first. */
  entries: LeaderboardEntry[];
  /** The caller's own place, even outside the top. Absent if the caller is not an approved player. */
  you?: LeaderboardEntry;
  /** How many approved players there are in all. */
  total: number;
}

// ---- The admin's player log, and big wins

/** What a log entry is about. */
export type LogType = 'balance' | 'login' | 'adminCoins' | 'account' | 'event' | 'win';
export interface LogEntry {
  logId: string;
  type: LogType;
  /** When it happened, as an ISO time. */
  createdAt: string;
  /** What the entry says. Which fields there are depends on `type`. */
  details: Record<string, unknown>;
}
/** An account the admin can look at, in any state. */
export interface LogAccount {
  userId: string;
  email: string;
  displayName: string;
  status: 'UNCONFIRMED' | 'PENDING' | 'ACTIVE';
}
export const searchLogAccounts = async (token: string, term: string) =>
  (await request<{ users: LogAccount[]; truncated: boolean }>('GET', `/v1/admin/log/search?q=${encodeURIComponent(term)}`, undefined, token))!;
/** `next` is the marker to pass as `before` to read the page after this one. It is missing on the last page. */
export const getPlayerLog = async (token: string, userId: string, options: { type?: LogType; before?: string } = {}) => {
  const query = new URLSearchParams();
  if (options.type) query.set('type', options.type);
  if (options.before) query.set('before', options.before);
  const suffix = query.toString() ? `?${query}` : '';
  return (await request<{ entries: LogEntry[]; next?: string }>('GET', `/v1/admin/log/${encodeURIComponent(userId)}${suffix}`, undefined, token))!;
};

/** The rare wins that are announced. */
export type WinKind =
  | 'royalFlush'
  | 'straightFlush'
  | 'slotsJackpot'
  | 'rouletteNumber'
  | 'blackjack'
  | 'landlordSpring'
  | 'landlordRocket'
  | 'higherLowerJackpot'
  | 'holdemRoyalFlush'
  | 'holdemStraightFlush'
  | 'ginGin'
  | 'bigWin';
export interface WinReportBody {
  win: WinKind;
  /** The coins won on top of the bet. */
  prize: number;
  bet?: number;
}
/** `announced` is false when the balance did not back the win, or the player announced something a moment ago. */
export const reportWin = async (token: string, body: WinReportBody) =>
  (await request<{ confirmed: boolean; announced: boolean }>('POST', '/v1/me/wins', body, token))!;
export interface WinAnnouncement {
  userId?: string;
  announcementId: string;
  displayName: string;
  verified: boolean;
  win: WinKind;
  prize: number;
  createdAt: string;
}
export const listWinAnnouncements = async (token: string) =>
  (await request<{ announcements: WinAnnouncement[] }>('GET', '/v1/announcements?wallet=ranked', undefined, token))!;

/** Wins, draws, losses and seconds of play in one game. */
export interface GameStats {
  game: string;
  wins: number;
  draws: number;
  losses: number;
  seconds: number;
}
export interface PlayerStats {
  wins: number;
  draws: number;
  losses: number;
  seconds: number;
  /** Only the games that were played, the most played first. */
  games: GameStats[];
}
/** Which days the stats cover: today or this month (both UTC), or everything. */
export type LeaderboardPeriod = 'day' | 'month' | 'all';

export const getLeaderboard = async (token: string, period: LeaderboardPeriod = 'all') =>
  (await request<LeaderboardResponse>('GET', `/v1/leaderboard?period=${period}&wallet=ranked`, undefined, token))!;


export type PrivateBlackjackMode = 'dealer' | 'competitive';
export type PrivateBlackjackAction = 'start' | 'hit' | 'stand' | 'double' | 'split';
type BlackjackCard = { rank: string; suit: import('./cards').Suit };
export type PrivateBlackjackHand = {
  cards: BlackjackCard[];
  result?: 'blackjack' | 'win' | 'push' | 'lose' | 'bust';
};
/** How a room ended. 'refunded' and 'split' return each stake; 'won' and 'forfeit' pay the whole pot to `winner`. */
export type PrivateBlackjackSettlement = { outcome: 'won' | 'split' | 'forfeit' | 'refunded'; winner?: string };
/** The practice-coin stake each player puts in a competitive room: a whole number in this range, or 0 for free play. */
export const MIN_BLACKJACK_STAKE = 10;
export const MAX_BLACKJACK_STAKE = 10_000;
export interface PrivateBlackjackRoom {
  code: string;
  host: string;
  guest?: string;
  mode: PrivateBlackjackMode;
  expiresAt: number;
  /** Practice coins each player put in. 0 for a free room. */
  stake?: number;
  settlement?: PrivateBlackjackSettlement;
  /** While a match is live: the user id of the player who must act, and when the other player may claim the win (milliseconds since 1970). Left out otherwise. */
  awaiting?: string;
  claimableAt?: number;
  version?: number;
  roundNumber?: number;
  scores?: [number, number];
  complete?: boolean;
  round?: {
    dealer: BlackjackCard[];
    players: [PrivateBlackjackHand[], PrivateBlackjackHand[]];
    turn: 0 | 1;
    hand: number;
    over: boolean;
  };
}

const blackjackRoomsPath = '/v1/blackjack/rooms';
const blackjackRoomPath = (code: string) => blackjackRoomsPath + '/' + encodeURIComponent(code);

/** A free room sends no stake. A staked room takes the host's stake from the practice wallet straight away. */
export const createPrivateBlackjackRoom = async (token: string, mode: PrivateBlackjackMode, stake = 0) =>
  (await request<PrivateBlackjackRoom>('POST', blackjackRoomsPath, stake > 0 ? { mode, stake } : { mode }, token))!;

/** What an invite shows before anyone joins. `joined` is true if the caller already holds the guest seat. */
export interface PrivateBlackjackPreview {
  code: string;
  mode: PrivateBlackjackMode;
  /** Practice coins each player puts in. 0 for a free room. */
  stake: number;
  expiresAt: number;
  joined: boolean;
}

/** Looks at an invite without joining or paying. Fails with 404 for a room that cannot be joined. Throttled, so call it on demand. */
export const previewPrivateBlackjackRoom = async (token: string, code: string) =>
  (await request<PrivateBlackjackPreview>('GET', blackjackRoomPath(code) + '/preview', undefined, token))!;

export const joinPrivateBlackjackRoom = async (token: string, code: string) =>
  (await request<PrivateBlackjackRoom>('POST', blackjackRoomPath(code) + '/join', undefined, token))!;

export const getPrivateBlackjackRoom = async (token: string, code: string) =>
  (await request<PrivateBlackjackRoom>('GET', blackjackRoomPath(code), undefined, token))!;

export const playPrivateBlackjack = async (token: string, code: string, version: number, action: PrivateBlackjackAction) =>
  (await request<PrivateBlackjackRoom>('POST', blackjackRoomPath(code) + '/actions', { version, action }, token))!;

/** Before the first round a guest gets their stake back and a host closes the room. Mid-match, leaving forfeits. */
export const leavePrivateBlackjackRoom = async (token: string, code: string) =>
  (await request<PrivateBlackjackRoom>('POST', blackjackRoomPath(code) + '/leave', undefined, token))!;

/** Takes the pot when the other player has been idle on their move for two minutes; earlier, it fails with TOO_EARLY. */
export const claimPrivateBlackjackForfeit = async (token: string, code: string) =>
  (await request<PrivateBlackjackRoom>('POST', blackjackRoomPath(code) + '/claim-forfeit', undefined, token))!;

/** When a TOO_EARLY claim could be made (milliseconds since 1970), or undefined if the error says nothing. */
export const claimableAtOf = (err: unknown): number | undefined =>
  err instanceof ApiError && err.code === 'TOO_EARLY' && typeof err.details?.claimableAt === 'number' ? err.details.claimableAt : undefined;
