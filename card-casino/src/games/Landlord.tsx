import { useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '../wallet';
import { useWinMark } from '../bigWins';
import { shuffle } from '../cards';
import { useDealLock } from '../useDealLock';
import { BetPanel } from '../components/BetPanel';
import { LandlordCardView } from '../components/LandlordCardView';
import { SettingsPanel } from '../components/SettingsPanel';
import { useGameSettings } from '../gameSettings';
import { useI18n, type MessageKey } from '../i18n';
import { botPlay } from './landlordBots';
import { LANDLORD_SETTINGS, landlordOptions } from './landlordSettings';
import { beats, classify, legalBids, newLandlordDeck, type LCard } from './landlordRules';
import { YOU, botStep, giveUp, playerBid, playerPass, playerPlay, redeal, settlementOf, startTable, type Table } from './landlordTable';

/** How long a bot "thinks", so you can follow what it did. */
const BOT_DELAY_MS = 900;
/** How long the "everybody passed" message shows before the cards are dealt again. */
const REDEAL_DELAY_MS = 1500;

const randomSeat = () => Math.floor(Math.random() * 3);
const freshDeck = () => shuffle(newLandlordDeck());
const SEAT_NAMES: MessageKey[] = ['landlord.seat.you', 'landlord.seat.botA', 'landlord.seat.botB'];

export function Landlord() {
  const { balance, wager, settle } = useWallet();
  const { markWin } = useWinMark();
  const { t } = useI18n();
  const { locked, lock } = useDealLock();
  const { values: settingValues, set: setSetting, reset: resetSettings } = useGameSettings(LANDLORD_SETTINGS);

  const [bet, setBet] = useState(10);
  const [table, setTable] = useState<Table | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [groups, setGroups] = useState<number[][]>([]);
  const [hintMessage, setHintMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmingGiveUp, setConfirmingGiveUp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [outcome, setOutcome] = useState<{ won: boolean; gain: number; paid: number; multiplier: number; spring: boolean; gaveUp: boolean } | null>(null);

  // The latest wallet, so the end of a round pays out with the balance as it is then.
  const latest = useRef({ balance, wager, settle, markWin });
  latest.current = { balance, wager, settle, markWin };
  const settled = useRef<Table | null>(null);

  const round = table?.round ?? null;
  const playing = table !== null && table.phase !== 'over';
  const myTurn = table?.phase === 'playing' && round !== null && round.winner === null && round.turn === YOU;
  const myHand: LCard[] = round ? round.hands[YOU] : (table?.hands[YOU] ?? []);

  const nameOf = (seat: number) => t(SEAT_NAMES[seat]);

  function deal() {
    if (balance < bet || !wager(bet)) return;
    lock();
    const options = landlordOptions(settingValues);
    setTable(startTable(bet, options, freshDeck(), randomSeat()));
    setSelected([]);
    setGroups([]);
    setHintMessage('');
    setNotice('');
    setOutcome(null);
    setConfirmingGiveUp(false);
  }

  // The bots take their turns, one step at a time.
  useEffect(() => {
    if (!table) return;
    const botBidding = table.phase === 'bidding' && !table.bidding.done && table.bidding.turn !== YOU;
    const botPlaying = table.phase === 'playing' && round !== null && round.winner === null && round.turn !== YOU;
    if (!botBidding && !botPlaying) return;
    const timer = window.setTimeout(() => setTable((current) => (current ? botStep(current) : current)), BOT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [table, round]);

  // Nobody bid: tell the player, then deal again with the same bet.
  useEffect(() => {
    if (!table || table.phase !== 'bidding' || !table.bidding.redeal) return;
    setNotice(t('landlord.redealt'));
    const timer = window.setTimeout(() => {
      setTable((current) => (current ? redeal(current, freshDeck(), randomSeat()) : current));
    }, REDEAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [table, t]);

  // Pay out once, when the round ends.
  useEffect(() => {
    if (!table || table.phase !== 'over' || !table.round || settled.current === table) return;
    settled.current = table;
    const now = latest.current;
    const result = settlementOf(table, now.balance);
    const r = table.round;
    const spring = result.won && r.forfeitedBy === null && result.multiplier !== r.bid * 2 ** r.doublings;
    if (result.won) {
      if (table.youPlayedRocket) now.markWin('landlordRocket');
      else if (spring) now.markWin('landlordSpring');
      now.settle(result.returned);
    } else {
      if (result.extra > 0) now.wager(result.extra);
      now.settle(0);
    }
    setOutcome({
      won: result.won,
      gain: result.returned - table.bet,
      paid: table.bet + (result.won ? 0 : result.extra),
      multiplier: result.multiplier,
      spring,
      gaveUp: r.forfeitedBy !== null,
    });
  }, [table]);

  // ---- Your hand: selecting and grouping

  const handById = useMemo(() => new Map(myHand.map((c) => [c.id, c])), [myHand]);
  const liveGroups = useMemo(
    () => groups.map((g) => g.filter((id) => handById.has(id))).filter((g) => g.length >= 2),
    [groups, handById],
  );
  const grouped = new Set(liveGroups.flat());
  const ungrouped = myHand.filter((c) => !grouped.has(c.id));
  const comboName = (ids: number[]) => {
    const combo = table ? classify(ids.map((id) => handById.get(id)!).filter(Boolean), table.options) : null;
    return combo ? t(`landlord.combo.${combo.kind}` as MessageKey) : '';
  };

  function toggle(card: LCard) {
    const group = liveGroups.find((g) => g.includes(card.id));
    const ids = group ?? [card.id];
    setHintMessage('');
    setSelected((current) => {
      const all = ids.every((id) => current.includes(id));
      return all ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])];
    });
  }

  const selectedCards = selected.map((id) => handById.get(id)).filter((c): c is LCard => c !== undefined);
  const selectedCombo = table && selectedCards.length > 0 ? classify(selectedCards, table.options) : null;
  const canPlay = myTurn && selectedCombo !== null && (round!.last === null || beats(selectedCombo, round!.last.combo));
  const touchesGroup = selected.some((id) => grouped.has(id));

  function groupSelected() {
    if (selected.length < 2) return;
    setGroups([...liveGroups.map((g) => g.filter((id) => !selected.includes(id))).filter((g) => g.length >= 2), [...selected]]);
    setSelected([]);
  }
  function ungroupSelected() {
    setGroups(liveGroups.filter((g) => !g.some((id) => selected.includes(id))));
    setSelected([]);
  }

  function playSelected() {
    if (!table || !canPlay) return;
    setTable(playerPlay(table, selectedCards));
    setSelected([]);
    setHintMessage('');
  }
  function passTurn() {
    if (!table) return;
    setTable(playerPass(table));
    setSelected([]);
    setHintMessage('');
  }
  function hint() {
    if (!round || !myTurn) return;
    const cards = botPlay(round, YOU);
    if (cards) {
      setSelected(cards.map((c) => c.id));
      setHintMessage('');
    } else {
      setSelected([]);
      setHintMessage(t('landlord.noHint'));
    }
  }

  // ---- What the screen says

  const bidding = table?.phase === 'bidding' ? table.bidding : null;
  const botName = (seat: number) => nameOf(seat);
  const multiplierNow = round ? round.bid * 2 ** round.doublings : 0;
  const passers = round?.last ? Array.from({ length: round.passes }, (_, i) => (round.last!.seat + 1 + i) % 3) : [];
  const roleOf = (seat: number) => (round ? t(seat === round.landlord ? 'landlord.role.landlord' : 'landlord.role.peasant') : '');
  const count = (n: number) => t(n === 1 ? 'count.cardOne' : 'count.cardMany', { count: n });

  let status = '';
  if (bidding) status = bidding.turn === YOU && !bidding.done ? t('landlord.bidPrompt') : t('landlord.thinking', { who: botName(bidding.turn) });
  else if (table?.phase === 'playing' && round) {
    if (myTurn) status = round.last ? t('landlord.yourTurnBeat') : t('landlord.yourTurnLead');
    else status = t('landlord.thinking', { who: botName(round.turn) });
  } else if (table?.phase === 'over' && outcome) {
    const money = outcome.won ? t('game.gain', { amount: outcome.gain }) : t('game.loss', { amount: outcome.paid });
    status = t(outcome.won ? 'landlord.youWin' : 'landlord.youLose', { money, multiplier: outcome.multiplier });
    if (outcome.spring) status += ' ' + t('landlord.spring');
    if (outcome.gaveUp) status += ' ' + t('landlord.gaveUp');
  }

  const bidsSoFar = bidding?.bids.flatMap((b, seat) => (b === null ? [] : [t('landlord.bidLine', { who: nameOf(seat), bid: b === 0 ? t('landlord.passBid') : String(b) })])) ?? [];

  const renderCard = (c: LCard) => <LandlordCardView key={c.id} card={c} selected={selected.includes(c.id)} onClick={() => toggle(c)} />;

  return (
    <section className="table landlord">
      {table && (
        <div className="landlord-seats">
          {[1, 2].map((seat) => (
            <div key={seat} className="landlord-seat">
              <strong>{nameOf(seat)}</strong>
              {round && <small> {roleOf(seat)} </small>}
              <span className="count">{count((round ? round.hands[seat] : table.hands[seat]).length)}</span>
              {passers.includes(seat) && <em> {t('landlord.passed')}</em>}
            </div>
          ))}
        </div>
      )}

      {round && (
        <>
          <p className="hint">
            {t(round.landlord === YOU ? 'landlord.youAreLandlord' : 'landlord.youArePeasant', { landlord: nameOf(round.landlord) })}
          </p>
          <p className="hint">{t('landlord.multiplier', { value: multiplierNow })}</p>
          <div role="group" aria-label={t('landlord.bottom')} className="cards landlord-bottom">
            {table!.bottom.map((c) => (
              <LandlordCardView key={c.id} card={c} />
            ))}
          </div>
          <div role="region" aria-label={t('landlord.lastPlay')} className="last-play">
            {round.last ? (
              <>
                <span>{t('landlord.played', { who: nameOf(round.last.seat) })}</span>
                <div className="cards">
                  {round.last.cards.map((c) => (
                    <LandlordCardView key={c.id} card={c} />
                  ))}
                </div>
              </>
            ) : (
              <span>{t('landlord.noPlay')}</span>
            )}
          </div>
        </>
      )}

      <p className="result" role="status">
        {status}
      </p>
      {bidsSoFar.length > 0 && <p className="hint">{bidsSoFar.join(' · ')}</p>}
      {notice && <p className="hint">{notice}</p>}
      {hintMessage && <p className="hint">{hintMessage}</p>}

      {table && (
        <div className="hand">
          <h3>{t('landlord.yourHand')}</h3>
          <div className="cards landlord-hand" role="group" aria-label={t('landlord.yourHand')}>
            {liveGroups.map((g) => {
              const name = comboName(g);
              return (
                <div
                  key={g.join('-')}
                  className="card-group"
                  role="group"
                  aria-label={name ? t('landlord.groupAriaCombo', { combo: name }) : t('landlord.groupAria')}
                >
                  {name && <small>{name}</small>}
                  <div className="cards">{g.map((id) => renderCard(handById.get(id)!))}</div>
                </div>
              );
            })}
            {ungrouped.map(renderCard)}
          </div>
        </div>
      )}

      <div className="actions">
        {bidding && !bidding.done && bidding.turn === YOU && (
          <>
            {legalBids(bidding)
              .filter((b) => b > 0)
              .map((b) => (
                <button key={b} className="primary" disabled={locked} onClick={() => setTable(playerBid(table!, b))}>
                  {t('landlord.bid', { amount: b })}
                </button>
              ))}
            <button disabled={locked} onClick={() => setTable(playerBid(table!, 0))}>
              {t('landlord.passBid')}
            </button>
          </>
        )}
        {table?.phase === 'playing' && (
          <>
            <button className="primary" disabled={!canPlay} onClick={playSelected}>
              {t('landlord.play')}
            </button>
            <button disabled={!myTurn || round?.last === null} onClick={passTurn}>
              {t('landlord.pass')}
            </button>
            <button disabled={!myTurn} onClick={hint}>
              {t('landlord.hint')}
            </button>
            <button disabled={selected.length < 2} onClick={groupSelected}>
              {t('landlord.group')}
            </button>
            <button disabled={!touchesGroup} onClick={ungroupSelected}>
              {t('landlord.ungroup')}
            </button>
          </>
        )}
        {(!table || table.phase === 'over') && (
          <button className="primary" onClick={deal} disabled={balance < bet}>
            {table ? t('game.dealAgain') : t('game.deal')}
          </button>
        )}
      </div>

      {table?.phase === 'playing' && !confirmingGiveUp && (
        <div className="actions">
          <button onClick={() => setConfirmingGiveUp(true)}>{t('landlord.giveUp')}</button>
        </div>
      )}
      {table?.phase === 'playing' && confirmingGiveUp && (
        <div className="actions" role="group" aria-label={t('landlord.giveUpGroup')}>
          <span>{t('landlord.giveUpAsk', { bet: table.bet })}</span>
          <button
            onClick={() => {
              setTable(giveUp(table));
              setConfirmingGiveUp(false);
            }}
          >
            {t('landlord.yesGiveUp')}
          </button>
          <button onClick={() => setConfirmingGiveUp(false)}>{t('landlord.keepPlaying')}</button>
        </div>
      )}

      <div className="actions">
        <button aria-expanded={showSettings} onClick={() => setShowSettings((s) => !s)}>
          {t(showSettings ? 'settings.hide' : 'settings.show')}
        </button>
      </div>
      {showSettings && <SettingsPanel schema={LANDLORD_SETTINGS} values={settingValues} onChange={setSetting} onReset={resetSettings} />}

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={playing} />
      <p className="hint">{t('landlord.payHint')}</p>
    </section>
  );
}
