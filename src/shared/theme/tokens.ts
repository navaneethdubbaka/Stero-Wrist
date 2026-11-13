/** Harbor channel markers — Operate world (type/palette/density + ChannelStrip). */
export const colors = {
  ink: '#0B1215',
  surface: '#121C22',
  surfaceRaised: '#1A2830',
  steel: '#2A3F4A',
  mist: '#9BB0BB',
  foam: '#E8F1F4',
  brandBand: '#0F3A42',
  lanternReady: '#3DDC97',
  lanternPending: '#E6B84D',
  lanternError: '#E85D4C',
  lanternOff: '#5C6F78',
  outline: '#314650',
  danger: '#E85D4C',
  warning: '#E6B84D',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const type = {
  brand: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.2 },
  title: { fontSize: 20, fontWeight: '700' as const },
  headline: { fontSize: 28, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.3 },
  caption: { fontSize: 12, fontWeight: '400' as const },
} as const;

export const touch = {
  min: 48,
} as const;
