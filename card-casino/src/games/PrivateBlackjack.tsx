import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ApiError, createPrivateBlackjackRoom, getPrivateBlackjackRoom, joinPrivateBlackjackRoom, playPrivateBlackjack,
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

function storedCode(key: string) {
  try { return sessionStorage.getItem(key) ?? ''; } catch { return ''; }
}

function rememberCode(key: string, code: string) {
  try {
    if (code) sessionStorage.setItem(key, code);
    else sessionStorage.removeItem(key);
  } catch { /* Manual reconnect remains available when storage is disabled. */ }
}

type Props = { userId: string; token: string; active: boolean; onUnauthorized: () => void };

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

function PrivateBlackjack({ userId, token, active, onUnauthorized }: Props) {
  const { t } = useI18n();
  const key = 'private-blackjack:' + userId;
  const [code, setCode] = useState(() => {
    const saved = storedCode(key);
    return validCode.test(saved) ? saved : '';
  });
  const [invite, setInvite] = useState('');
  const [mode, setMode] = useState<PrivateBlackjackMode>('dealer');
  const [room, setRoom] = useState<PrivateBlackjackRoom>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<MessageKey>();
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

  async function submit(request: () => Promise<PrivateBlackjackRoom>) {
    if (inFlight.current) return;
    inFlight.current = true;
    const current = ++generation.current;
    setBusy(true);
    setMessage(undefined);
    try {
      const next = await request();
      if (generation.current !== current) return;
      rememberCode(key, next.code);
      setCode(next.code);
      setRoom(previous => previous?.code === next.code && (previous.version ?? 0) > (next.version ?? 0) ? previous : next);
    } catch (error) {
      if (generation.current !== current) return;
      if (error instanceof ApiError && error.status === 401) onUnauthorized();
      else if (error instanceof ApiError && error.status === 409) setMessage('privateBlackjack.conflict');
      else if (error instanceof ApiError && error.status === 404) setMessage('privateBlackjack.unavailable');
      else setMessage('privateBlackjack.connection');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function leave() {
    generation.current++;
    rememberCode(key, '');
    setCode('');
    setRoom(undefined);
    setMessage(undefined);
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
      <div className="actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void submit(() => createPrivateBlackjackRoom(token, mode))}>
          {t('privateBlackjack.create')}
        </button>
      </div>
      <form onSubmit={event => {
        event.preventDefault();
        if (validCode.test(normalized)) void submit(() => joinPrivateBlackjackRoom(token, normalized));
      }}>
        <label>{t('privateBlackjack.invite')}
          <input value={invite} onChange={event => setInvite(event.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        <button type="submit" disabled={busy || !validCode.test(normalized)}>{t('privateBlackjack.join')}</button>
      </form>
    </> : <>
      <p>{t('privateBlackjack.invite')} <code>{code}</code></p>
      <button type="button" disabled={busy} onClick={leave}>{t('privateBlackjack.leave')}</button>
      <p role="status">{t(!room ? 'privateBlackjack.reconnecting' : !room.guest ? 'privateBlackjack.waitGuest'
        : room.complete ? 'privateBlackjack.complete' : !round || round.over ? 'privateBlackjack.waitHost'
        : ownHand ? 'privateBlackjack.yourTurn' : 'privateBlackjack.theirTurn')}</p>
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
