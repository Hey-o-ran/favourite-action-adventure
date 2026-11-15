import { useId, type ReactNode } from 'react';
import { useI18n, type MessageKey } from '../i18n';
import type { SlotSymbol } from '../games/slotsRules';

/**
 * The slot symbols are Glaggles, from Glagglepedia. These are our own simple drawings of them, made from what
 * the wiki says each one looks like (its colour, eyes and mouth), not copies of the wiki's pictures.
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

/**
 * The skin colour of each one.
 *  - Giggler: yellow. Gazo: indigo. Gembo: coral. Gleeber: purple. Glabber: orange. (All from the wiki.)
 *  - Gloober: green. This one is a guess: the wiki's Gloober page could not be read, and only an unofficial
 *    fan profile says "green".
 */
export const GLAGGLE_COLOURS: Record<GlaggleName, string> = {
  giggler: '#fde047',
  gazo: '#6366f1',
  gloober: '#4ade80',
  gembo: '#ff7f6e',
  gleeber: '#a855f7',
  glabber: '#fb923c',
};

const INK = '#1f2937';
const stroke = { stroke: INK, strokeWidth: 4, fill: 'none' } as const;

/** The face itself, drawn in a 100 by 100 box so it can be placed inside any other picture. */
export function GlaggleShapes({ name, gradientId }: { name: GlaggleName; gradientId: string }): ReactNode {
  const body = <circle cx="50" cy="50" r="44" fill={GLAGGLE_COLOURS[name]} stroke={INK} strokeWidth="3" />;
  const shine = <ellipse cx="34" cy="26" rx="12" ry="6" fill="#fff" opacity="0.28" />;

  switch (name) {
    case 'giggler': // large oval eyes and a wide, curvy grin with little serifs at the ends
      return (
        <>
          {body}
          {shine}
          <ellipse cx="36" cy="42" rx="8" ry="13" fill={INK} />
          <ellipse cx="64" cy="42" rx="8" ry="13" fill={INK} />
          <path d="M22 60 Q50 92 78 60 M22 60 L19 54 M78 60 L81 54" {...stroke} strokeLinecap="round" />
        </>
      );
    case 'gazo': // short black beady eyes and a plain curved mouth with no ends to it
      return (
        <>
          {body}
          {shine}
          <circle cx="38" cy="46" r="4.5" fill="#000" />
          <circle cx="62" cy="46" r="4.5" fill="#000" />
          <path d="M33 63 Q50 75 67 63" {...stroke} strokeLinecap="butt" />
        </>
      );
    case 'gloober': // round eyes and a big open smile
      return (
        <>
          {body}
          {shine}
          <circle cx="36" cy="44" r="9" fill="#fff" stroke={INK} strokeWidth="2" />
          <circle cx="64" cy="44" r="9" fill="#fff" stroke={INK} strokeWidth="2" />
          <circle cx="37" cy="45" r="4" fill={INK} />
          <circle cx="63" cy="45" r="4" fill={INK} />
          <path d="M30 62 Q50 88 70 62 Z" fill="#14532d" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        </>
      );
    case 'gembo': // large oval eyes shading from dark to light coral, and a smirk
      return (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9a3412" />
              <stop offset="1" stopColor="#fdba74" />
            </linearGradient>
          </defs>
          {body}
          {shine}
          <ellipse cx="36" cy="42" rx="9" ry="14" fill={`url(#${gradientId})`} stroke={INK} strokeWidth="2" />
          <ellipse cx="64" cy="42" rx="9" ry="14" fill={`url(#${gradientId})`} stroke={INK} strokeWidth="2" />
          <path d="M30 66 H62 Q70 66 74 58" {...stroke} strokeLinecap="round" />
        </>
      );
    case 'gleeber': // calm, half-closed eyes and a gentle smile, in purple that fades
      return (
        <>
          <defs>
            <radialGradient id={gradientId} cx="0.35" cy="0.3" r="0.9">
              <stop offset="0" stopColor="#e9d5ff" />
              <stop offset="0.45" stopColor="#a855f7" />
              <stop offset="1" stopColor="#7e22ce" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="44" fill={`url(#${gradientId})`} stroke={INK} strokeWidth="3" />
          <path d="M26 44 Q36 34 46 44 M54 44 Q64 34 74 44" {...stroke} strokeLinecap="round" />
          <circle cx="36" cy="46" r="4" fill={INK} />
          <circle cx="64" cy="46" r="4" fill={INK} />
          <path d="M32 64 Q50 78 68 64" {...stroke} strokeLinecap="round" />
        </>
      );
    case 'glabber': // an orange smiley with two sharp teeth, like a vampire's
      return (
        <>
          {body}
          {shine}
          <circle cx="36" cy="42" r="5.5" fill={INK} />
          <circle cx="64" cy="42" r="5.5" fill={INK} />
          <path d="M26 58 Q50 84 74 58" {...stroke} strokeLinecap="round" />
          <polygon points="34,63 42,66 38,78" fill="#fff" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
          <polygon points="58,66 66,63 62,78" fill="#fff" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
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
