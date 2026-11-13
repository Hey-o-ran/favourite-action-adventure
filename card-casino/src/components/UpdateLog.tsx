interface Update {
  date: string;
  title: string;
  points: string[];
}

/** Newest first. Written for kids, so keep it short, friendly and jargon-free. Add new updates at the top. */
const UPDATES: Update[] = [
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
