import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ApiError, claimableAtOf, claimPrivateBlackjackForfeit, createPrivateBlackjackRoom, getPrivateBlackjackRoom, joinPrivateBlackjackRoom,
  leavePrivateBlackjackRoom, MAX_BLACKJACK_STAKE, MIN_BLACKJACK_STAKE, playPrivateBlackjack,
  type PrivateBlackjackAction, type PrivateBlackjackHand, type PrivateBlackjackMode, type PrivateBlackjackRoom,
} from '../api';
import { CardView } from '../components/CardView';
import { useI18n, type MessageKey } from '../i18n';

const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const validCode = /^[0-9a-f]{32}$/;
const actionLabels: Record<Exclude<PrivateBlackjackAction, 'start'>, MessageKey> = {
  hit: 'blackjack.hit', stand: 'blackjack.stand', double: 'blackjack.double', split: 'privateBlackjack.split',
};
const outcomeLabels: Record<NonNullable<PrivateBlackjackHand['result']>, MessageKey> = {
  blackjack: 'blackjack.blackjack', win: 'blackjack.win', push: 'blackjack.push', lose: 'blackjack.lose', bust: 'blackjack.bust',
};

/** The stakes on offer. Each one needs the coins in the practice wallet, and the server checks the range again. */
const STAKES = [0, 10, 50, 100, 500, 1000, 5000].filter(s => s === 0 || (s >= MIN_BLACKJACK_STAKE && s <= MAX_BLACKJACK_STAKE));

/** A wait in milliseconds, written as minutes and seconds (m:ss) for the claim countdown. */
const countdown = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
};

function storedCode(key: string) {
  try { return sessionStorage.getItem(key) ?? ''; } catch { return ''; }
}

function rememberCode(key: string, code: string) {
  try {
    if (code) sessionStorage.setItem(key, code);
    else sessionStorage.removeItem(key);
  } catch { /* Manual reconnect remains available when storage is disabled. */ }
}

type Props = {
  userId: string; token: string; active: boolean; onUnauthorized: () => void;
  /** The practice balance. A stake is taken from it, so only stakes it can cover are offered. */
  balance: number;
  /** Saves any pending balance change, so a stake is taken from the balance the server already has. */
  flushBalance: () => Promise<void>;
  /** Loads the practice balance again, after a stake was taken or a match settled. */
  reloadBalance: () => Promise<void>;
};

export function BlackjackModes({ children, ...props }: Props & { children: ReactNode }) {
  const { t } = useI18n();
  const [privateMode, setPrivateMode] = useState(() => validCode.test(storedCode('private-blackjack:' + props.userId)));
  return <>
    <div className="actions private-blackjack-modes">
      <button type="button" aria-pressed={!privateMode} onClick={() => setPrivateMode(false)}>{t('privateBlackjack.practice')}</button>
      <button type="button" aria-pressed={privateMode} onClick={() => setPrivateMode(true)}>{t('privateBlackjack.title')}</button>
    </div>
    <div hidden={privateMode}>{children}</div>
    {privateMode && <PrivateBlackjack {...props} />}
  </>;
}

