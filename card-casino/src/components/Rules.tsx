import type { ReactNode } from 'react';
import { GameNav, type NavGame } from './GameNav';
import { HAND_SIZE, WIN_PAYOUT } from '../games/crazyEightsRules';
import { PAYTABLE } from '../games/videoPokerRules';
import { JACKPOT_MULTIPLIER, POT_MULTIPLIER } from '../games/higherLowerRules';
import { SPREAD_PAYOUTS, THREE_OF_A_KIND_PAYOUT, WIDE_SPREAD_PAYOUT } from '../games/redDogRules';
import { BANKER_PAYOUT_PERCENT, PLAYER_PAYOUT, TIE_PAYOUT } from '../games/baccaratRules';

/** A small card for diagrams. `back` draws a face-down card. */
function MiniCard({ x, y, label, red, back }: { x: number; y: number; label?: string; red?: boolean; back?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="38" height="54" rx="5" fill={back ? '#1e3a8a' : '#fff'} stroke="#0f172a" strokeWidth="1.5" />
      {back ? (
        <rect x="5" y="5" width="28" height="44" rx="3" fill="none" stroke="#93c5fd" strokeWidth="1.5" />
      ) : (
        <text x="19" y="34" textAnchor="middle" fontSize="17" fontWeight="700" fill={red ? '#dc2626' : '#0f172a'}>
          {label}
        </text>
      )}
    </g>
  );
}

const Note = ({ x, y, children, anchor = 'middle' }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end' }) => (
  <text x={x} y={y} textAnchor={anchor} fontSize="12" fill="#f8fafc">
    {children}
  </text>
);

function BlackjackDiagram() {
  return (
    <svg viewBox="0 0 420 150" role="img" aria-label="A hand of King and 7 totals 17; dealer draws to 17">
      <Note x={10} y={16} anchor="start">Your hand</Note>
      <MiniCard x={10} y={26} label="K♠" />
      <MiniCard x={54} y={26} label="7♥" red />
      <Note x={72} y={102}>10 + 7 = 17</Note>
      <text x="170" y="62" fontSize="22" fill="#f5c542">vs</text>
      <Note x={230} y={16} anchor="start">Dealer</Note>
      <MiniCard x={230} y={26} label="6♦" red />
      <MiniCard x={274} y={26} back />
      <Note x={300} y={102}>Draws until 17+</Note>
      <Note x={210} y={138}>Closest to 21 without going over wins</Note>
    </svg>
  );
}

function KlondikeDiagram() {
  return (
    <svg viewBox="0 0 420 190" role="img" aria-label="Klondike layout: stock, waste, four foundations, seven tableau columns">
      <MiniCard x={10} y={10} back />
      <MiniCard x={56} y={10} label="9♣" />
      <Note x={10} y={78} anchor="start">Stock → Waste</Note>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={196 + i * 46} y={10} width="38" height="54" rx="5" fill="none" stroke="#f5c542" strokeDasharray="4 3" strokeWidth="1.5" />
          <text x={215 + i * 46} y={43} textAnchor="middle" fontSize="16" fill="#f5c542">A</text>
        </g>
      ))}
      <Note x={196} y={78} anchor="start">Foundations: A → K by suit</Note>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <g key={i}>
          {Array.from({ length: i + 1 }).map((_, j) => (
            <rect key={j} x={10 + i * 56} y={100 + j * 7} width="38" height="40" rx="4"
              fill={j === i ? '#fff' : '#1e3a8a'} stroke="#0f172a" strokeWidth="1.2" />
          ))}
        </g>
      ))}
      <Note x={210} y={182}>Tableau: stack alternating colours, descending (red 8 on black 9)</Note>
    </svg>
  );
}

function PokerDiagram() {
  const hand = ['A♠', 'A♥', '7♣', '2♦', 'K♠'];
  return (
    <svg viewBox="0 0 420 120" role="img" aria-label="Five cards; hold two aces and draw three replacements">
      {hand.map((c, i) => (
        <g key={c}>
          <MiniCard x={10 + i * 80} y={22} label={c} red={c.includes('♥') || c.includes('♦')} />
          <Note x={29 + i * 80} y={16}>{i < 2 ? 'HOLD' : ''}</Note>
          <Note x={29 + i * 80} y={96}>{i < 2 ? '' : 'replaced'}</Note>
        </g>
      ))}
      <Note x={210} y={114}>Hold the cards you want, then draw to replace the rest</Note>
    </svg>
  );
}

