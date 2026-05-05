/**
 * Design tokens for komanda-app.
 *
 * Vivid Mexican-inspired palette: amber gradient brand mark, signal blue
 * for primary actions, warm linen surfaces. The brand uses a single
 * chromatic gradient (Amber Flame → Honey Glow) on a monochrome canvas;
 * Signal Blue creates intentional temperature contrast for interactive
 * CTAs so identity and action stay visually separable. No raw hex
 * literals in component stylesheets — pull from here.
 */

import type { TextStyle, ViewStyle } from 'react-native';

export const palette = {
  // Brand — Amber gradient (Amber Flame → Honey Glow).
  // Used for the logo mark, money surfaces, brand washes. NOT for CTAs.
  amber50: '#FFF1E0',
  amber100: '#FFD8B0',
  amber400: '#feab30', // Honey Glow — gradient end, highlight tone
  amber500: '#ff5b1f', // Amber Flame — gradient start, brand mark anchor
  amber600: '#e8480f', // pressed / depth shade for amber surfaces
  amber700: '#8a2400', // deepest amber, shadow tint

  // Action — Signal Blue family.
  // Cool blue against the warm-amber brand creates the temperature contrast
  // that separates identity (amber) from interactive action (blue).
  blue50: '#E8F3FF',
  blue100: '#C7E3FF',
  blue500: '#0088ff', // Signal Blue — primary CTA fill
  blue600: '#1c95ff', // Bright Blue — pressed/active lift (lighter on press)
  blue700: '#006acc', // hover/dark shade for accessibility text on tints

  // Status badge palette — vivid, eye-catching colors for komanda
  // lifecycle pills. Designed to POP against the warm linen canvas so a
  // waiter scanning the list spots state at a glance.
  vividRed500: '#ff383c',   // Alert Red — pending (urgency, "serve me")
  vividRed700: '#b00d12',   // pressed / dark text on red tint
  vividGreen500: '#34c759', // Vivid Green — served (delivered, success)
  vividGreen700: '#0d8f3a', // pressed / dark text on green tint
  vividMagenta500: '#cb30e0', // Electric Magenta — closed (paid, completion)
  vividMagenta700: '#7e1690', // pressed / dark text on magenta tint

  // Legacy terracotta keys — aliased to amber so any component still
  // referencing `palette.terracotta*` automatically picks up the new brand
  // tone instead of crashing or rendering brown.
  terracotta50: '#FFF1E0',
  terracotta100: '#FFD8B0',
  terracotta500: '#ff5b1f',
  terracotta600: '#e8480f',
  terracotta700: '#8a2400',

  saffron50: '#FEF6E3',
  saffron100: '#FCE6B2',
  saffron500: '#feab30', // realigned to Honey Glow for visual consistency
  saffron600: '#d68a14',

  // Surfaces (warm neutrals — kept as-is; brand color shift doesn't change
  // the canvas temperature, only the chromatic accents on top).
  linen: '#FBF6EF',
  bone: '#F5EDE1',
  sand: '#ECE1CF',

  white: '#FFFFFF',

  // Text neutrals (warm-tinted)
  ink900: '#1C1410',
  ink700: '#3A2E25',
  ink500: '#6B5B4C',
  ink400: '#8A7A6B',
  ink300: '#B6A89A',
  ink200: '#D9CEBF',
  ink100: '#ECE4DA',

  // Semantic
  success50: '#E5F2EA',
  success500: '#2F8A4F',
  success700: '#1E5F37',

  warning50: '#FDF2D9',
  warning500: '#C8811E',
  warning700: '#8A5710',

  danger50: '#FBE7E7',
  danger500: '#B42A2A',
  danger700: '#7E1A1A',

  info50: '#E3EEFA',
  info500: '#1F6FB2',
  info700: '#144A7C',
} as const;