function PrivateBlackjack({ userId, token, active, onUnauthorized, balance, flushBalance, reloadBalance }: Props) {
  const { t } = useI18n();
  const key = 'private-blackjack:' + userId;
  const [code, setCode] = useState(() => {
    const saved = storedCode(key);
    return validCode.test(saved) ? saved : '';
  });
  const [invite, setInvite] = useState('');
  const [mode, setMode] = useState<PrivateBlackjackMode>('dealer');
  const [stake, setStake] = useState(0);
  const [room, setRoom] = useState<PrivateBlackjackRoom>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<MessageKey>();
  // Leaving mid-match forfeits it, so the first press only asks.
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  // When the server will accept a claim (milliseconds since 1970), learned from a claim that came too early.
  const [claimableAt, setClaimableAt] = useState<number>();
  const [now, setNow] = useState(() => Date.now());
  // The settlement we already reloaded the balance for, so it happens once per match.
  const settledSeen = useRef('');
  // Leaving invalidates an in-flight poll or action even if the same room is then rejoined.
  const generation = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!active || !code) return;
    let cancelled = false;
    async function refresh() {
      if (cancelled || inFlight.current) return;
      const version = generation.current;
      try {
        const latest = await getPrivateBlackjackRoom(token, code);
        if (cancelled || version !== generation.current || inFlight.current) return;
        setRoom(previous => (previous?.version ?? -1) > (latest.version ?? 0) ? previous : latest);
        setMessage(previous => previous === 'privateBlackjack.connection' ? undefined : previous);
      } catch (error) {
        if (cancelled || version !== generation.current || inFlight.current) return;
        if (error instanceof ApiError && error.status === 401) {
          onUnauthorized();
        } else if (error instanceof ApiError && error.status === 404) {
          rememberCode(key, '');
          setRoom(undefined);
          setCode('');
          setMessage('privateBlackjack.unavailable');
        } else {
          setMessage('privateBlackjack.connection');
        }
      }
    }
    let timeout: number | undefined;
    async function poll() {
      await refresh();
      if (!cancelled) timeout = window.setTimeout(() => { void poll(); }, 2500);
    }
    void poll();
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [active, code, key, onUnauthorized, token]);

  // The server pays out or refunds the stakes when a match settles, so load the practice balance again, once.
  useEffect(() => {
    if (!room?.settlement) return;
    const seen = room.code + ':' + room.settlement.outcome;
    if (settledSeen.current === seen) return;
    settledSeen.current = seen;
    if ((room.stake ?? 0) > 0) void reloadBalance();
  }, [room?.code, room?.settlement, room?.stake, reloadBalance]);

  // A claim that came too early only holds for the move it was made on: forget it when the room moves on.
  useEffect(() => {
    setClaimableAt(undefined);
    setConfirmingLeave(false);
  }, [code, room?.version]);

  useEffect(() => {
    if (claimableAt === undefined || claimableAt <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [claimableAt]);

  /**
   * Sends one request about the room. `coins` is for requests that take a stake out of the practice wallet or
   * give it back: any pending balance change is saved first, and the balance is loaded again afterwards.
   */
  async function submit(request: () => Promise<PrivateBlackjackRoom>, options: { coins?: boolean; closes?: boolean } = {}) {
    if (inFlight.current) return;
    inFlight.current = true;
    const current = ++generation.current;
    setBusy(true);
    setMessage(undefined);
    try {
      if (options.coins) await flushBalance().catch(() => undefined);
      const next = await request();
      if (generation.current !== current) return;
      if (options.coins && (next.stake ?? 0) > 0) void reloadBalance();
      if (options.closes) {
        // Leaving worked: back to the lobby.
        rememberCode(key, '');
        setCode('');
        setRoom(undefined);
        return;
      }
      rememberCode(key, next.code);
      setCode(next.code);
      setRoom(previous => previous?.code === next.code && (previous.version ?? 0) > (next.version ?? 0) ? previous : next);
    } catch (error) {
      if (generation.current !== current) return;
      const tooEarly = claimableAtOf(error);
      if (error instanceof ApiError && error.status === 401) onUnauthorized();
      else if (tooEarly !== undefined) {
        // Not an error to show: the claim button counts down to the moment it will work.
        setClaimableAt(tooEarly);
        setNow(Date.now());
      } else if (error instanceof ApiError && error.code === 'NOT_ENOUGH_COINS') setMessage('privateBlackjack.notEnough');
      else if (error instanceof ApiError && error.code === 'VALIDATION_ERROR' && error.fields?.stake) setMessage('privateBlackjack.badStake');
      else if (error instanceof ApiError && error.status === 409) setMessage('privateBlackjack.conflict');
      else if (error instanceof ApiError && error.status === 404) setMessage('privateBlackjack.unavailable');
      else setMessage('privateBlackjack.connection');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  /** Back to the lobby without telling the server: for a room that is over, or one we could not load. */
  function backToLobby() {
    generation.current++;
    rememberCode(key, '');
    setCode('');
    setRoom(undefined);
    setMessage(undefined);
    setConfirmingLeave(false);
  }

  const matchOn = !!room?.round && !room.complete && !room.settlement;
  function leave() {
    if (!room || room.complete || room.settlement) return backToLobby();
    // Mid-match, leaving forfeits it, and the other player takes the pot: ask first.
    if (matchOn && !confirmingLeave) return setConfirmingLeave(true);
    void submit(() => leavePrivateBlackjackRoom(token, code), { coins: true, closes: true });
  }

  const play = (action: PrivateBlackjackAction) => {
    if (room) void submit(() => playPrivateBlackjack(token, code, room.version ?? 0, action));
  };
  const normalized = invite.trim().toLowerCase();
  const round = room?.round;
  const isHost = room?.host === userId;
  const seat = isHost ? 0 : 1;
  const ownHand = round?.turn === seat && !round.over ? round.players[seat][round.hand] : undefined;
  const canSplit = ownHand?.cards.length === 2 && ownHand.cards[0].rank === ownHand.cards[1].rank && round!.players[seat].length < 4;
  // The other player holds the move: it is their turn, or between rounds when the host must deal (and we are the guest).
  const opponentToMove = matchOn && !!room?.guest && room.mode === 'competitive' && (round!.over ? !isHost : round!.turn !== seat);
  const claimWait = claimableAt === undefined ? 0 : Math.max(0, claimableAt - now);
  const roomStake = room?.stake ?? 0;
  const settlement = room?.settlement;
  const settlementText: MessageKey | undefined = !settlement ? undefined
    : settlement.outcome === 'split' ? 'privateBlackjack.settle.split'
    : settlement.outcome === 'refunded' ? 'privateBlackjack.settle.refunded'
    : settlement.winner === userId ? (settlement.outcome === 'forfeit' ? 'privateBlackjack.settle.forfeitWon' : 'privateBlackjack.settle.won')
    : (settlement.outcome === 'forfeit' ? 'privateBlackjack.settle.forfeitLost' : 'privateBlackjack.settle.lost');
  const coinsText: MessageKey | undefined = !settlement || roomStake === 0 ? undefined
    : settlement.winner === undefined ? 'privateBlackjack.coins.returned'
    : settlement.winner === userId ? 'privateBlackjack.coins.won' : 'privateBlackjack.coins.lost';
  const cards = (hand: PrivateBlackjackHand['cards']) => hand.map((card, i) =>
    <CardView key={i} card={{ suit: card.suit, rank: ranks.indexOf(card.rank) + 1 }} />);

  return <section className="table private-blackjack" aria-label={t('privateBlackjack.title')}>
    {message && <p role="status">{t(message)}</p>}
    {!code ? <>
      <label>
        {t('privateBlackjack.mode')}
        <select value={mode} disabled={busy} onChange={event => setMode(event.target.value as PrivateBlackjackMode)}>
          <option value="dealer">{t('privateBlackjack.dealerMode')}</option>
          <option value="competitive">{t('privateBlackjack.competitiveMode')}</option>
        </select>
      </label>
      {mode === 'competitive' && <>
        <label>
          {t('privateBlackjack.stake')}
          <select value={stake} disabled={busy} onChange={event => setStake(Number(event.target.value))}>
            {STAKES.map(amount => (
              <option key={amount} value={amount} disabled={amount > balance}>
                {amount === 0 ? t('privateBlackjack.stakeFree') : t('privateBlackjack.stakeCoins', { stake: amount })}
              </option>
            ))}
          </select>
        </label>
        <p className="private-blackjack-note">{t('privateBlackjack.stakeHelp')}</p>
      </>}
      <div className="actions">
        <button type="button" className="primary" disabled={busy || (mode === 'competitive' && stake > balance)}
          onClick={() => {
            const staked = mode === 'competitive' ? stake : 0;
            void submit(() => createPrivateBlackjackRoom(token, mode, staked), { coins: staked > 0 });
          }}>
          {t('privateBlackjack.create')}
        </button>
      </div>
      <form onSubmit={event => {
        event.preventDefault();
        if (validCode.test(normalized)) void submit(() => joinPrivateBlackjackRoom(token, normalized), { coins: true });
      }}>
        <label>{t('privateBlackjack.invite')}
          <input value={invite} onChange={event => setInvite(event.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        <p className="private-blackjack-note">{t('privateBlackjack.joinStakeNote')}</p>
        <button type="submit" disabled={busy || !validCode.test(normalized)}>{t('privateBlackjack.join')}</button>
      </form>
    </> : <>
      <p>{t('privateBlackjack.invite')} <code>{code}</code></p>
      {roomStake > 0 && <p>{t('privateBlackjack.stakeLine', { stake: roomStake, pot: roomStake * 2 })}</p>}
      {confirmingLeave ? <div className="private-blackjack-warning" role="alert">
        <p>{t(roomStake > 0 ? 'privateBlackjack.leaveWarning' : 'privateBlackjack.leaveWarningFree')}</p>
        <div className="actions">
          <button type="button" disabled={busy} onClick={leave}>{t('privateBlackjack.leaveConfirm')}</button>
          <button type="button" className="primary" disabled={busy} onClick={() => setConfirmingLeave(false)}>{t('privateBlackjack.stay')}</button>
        </div>
      </div> : <button type="button" disabled={busy} onClick={leave}>
        {t(room && !room.complete && !room.settlement ? 'privateBlackjack.leaveRoom' : 'privateBlackjack.leave')}
      </button>}
      <p role="status">{t(!room ? 'privateBlackjack.reconnecting' : room.complete || room.settlement ? 'privateBlackjack.complete'
        : !room.guest ? 'privateBlackjack.waitGuest' : !round || round.over ? 'privateBlackjack.waitHost'
        : ownHand ? 'privateBlackjack.yourTurn' : 'privateBlackjack.theirTurn')}</p>
      {settlementText && <p role="status" className="private-blackjack-settlement">
        {t(settlementText)}{coinsText && ' ' + t(coinsText, { stake: roomStake, pot: roomStake * 2 })}
      </p>}
      {opponentToMove && <div className="private-blackjack-claim">
        <button type="button" disabled={busy || claimWait > 0} onClick={() => void submit(() => claimPrivateBlackjackForfeit(token, code))}>
          {t('privateBlackjack.claim')}
        </button>
        <p>{claimWait > 0 ? t('privateBlackjack.claimWait', { time: countdown(claimWait) }) : t('privateBlackjack.claimHint')}</p>
      </div>}
      {room && room.mode === 'competitive' && room.scores && <p>
        {t('privateBlackjack.score', { round: room.roundNumber ?? 0, you: room.scores[seat], opponent: room.scores[1 - seat] })}
      </p>}
      {round && <>
        <div className="hand"><h3>{t('blackjack.dealer')}</h3>
          <div className="cards">{cards(round.dealer)}{!round.over && <CardView faceDown />}</div>
        </div>
        {([seat, 1 - seat] as const).map((player) => (
          <div key={player} className="hand">
            <h3>{t(player === seat ? 'blackjack.you' : 'privateBlackjack.opponent')}</h3>
            {round.players[player].map((hand, index) => (
              <div key={index} className="private-blackjack-hand" aria-current={!round.over && round.turn === player && round.hand === index ? 'true' : undefined}>
                <div className="cards">{cards(hand.cards)}</div>
                {hand.result && <p>{t(outcomeLabels[hand.result])}</p>}
              </div>
            ))}
          </div>
        ))}
      </>}
      <div className="actions">
        {room?.guest && isHost && !room.complete && (!round || round.over) &&
          <button type="button" className="primary" disabled={busy} onClick={() => play('start')}>{t('privateBlackjack.start')}</button>}
        {ownHand && (Object.keys(actionLabels) as (keyof typeof actionLabels)[]).map(action => (
          <button key={action} type="button" onClick={() => play(action)}
            disabled={busy || (action === 'double' && ownHand.cards.length !== 2) || (action === 'split' && !canSplit)}>
            {t(actionLabels[action])}
          </button>
        ))}
      </div>
    </>}
  </section>;
}