function HigherLowerDiagram() {
  return (
    <svg viewBox="0 0 420 130" role="img" aria-label="A 7 is showing; the next card is higher, lower or the same rank">
      <MiniCard x={20} y={20} label="7♠" />
      <Note x={39} y={90}>Showing</Note>
      <line x1="80" y1="47" x2="150" y2="47" stroke="#f5c542" strokeWidth="2" />
      <polygon points="150,41 162,47 150,53" fill="#f5c542" />
      <MiniCard x={180} y={20} label="?" />
      <Note x={199} y={90}>Next card</Note>
      <Note x={300} y={32} anchor="start">Higher: 8 – A</Note>
      <Note x={300} y={52} anchor="start">Lower: 2 – 6</Note>
      <Note x={300} y={72} anchor="start">Same rank: jackpot ×{JACKPOT_MULTIPLIER}</Note>
      <Note x={210} y={120}>Aces are high. A tie on higher/lower loses.</Note>
    </svg>
  );
}

function RedDogDiagram() {
  return (
    <svg viewBox="0 0 420 130" role="img" aria-label="A 4 and a 9 are dealt; the third card wins if it is a 5, 6, 7 or 8">
      <MiniCard x={20} y={20} label="4♣" />
      <rect x="82" y="20" width="38" height="54" rx="5" fill="none" stroke="#f5c542" strokeDasharray="4 3" strokeWidth="1.5" />
      <text x="101" y="53" textAnchor="middle" fontSize="18" fill="#f5c542">?</text>
      <MiniCard x={142} y={20} label="9♥" red />
      <Note x={39} y={90}>Low</Note>
      <Note x={101} y={90}>Third card</Note>
      <Note x={161} y={90}>High</Note>
      <Note x={230} y={36} anchor="start">Wins on 5, 6, 7 or 8</Note>
      <Note x={230} y={56} anchor="start">4 cards in between = pays 1 to 1</Note>
      <Note x={210} y={120}>Landing on the 4 or the 9 loses. Aces are high.</Note>
    </svg>
  );
}

function BaccaratDiagram() {
  return (
    <svg viewBox="0 0 420 150" role="img" aria-label="Player holds 7 and 8, totalling 5; Banker holds 4 and 5, totalling 9; Banker wins">
      <Note x={10} y={16} anchor="start">Player</Note>
      <MiniCard x={10} y={24} label="7♠" />
      <MiniCard x={54} y={24} label="8♥" red />
      <Note x={72} y={100}>7 + 8 = 15 → 5</Note>
      <Note x={230} y={16} anchor="start">Banker</Note>
      <MiniCard x={230} y={24} label="4♣" />
      <MiniCard x={274} y={24} label="5♦" red />
      <Note x={292} y={100}>4 + 5 = 9 → 9</Note>
      <Note x={210} y={126}>Only the last digit counts. Closest to 9 wins, so Banker wins here.</Note>
      <Note x={210} y={144}>J, Q, K and 10 are worth 0. Aces are 1.</Note>
    </svg>
  );
}

function CrazyEightsDiagram() {
  return (
    <svg viewBox="0 0 420 170" role="img" aria-label="The top card is 7 of hearts. A 7 of spades matches by rank, a king of hearts by suit, an 8 is wild, and a 3 of diamonds cannot be played">
      <Note x={10} y={16} anchor="start">Top of the pile</Note>
      <MiniCard x={10} y={24} label="7♥" red />
      <Note x={150} y={16} anchor="start">Your hand</Note>
      <MiniCard x={150} y={24} label="7♠" />
      <MiniCard x={198} y={24} label="K♥" red />
      <MiniCard x={246} y={24} label="8♣" />
      <g opacity="0.45">
        <MiniCard x={294} y={24} label="3♦" red />
      </g>
      <Note x={169} y={96}>same rank</Note>
      <Note x={217} y={96}>same suit</Note>
      <Note x={265} y={96}>wild!</Note>
      <Note x={313} y={96}>no match</Note>
      <Note x={210} y={128}>Play a card that matches the suit or the number of the top card.</Note>
      <Note x={210} y={148}>An 8 matches anything, and you choose the suit that comes next.</Note>
      <Note x={210} y={166}>Can't play? Draw until you can.</Note>
    </svg>
  );
}

function Section({ title, diagram, children }: { title: string; diagram: ReactNode; children: ReactNode }) {
  return (
    <section className="rules-section">
      <h2>{title}</h2>
      <div className="rules-diagram">{diagram}</div>
      {children}
    </section>
  );
}

