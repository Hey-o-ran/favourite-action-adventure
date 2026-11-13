interface Update {
  date: string;
  title: string;
  points: string[];
}

/** Newest first. Written for kids, so keep it short, friendly and jargon-free. Add new updates at the top. */
const UPDATES: Update[] = [
  {
    date: '13 November 2026',
    title: 'ADMIN ABUSE!',
    points: [
      'Surprise events are here! Sometimes the admin will start an ADMIN ABUSE event, and a bright banner will pop up at the very top of your screen to tell you what is happening.',
      'One event is free coins. Everyone playing gets a pile of coins added to their balance, all at once!',
      'Another event makes your next game unloseable. That means you cannot lose any coins on it. If you lose, you get your bet back. If you win, you keep your winnings as normal.',
      'Each event only lasts a few minutes, so keep an eye out. You will only get each event once.',
    ],
  },
  {
    date: '13 November 2026',
    title: "All in at the poker table",
    points: [
      'There is a new All in button when you play Texas Hold\'em. It bets as many coins as the table allows, all in one go!',
      'The button shows how many coins it will use. If you have the fewest coins, that is all of them. If you have more, the extra stays safe in your pile.',
      'The robots will not go all in on their own, but when you do, they think hard. They only call with a really good hand, otherwise they give up.',
      'Careful, it is a big gamble. If you win you could win lots of coins, and if you lose, they are gone.',
    ],
  },
  {
    date: '13 November 2026',
    title: "Smarter robots and Hold'em rules",
    points: [
      'The poker robots grew up! They now look at their cards. They give up on bad hands, keep going with good ones, and raise when they have something great.',
      'They are honest, too: they never bluff. If a robot raises, it really has a good hand. Can you spot it?',
      "The Rules page now explains Texas Hold'em step by step, with a picture of how your two cards and the shared cards make a hand, and a list of the best hands.",
    ],
  },
  {
    date: '13 November 2026',
    title: "Texas Hold'em (early version)",
    points: [
      "A new poker game! You sit at a table with two robots. Everyone gets two secret cards, and five more cards are turned up in the middle for everyone to share. The best five-card hand wins all the coins in the middle.",
      'You sit down with 100 coins. When you leave the table, the coins you have left go back into your balance.',
      'This is an early version. The robots are very simple for now: they never give up and never raise. They will get smarter soon.',
      'The rules page for this game is coming in the next update.',
    ],
  },
  {
    date: '13 November 2026',
    title: 'Sort by popularity',
    points: [
      'Next to the game finder there is now a Sort by box. Pick Most popular first and the games line up with the most loved ones at the front.',
      'We worked out how popular each game is by looking around, so it is our best guess and not an exact score. Solitaire and Blackjack are right at the top.',
      'Pick Default order to put the games back the way they were.',
    ],
  },
  {
    date: '13 November 2026',
    title: 'Crazy Eights, and a game finder',
    points: [
      'A brand-new game: Crazy Eights! You play against a robot. Match the top card by its colour-and-shape (suit) or its number. Be first to run out of cards to win.',
      '8s are wild, which means they can be played any time. When you play one, you get to pick the suit that comes next.',
      'There is now a game finder at the top. Pick a country where a game was invented, how many players it has, what kind of game it is, or whether it is luck or skill. The list shrinks to just the games that fit.',
      'Press Clear filters to see every game again. The Rules page has the same finder.',
      'Each game now tells you where it comes from. Some games are so old that nobody is sure, and we say so!',
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
