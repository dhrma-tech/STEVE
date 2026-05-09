export const marketingColors = {
  background: "#f5f5f2",
  foreground: "#171717",
  surface: "#f5f5f2",
  surfaceRaised: "#fbfbf8",
  surfaceDarker: "#e7e7e3",
  ink: "#262323cc",
  inkMuted: "#262323b3",
  inkFaint: "#26232380",
  inkStrong: "#262323d9",
  inkStrongest: "#262323e6",
  inkUiSolid: "#202020",
  borderCard: "#dee2de",
  borderPill: "#e3e3e0",
  success: "#34a853",
  neutral: "#bfbfbf",
  accentBrown: "#a76451",
  heroBlue: "#1a6fd1",
  featureBlueBg: "#f7fbff",
  featureBlueBorder: "#d7e8ff",
  white: "#ffffff"
} as const;

export const appColors = {
  canvas: "#1e1e23",
  panel: "#25252b",
  surface2: "#29292e",
  deep: "#1d1d22",
  blackBase: "#0e0e11",
  card: "#050505",
  border: "rgba(255,255,255,0.1)",
  inputBorder: "rgba(255,255,255,0.15)",
  text: "#f9f9f9",
  text80: "rgba(255,255,255,0.8)",
  text50: "rgba(255,255,255,0.5)",
  text30: "rgba(255,255,255,0.3)",
  primaryLight: "#eeeee8e6",
  workspaceGlass: "#202024a8",
  workspaceRaised: "#26262aeb",
  brand500: "#6229ff",
  brand400: "#7a52ff",
  brand300: "#9d8aff",
  success: "#34a853",
  running: "#3b82f6",
  warning: "#f59e0b",
  danger: "#ef4444",
  caret: "#879e3e"
} as const;

export const radii = {
  md: "6px",
  lg: "8px",
  xl: "12px",
  "2xl": "16px",
  "3xl": "24px"
} as const;

export const blur = {
  sm: "8px",
  md: "12px",
  lg: "16px"
} as const;

export const breakpoints = {
  mobile: "767px",
  smallTablet: "991px",
  desktopEnhanced: "992px",
  wideHero: "1500px",
  verySmall: "500px"
} as const;

export const typeScale = {
  heroH1: {
    fontFamily: "var(--font-sans)",
    fontSize: "46px",
    fontWeight: 400,
    lineHeight: "1.08",
    letterSpacing: "0"
  },
  sectionH2: {
    fontFamily: "var(--font-sans)",
    fontSize: "40px",
    fontWeight: 400,
    lineHeight: "1.15",
    letterSpacing: "0"
  },
  body: {
    fontFamily: "var(--font-sans)",
    fontSize: "15px",
    fontWeight: 460,
    lineHeight: "24px",
    letterSpacing: "0.15px"
  },
  monoLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: "11.6px",
    letterSpacing: "0"
  },
  pricingNumber: {
    fontFamily: "var(--font-mono)",
    fontSize: "50px",
    fontWeight: 400,
    lineHeight: "normal",
    letterSpacing: "0"
  }
} as const;

export const motionDurations = {
  fast: 0.16,
  base: 0.24,
  slow: 0.42
} as const;

export const designTokens = {
  marketingColors,
  appColors,
  radii,
  blur,
  breakpoints,
  typeScale,
  motionDurations
} as const;