interface RulesProps {
  games: NavGame[];
  gameId: string;
  onSelect: (id: string) => void;
}

/** One rules page per game, keyed by the game's id in App.tsx. Add an entry here when you add a game. */
export function Rules({ games, gameId, onSelect }: RulesProps) {
  const pages: Record<string, ReactNode> = {
    blackjack: (
      <Section title="Blackjack" diagram={<BlackjackDiagram />}>
        <h3>How to play</h3>
        <ul>
          <li>Number cards count face value, J/Q/K count 10, and an Ace is 11 or 1.</li>
          <li><b>Hit</b> to take a card, <b>Stand</b> to keep your hand, <b>Double</b> to take one card and double your bet.</li>
          <li>Go over 21 and you bust. The dealer draws to 17 and stands on every 17.</li>
          <li>A natural blackjack pays 3 to 2.</li>
        </ul>
        <h3>Tips</h3>
        <ul>
          <li>Stand on 17 or more. Hit on 11 or less.</li>
          <li>Double on 10 or 11 when the dealer shows a weak card (2–6).</li>
          <li>If the dealer shows 2–6 they bust often, so stand on 12–16.</li>
        </ul>
      </Section>
    ),

    klondike: (
      <Section title="Klondike Solitaire" diagram={<KlondikeDiagram />}>
        <h3>How to play</h3>
        <ul>
          <li>Your bet is taken when you deal. Move all 52 cards onto the four foundations to win 2× your bet.</li>
          <li>Build foundations up by suit from Ace to King.</li>
          <li>On the tableau, build down in alternating colours. Only a King can fill an empty column.</li>
          <li>Click the stock to turn one card. You can go through the stock three times.</li>
          <li>Giving up, or running out of moves, loses your bet.</li>
        </ul>
        <h3>Tips</h3>
        <ul>
          <li>Prioritise moves that flip face-down cards.</li>
          <li>Don't rush Aces and 2s up if you might need them as tableau targets.</li>
          <li>Empty a column only when you have a King ready to place.</li>
        </ul>
      </Section>
    ),

    'video-poker': (
      <Section title="Jacks or Better" diagram={<PokerDiagram />}>
        <h3>How to play</h3>
        <ul>
          <li>Place a bet to get five cards. Choose which to <b>hold</b>, then draw to replace the rest.</li>
          <li>Any pair of Jacks or higher, or better, pays. Payouts are multiples of your bet:</li>
        </ul>
        <table className="paytable">
          <tbody>
            {PAYTABLE.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{r.multiplier}×</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Tips</h3>
        <ul>
          <li>Always keep a made hand of a straight or better.</li>
          <li>Keep a high pair over four cards to a straight or flush.</li>
          <li>Pairs of 10s and lower don't pay, but are still worth holding over nothing.</li>
          <li>With no pair, keep your high cards (J, Q, K, A).</li>
        </ul>
      </Section>
    ),

    'higher-lower': (
      <Section title="Higher or Lower" diagram={<HigherLowerDiagram />}>
        <h3>How to play</h3>
        <ul>
          <li>Guess whether the next card is higher or lower than the one showing. Aces are high.</li>
          <li>Each correct guess grows your pot by ×{POT_MULTIPLIER}.</li>
          <li><b>Cash out</b> after at least one correct guess to keep the pot. A wrong guess or a tie loses it.</li>
          <li>Or bet that the next card is the same rank: a 1-in-13 shot that pays ×{JACKPOT_MULTIPLIER} your pot.</li>
        </ul>
        <h3>Tips</h3>
        <ul>
          <li>Guess against the middle: if a 7 shows, higher and lower are close to even.</li>
          <li>On a 2 or 3, bet higher. On a Queen, King or Ace, bet lower.</li>
          <li>Cash out while you're ahead. The streak gets riskier the longer it goes.</li>
        </ul>
      </Section>
    ),

    'red-dog': (
      <Section title="Red Dog" diagram={<RedDogDiagram />}>
        <h3>How to play</h3>
        <ul>
          <li>Place a bet and two cards are dealt. The gap between them is the <b>spread</b>: how many ranks fit in between.</li>
          <li>You win if the third card lands strictly between the two. Landing on either one loses. Aces are high.</li>
          <li>The smaller the spread, the bigger the payout:</li>
        </ul>
        <table className="paytable">
          <tbody>
            {SPREAD_PAYOUTS.map((p) => (
              <tr key={p.spread}>
                <td>{p.spread} card in between</td>
                <td>{p.payout} to 1</td>
              </tr>
            ))}
            <tr>
              <td>4 or more in between</td>
              <td>{WIDE_SPREAD_PAYOUT} to 1</td>
            </tr>
          </tbody>
        </table>
        <ul>
          <li><b>Consecutive cards</b> (like 6 and 7) can't have anything between them, so it's a push and you keep your bet.</li>
          <li><b>A pair</b> gets a third card straight away. If it matches you win {THREE_OF_A_KIND_PAYOUT} to 1, otherwise it's a push.</li>
          <li><b>Raise:</b> after seeing the spread you can add up to your original bet before the third card is dealt.</li>
        </ul>
        <h3>Tips</h3>
        <ul>
          <li>Raise only on a spread of 7 or more. That's where the third card lands between them more than half the time.</li>
          <li>On a narrow spread (1 or 2) the big payout is tempting, but it wins less than one time in six. Don't add to it.</li>
          <li>Every hand uses a freshly shuffled deck, so there's nothing to remember from earlier hands.</li>
        </ul>
      </Section>
    ),

    baccarat: (
      <Section title="Baccarat" diagram={<BaccaratDiagram />}>
        <h3>How to play</h3>
        <ul>
          <li>You don't play any cards. Choose a bet, press Deal, and the cards play themselves out by fixed rules.</li>
          <li>Two hands are dealt: <b>Player</b> and <b>Banker</b>. These are just names, and you can bet on either one whoever you are.</li>
          <li>Add up a hand and only the last digit counts (15 is 5). The hand closest to 9 wins. 10, J, Q and K are worth 0 and an Ace is 1.</li>
          <li>If either hand starts on 8 or 9 it's a <b>natural</b> and the round ends. Otherwise a hand may draw a third card, depending on its total. The game does this for you.</li>
        </ul>
        <table className="paytable">
          <tbody>
            <tr>
              <td>Player wins</td>
              <td>{PLAYER_PAYOUT} to 1</td>
            </tr>
            <tr>
              <td>Banker wins</td>
              <td>0.{BANKER_PAYOUT_PERCENT} to 1</td>
            </tr>
            <tr>
              <td>Tie</td>
              <td>{TIE_PAYOUT} to 1</td>
            </tr>
          </tbody>
        </table>
        <ul>
          <li>Banker pays a little less because the casino takes a 5% commission, and winnings are rounded down to a whole coin.</li>
          <li>If the round is a tie, Player and Banker bets are returned. Only a Tie bet wins.</li>
        </ul>
        <h3>Tips</h3>
        <ul>
          <li>Banker is the best bet over time, even with the commission, and Player is close behind.</li>
          <li>The Tie bet pays 8 to 1 but is the worst bet at the table. It's fun for a flutter, not a plan.</li>
          <li>There's no skill in the cards, so the only choices are your bet and your bet size. Keep your bets small relative to your coins.</li>
        </ul>
      </Section>
    ),
    'crazy-eights': (
      <Section title="Crazy Eights" diagram={<CrazyEightsDiagram />}>
        <h3>How to play</h3>
        <ul>
          <li>You and the bot get {HAND_SIZE} cards each. One card is turned face up to start the pile. The first player to get rid of every card wins.</li>
          <li>On your turn, play a card that matches the top card's <b>suit</b> or its <b>number</b>. Click a card to play it. Cards you can't play right now are dimmed.</li>
          <li><b>8s are wild.</b> You can play one at any time, then choose which suit comes next.</li>
          <li>If you have nothing to play, press <b>Draw cards</b>. You keep drawing until you pick up a card you can play.</li>
          <li>If the deck runs out, the pile is reshuffled. If nobody can move at all, the round is a draw and your bet is returned.</li>
          <li>Win the round to get your bet back plus {WIN_PAYOUT}× your bet. Lose and you lose your bet.</li>
        </ul>
        <h3>Tips</h3>
        <ul>
          <li>Save your 8s. They're your escape when nothing else fits, and a good way to finish.</li>
          <li>When you play an 8, choose the suit you hold the most cards of.</li>
          <li>Get rid of awkward cards, such as the only one you have in a suit, while you can.</li>
          <li>Watch the bot's card count. When it gets low, stop saving your 8s and go out.</li>
        </ul>
      </Section>
    ),
  };

  return (
    <div className="rules">
      <GameNav games={games} activeId={gameId} onSelect={onSelect} />
      {pages[gameId] ?? <p className="blurb">The rules for this game haven't been written yet.</p>}
    </div>
  );
}
