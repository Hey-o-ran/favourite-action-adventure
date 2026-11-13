import { describe, expect, it } from 'vitest';
import { newDeck, shuffle } from '../cards';
import { BUY_IN, act, legalActions, startHand, type HoldemState } from './holdemRules';
import { describeResult, formatLog, nextHandSetup } from './holdemTable';

const deal = (stacks = [100, 100, 100], button = 0) => startHand(stacks, button, shuffle(newDeck()));

/** Plays a whole hand where everybody just checks or calls. */
function checkDown(s: HoldemState): HoldemState {
  let state = s;
  while (!state.over) state = act(state, legalActions(state).check ? 'check' : 'call');
  return state;
}


describe('carrying on to the next hand', () => {
  it('moves the button and keeps the stacks', () => {
    const next = nextHandSetup({ ...deal([100, 100, 100], 0), seats: [{ stack: 120 }, { stack: 90 }, { stack: 90 }] } as HoldemState);
    expect(next).toMatchObject({ stacks: [120, 90, 90], button: 1, rebought: [], humanBust: false });
  });

  it('wraps the button back to seat 0', () => {
    expect(nextHandSetup(checkDown(deal([100, 100, 100], 2))).button).toBe(0);
  });

  it('has bots that cannot cover the big blind buy back in', () => {
    const fake = { ...deal(), seats: [{ stack: 150 }, { stack: 0 }, { stack: 1 }] } as HoldemState;
    expect(nextHandSetup(fake)).toMatchObject({ stacks: [150, BUY_IN, BUY_IN], rebought: [1, 2], humanBust: false });
  });

  it('does not rebuy the human, who is busted below the big blind', () => {
    const fake = { ...deal(), seats: [{ stack: 1 }, { stack: 100 }, { stack: 99 }] } as HoldemState;
    expect(nextHandSetup(fake)).toMatchObject({ stacks: [1, 100, 99], humanBust: true });
  });

  it('keeps the total chips fixed apart from rebuys', () => {
    const done = checkDown(deal());
    const next = nextHandSetup(done);
    expect(next.stacks.reduce((a, b) => a + b)).toBe(300 + next.rebought.length * BUY_IN);
  });
});

describe('describing a hand', () => {
  it('rewrites the engine log in player terms', () => {
    const lines = formatLog([
      'Seat 1 posts the small blind, seat 2 the big blind.',
      'Seat 0 calls 2.',
      'Seat 1 raises to 4.',
      'Dealt the flop.',
      'seat 0 wins the pot (12).',
    ]);
    expect(lines).toEqual(['Bot 1 posts the small blind, Bot 2 the big blind.', 'You call 2.', 'Bot 1 raises to 4.', 'Dealt the flop.']);
  });

  it('uses the right verbs when you post a blind', () => {
    expect(formatLog(['Seat 0 posts the small blind, seat 1 the big blind.'])).toEqual(['You post the small blind, Bot 1 the big blind.']);
    expect(formatLog(['Seat 1 posts the small blind, seat 0 the big blind.'])).toEqual(['Bot 1 posts the small blind, you the big blind.']);
  });

  it('says who won, with what, and what it means for you', () => {
    const folded = act(act(deal([100, 100, 100], 0), 'fold'), 'fold'); // big blind (seat 2) wins
    expect(describeResult(folded)).toEqual({ text: 'Bot 2 wins 3 (everyone else folded).', net: 0 - folded.seats[0].totalIn });

    const shown = checkDown(deal());
    const { text, net } = describeResult(shown);
    expect(text).toMatch(/(wins|win|split)/);
    expect(net).toBe(shown.payouts[0] - 2); // everyone put in 2 before checking down
  });
});