export const color = {
  // Surfaces
  bg: palette.linen,
  bgElevated: palette.white,
  bgSunken: palette.bone,
  surface: palette.white,
  surfaceAlt: palette.bone,

  // Text
  textPrimary: palette.ink900,
  textSecondary: palette.ink500,
  textTertiary: palette.ink400,
  textInverse: palette.white,
  textMuted: palette.ink400,

  // Borders
  border: palette.ink100,
  borderStrong: palette.ink200,

  // Action — Signal Blue is the primary CTA color. Buttons, FABs, links.
  primary: palette.blue500,
  primaryPressed: palette.blue600,
  primaryMuted: palette.blue50,
  primaryOn: palette.white,

  // Brand mark — amber gradient. Use for logo, money totals, hero surfaces
  // where the brand identity shows through. Distinct from `primary` so the
  // CTA color and brand color don't fight each other.
  brand: palette.amber500,
  brandSoft: palette.amber400, // Honey Glow tone for highlights / gradient stops
  brandMuted: palette.amber50,
  brandOn: palette.white,

  accent: palette.amber400,
  accentMuted: palette.amber50,

  // Semantic
  success: palette.success500,
  successBg: palette.success50,
  successText: palette.success700,

  warning: palette.warning500,
  warningBg: palette.warning50,
  warningText: palette.warning700,

  danger: palette.danger500,
  dangerBg: palette.danger50,
  dangerText: palette.danger700,

  info: palette.info500,
  infoBg: palette.info50,
  infoText: palette.info700,

  // Overlays
  scrim: 'rgba(28, 20, 16, 0.55)',
} as const;

/**
 * Liquid Glass tokens.
 *
 * Glass is for **chrome** (navigation, toolbars, floating action bars, tab
 * bars, segmented controls) — never for content surfaces. Content (cards,
 * list rows, receipts, hero totals) stays on solid surfaces so legibility
 * and brand color are never at risk.
 *
 * Each glass variant defines:
 *   - tint          : BlurView `tint` prop
 *   - intensity     : BlurView `intensity` (0-100)
 *   - overlay       : RGBA wash layered on top of the blur (gives warm cast
 *                     and lifts contrast on busy backgrounds)
 *   - border        : 1px border that reads like the edge of a pane of glass
 *   - specular      : inset highlight to simulate the top-edge gloss
 *   - shadow        : ViewStyle — the soft ground-shadow below floating glass
 */
export const glass = {
  /** Light chrome — top nav, search bar, filters, FAB.
   *  Overlay is kept low-alpha so the BlurView actually contributes —
   *  too opaque and the glass reads as plain tinted plastic. */
  light: {
    tint: 'light' as 'light' | 'dark' | 'default',
    intensity: 55,
    overlay: 'rgba(255, 250, 243, 0.28)',
    border: 'rgba(255, 255, 255, 0.55)',
    specular: 'rgba(255, 255, 255, 0.85)',
    shadow: {
      shadowColor: palette.ink900,
      shadowOpacity: 0.12,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    } as ViewStyle,
  },
  /** Dark chrome — used on top of bright imagery or saffron-saturated areas. */
  dark: {
    tint: 'dark' as 'light' | 'dark' | 'default',
    intensity: 60,
    overlay: 'rgba(28, 20, 16, 0.32)',
    border: 'rgba(255, 255, 255, 0.10)',
    specular: 'rgba(255, 255, 255, 0.14)',
    shadow: {
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    } as ViewStyle,
  },
  /** Tinted chrome — primary FAB, live-pinned calls to action.
   *  Overlay is translucent Signal Blue so the BlurView picks up the warm
   *  canvas behind it. Cool blue against the warm-amber brand creates the
   *  intentional temperature contrast that makes CTAs visually pop. */
  primary: {
    tint: 'light' as 'light' | 'dark' | 'default',
    intensity: 55,
    overlay: 'rgba(0, 136, 255, 0.62)',
    border: 'rgba(255, 255, 255, 0.32)',
    specular: 'rgba(255, 255, 255, 0.55)',
    shadow: {
      shadowColor: palette.blue700,
      shadowOpacity: 0.32,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    } as ViewStyle,
  },
  /** Brand chrome — amber gradient surfaces (logo plate, hero ribbons).
   *  Distinct from `primary` so brand identity and action stay visually
   *  separable. */
  brand: {
    tint: 'light' as 'light' | 'dark' | 'default',
    intensity: 55,
    overlay: 'rgba(255, 91, 31, 0.55)',
    border: 'rgba(255, 255, 255, 0.32)',
    specular: 'rgba(255, 255, 255, 0.55)',
    shadow: {
      shadowColor: palette.amber700,
      shadowOpacity: 0.32,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    } as ViewStyle,
  },
} as const;

/**
 * Warm-canvas gradient stops.
 *
 * Glass chrome needs something colorful underneath to actually refract — on a
 * flat linen surface it just reads as grey frosted plastic. Screens that host
 * glass should render a `WarmCanvas` (or the `Screen` warm variant) behind
 * their content so saffron and terracotta halos bleed through.
 */
