import { useId, type ReactNode } from 'react';
import { useI18n, type MessageKey } from '../i18n';
import type { SlotSymbol } from '../games/slotsRules';

/**
 * The slot symbols are Glaggles, from Glagglepedia. These are our own simple drawings of them, in the same style
 * as the wiki's family picture (soft shaded balls, small oval eyes, thin mouths), not copies of its pictures.
 */
export type GlaggleName = 'giggler' | 'gazo' | 'gloober' | 'gembo' | 'gleeber' | 'glabber';

/** Which Glaggle stands for which slot symbol. */
export const GLAGGLE_FOR: Record<SlotSymbol, GlaggleName> = {
  cherry: 'giggler',
  lemon: 'gazo',
  grape: 'gloober',
  bell: 'gembo',
  diamond: 'gleeber',
  seven: 'glabber',
};

/** The skin colour of each one, matched to the wiki's family picture. */
export const GLAGGLE_COLOURS: Record<GlaggleName, string> = {
  giggler: '#f7d84a', // yellow
  gazo: '#3f45c8', // indigo
  gloober: '#6ee04f', // green
  gembo: '#ee7b6e', // coral
  gleeber: '#a23fd8', // purple
  glabber: '#eca468', // orange
};

const INK = '#2a1f2d';

/** Mixes a colour towards white (positive amount) or black (negative), for the soft shading of the ball. */
function shade(hex: string, amount: number): string {
  const channel = (i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  return `#${[0, 1, 2].map((i) => mix(channel(i)).toString(16).padStart(2, '0')).join('')}`;
}

const oval = (cx: number, cy: number, rx = 4.6, ry = 7.4) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={INK} />;
const line = { stroke: INK, strokeWidth: 2.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** The face itself, drawn in a 100 by 100 box so it can be placed inside any other picture. */
export function GlaggleShapes({ name, gradientId }: { name: GlaggleName; gradientId: string }): ReactNode {
  const colour = GLAGGLE_COLOURS[name];
  const ball = (
    <>
      <defs>
        <radialGradient id={gradientId} cx="0.38" cy="0.3" r="0.85">
          <stop offset="0" stopColor={shade(colour, 0.5)} />
          <stop offset="0.55" stopColor={colour} />
          <stop offset="1" stopColor={shade(colour, -0.22)} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill={`url(#${gradientId})`} stroke={shade(colour, -0.4)} strokeWidth="1.5" />
    </>
  );

  switch (name) {
    case 'giggler': // oval eyes and a wide curvy grin with little serifs at the ends
      return (
        <>
          {ball}
          {oval(37, 40)}
          {oval(63, 40)}
          <path d="M26 58 Q50 84 74 58 M26 58 L24 53 M74 58 L76 53" {...line} />
        </>
      );
    case 'gazo': // short black beady eyes and a plain small curved mouth with no ends to it
      return (
        <>
          {ball}
          <circle cx="38" cy="45" r="3.6" fill="#000" />
          <circle cx="62" cy="45" r="3.6" fill="#000" />
          <path d="M37 63 Q50 72 63 63" {...line} strokeLinecap="butt" />
        </>
      );
    case 'gloober': // oval eyes and a friendly smile
      return (
        <>
          {ball}
          {oval(37, 41)}
          {oval(63, 41)}
          <path d="M33 59 Q50 74 67 59" {...line} />
        </>
      );
    case 'gembo': // oval eyes and a straight mouth with curved corners, like a smirk
      return (
        <>
          {ball}
          {oval(37, 40, 4.8, 7.8)}
          {oval(63, 40, 4.8, 7.8)}
          <path d="M33 62 Q36 66 41 66 H59 Q64 66 67 62" {...line} />
        </>
      );
    case 'gleeber': // small oval eyes and a smile, in a purple that fades from pink to blue
      return (
        <>
          {ball}
          {oval(38, 43, 4, 6.4)}
          {oval(62, 43, 4, 6.4)}
          <path d="M36 61 Q50 72 64 61" {...line} />
        </>
      );
    case 'glabber': // a smiley with two sharp teeth, like a vampire's
      return (
        <>
          {ball}
          {oval(37, 41)}
          {oval(63, 41)}
          <path d="M31 58 Q50 76 69 58" {...line} />
          <polygon points="39,64 45,66 41.5,75" fill="#fff" stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
          <polygon points="55,66 61,64 58.5,75" fill="#fff" stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
        </>
      );
  }
}

const NAME_KEYS: Record<GlaggleName, MessageKey> = {
  giggler: 'glaggle.giggler',
  gazo: 'glaggle.gazo',
  gloober: 'glaggle.gloober',
  gembo: 'glaggle.gembo',
  gleeber: 'glaggle.gleeber',
  glabber: 'glaggle.glabber',
};

/** The name of the Glaggle that is this slot symbol, in the chosen language. */
export function useGlaggleName() {
  const { t } = useI18n();
  return (symbol: SlotSymbol) => t(NAME_KEYS[GLAGGLE_FOR[symbol]]);
}

/**
 * A Glaggle as a picture, named for screen readers. When the text beside it already says who it is, pass
 * `decorative` so it is not read out twice.
 */
export function GlaggleFace({ symbol, decorative = false }: { symbol: SlotSymbol; decorative?: boolean }) {
  const name = GLAGGLE_FOR[symbol];
  const label = useGlaggleName()(symbol);
  const gradientId = `glaggle-${useId().replace(/:/g, '')}`;
  return (
    <svg
      className="glaggle"
      viewBox="0 0 100 100"
      focusable="false"
      data-glaggle={name}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    >
      <GlaggleShapes name={name} gradientId={gradientId} />
    </svg>
  );
}

/** A Glaggle placed inside another picture (such as the Rules diagram), at a place and size, so it scales with it. */
export function GlaggleAt({ symbol, x, y, size, faded = false }: { symbol: SlotSymbol; x: number; y: number; size: number; faded?: boolean }) {
  const name = GLAGGLE_FOR[symbol];
  const gradientId = `glaggle-${useId().replace(/:/g, '')}`;
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 100 100" opacity={faded ? 0.55 : 1} data-glaggle={name}>
      <GlaggleShapes name={name} gradientId={gradientId} />
    </svg>
  );
}

/** The same Glaggle several times in a row, as on a line of the pay table. */
export function GlaggleRow({ symbol, count, decorative = false }: { symbol: SlotSymbol; count: number; decorative?: boolean }) {
  return (
    <span className="glaggle-row">
      {Array.from({ length: count }, (_, i) => (
        <GlaggleFace key={i} symbol={symbol} decorative={decorative} />
      ))}
    </span>
  );
}
