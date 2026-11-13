interface Update {
  date: string;
  title: string;
  points: string[];
}

/** Newest first. Written for kids, so keep it short, friendly and jargon-free. Add new updates at the top. */
const UPDATES: Update[] = [
  {
    date: '13 November 2026',
    title: 'Crazy Eights, and games sorted into groups',
    points: [
      'A brand-new game: Crazy Eights! You play against a robot. Match the top card by its colour-and-shape (suit) or its number. Be first to run out of cards to win.',
      '8s are wild, which means they can be played any time. When you play one, you get to pick the suit that comes next.',
      'The games are now sorted into groups at the top: Table Games, Poker, Solo and Versus Bots. That way it will stay easy to find a game when we add lots more.',
      'The Rules page uses the same groups, with the rules for one game at a time.',
    ],
  },
  {
    date: '13 November 2026',
    title: 'Rules are easier to find',
    points: [
      'Now every game has its very own rules page, so you do not have to scroll past all the other games.',
      'Press Rules while you are playing a game and you will see the rules for that game straight away.',
      'Want to read about a different game? Tap its name at the top of the Rules page.',
    ],
  },
  {
    date: '13 November 2026',
    title: 'Baccarat is here!',
    points: [
      'A new game where you do not play any cards at all. You just pick who you think will win and the cards do the rest.',
      'Choose Player, Banker or Tie. Whichever hand is closest to 9 wins. Face cards and 10s are worth zero, which is a funny rule!',
      'The Rules page explains it step by step, with a picture.',
    ],
  },
  {
    date: '13 November 2026',
    title: 'Red Dog is here!',
    points: [
      'Two cards are dealt. You bet that a third card will land in between them, like a 6 between a 4 and a 9.',
      'The closer the two cards are, the bigger your prize, but the harder it is to win.',
      'After you see the cards, you can raise your bet if you feel lucky.',
      'There is a how-to-play picture and some tips on the Rules page.',
    ],
  },
  {
    date: '12 November 2026',
    title: 'Fairer Jacks or Better',
    points: [
      'Fixed a sneaky problem in Jacks or Better. The game used to keep the same pile of cards for lots of hands in a row, until it ran out.',
      'Now the cards get a brand-new shuffle every single time you press Deal, just like a real machine. No more mix-ups and no more twin cards!',
    ],
  },
  {
    date: '12 November 2026',
    title: 'The game is on the internet!',
    points: [
      'You can now play Card Casino on the web at chace.haoran.cloud. Anyone with the link can open it, on a computer, tablet or phone.',
      'We built a little robot helper. Every time a new update is ready, the robot puts the new version online all by itself. No one has to do it by hand.',
    ],
  },
  {
    date: '12 November 2026',
    title: 'New Rules button',
    points: [
      'There is a new Rules button in the top right corner. Press it to see pictures and words that show you how to play every game.',
      'Each game also has tips, which are little hints to help you win more often.',
      'Your game is not lost when you look at the rules. Press Back to game and carry on right where you stopped.',
    ],
  },
  {
    date: 'Before that',
    title: 'Card Casino opens!',
    points: [
      'Four games to play: Blackjack, Klondike Solitaire, Jacks or Better and Higher or Lower.',
      'You play with pretend coins, not real money. You pick how many coins to bet before each game.',
      'Run out of coins? You can claim some more and keep playing.',
    ],
  },
];

export function UpdateLog() {
  return (
    <div className="updates">
      <h2>What's new</h2>
      {UPDATES.map((u) => (
        <section className="update" key={u.title}>
          <p className="update-date">{u.date}</p>
          <h3>{u.title}</h3>
          <ul>
            {u.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