export const canvas = {
  topWarm: '#FFF7EA',
  midLinen: palette.linen,
  bottomSand: '#F6EADA',
  /** Honey Glow halo — top-right by default.
   *  Alphas are tuned for *post-blur* density: the WarmCanvas BlurView
   *  smears them, so values here are dialed down from the HTML preview
   *  where the preview relied on `filter: blur()` instead. */
  haloSaffron: 'rgba(254, 171, 48, 0.32)',
  haloSaffronSoft: 'rgba(254, 171, 48, 0.18)',
  /** Amber Flame halo — bottom-left, anchors the brand temperature. */
  haloTerracotta: 'rgba(255, 91, 31, 0.22)',
  /** Signal Blue halo — bottom-right, intentional cool counterweight that
   *  visually echoes the CTA color on every screen. */
  haloJade: 'rgba(0, 136, 255, 0.14)',
} as const;

/** 4pt spacing scale. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
  xxxxxl: 48,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  /** Floating glass bars & cards — concentric with the iPhone corner radius. */
  xxl: 28,
  full: 999,
} as const;

export const fontSize = {
  caption: 11,
  label: 12,
  footnote: 13,
  body: 15,
  bodyLg: 16,
  h3: 18,
  h2: 22,
  h1: 28,
  display: 34,
} as const;

export const lineHeight = {
  caption: 14,
  label: 16,
  footnote: 18,
  body: 22,
  bodyLg: 24,
  h3: 24,
  h2: 28,
  h1: 34,
  display: 40,
} as const;

export const fontWeight = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
  heavy: '800' as TextStyle['fontWeight'],
};

export const text = {
  display: {
    fontSize: fontSize.display,
    lineHeight: lineHeight.display,
    fontWeight: fontWeight.heavy,
    letterSpacing: -0.5,
    color: color.textPrimary,
  } as TextStyle,
  h1: {
    fontSize: fontSize.h1,
    lineHeight: lineHeight.h1,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
    color: color.textPrimary,
  } as TextStyle,
  h2: {
    fontSize: fontSize.h2,
    lineHeight: lineHeight.h2,
    fontWeight: fontWeight.bold,
    color: color.textPrimary,
  } as TextStyle,
  h3: {
    fontSize: fontSize.h3,
    lineHeight: lineHeight.h3,
    fontWeight: fontWeight.semibold,
    color: color.textPrimary,
  } as TextStyle,
  body: {
    fontSize: fontSize.bodyLg,
    lineHeight: lineHeight.bodyLg,
    fontWeight: fontWeight.regular,
    color: color.textPrimary,
  } as TextStyle,
  bodyStrong: {
    fontSize: fontSize.bodyLg,
    lineHeight: lineHeight.bodyLg,
    fontWeight: fontWeight.semibold,
    color: color.textPrimary,
  } as TextStyle,
  bodySm: {
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.regular,
    color: color.textSecondary,
  } as TextStyle,
  footnote: {
    fontSize: fontSize.footnote,
    lineHeight: lineHeight.footnote,
    fontWeight: fontWeight.regular,
    color: color.textSecondary,
  } as TextStyle,
  label: {
    fontSize: fontSize.label,
    lineHeight: lineHeight.label,
    fontWeight: fontWeight.semibold,
    color: color.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  } as TextStyle,
  caption: {
    fontSize: fontSize.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.regular,
    color: color.textTertiary,
  } as TextStyle,
  mono: {
    fontVariant: ['tabular-nums'],
  } as TextStyle,
};

/**
 * Shadow presets. iOS uses shadow*, Android uses elevation.
 * All values are tuned for warm linen background.
 */
export const shadow = {
  none: {} as ViewStyle,
  sm: {
    shadowColor: palette.ink900,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  } as ViewStyle,
  md: {
    shadowColor: palette.ink900,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  } as ViewStyle,
  lg: {
    shadowColor: palette.ink900,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  } as ViewStyle,
};

export const hitSlop = { top: 8, right: 8, bottom: 8, left: 8 };

export const icon = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
} as const;

export const zIndex = {
  base: 0,
  card: 1,
  bar: 10,
  header: 20,
  fab: 40,
  modal: 100,
  toast: 200,
} as const;

export const animation = {
  /** Use with reanimated or LayoutAnimation. Durations in ms. */
  fast: 150,
  normal: 220,
  slow: 320,
  easing: 'ease-out' as const,
} as const;

export const layout = {
  minTouchTarget: 44,
  screenPadding: space.lg,
  inputHeight: 48,
  buttonHeight: 52,
  buttonHeightSm: 40,
} as const;

export type Tokens = {
  color: typeof color;
  space: typeof space;
  radius: typeof radius;
  text: typeof text;
  shadow: typeof shadow;
};
