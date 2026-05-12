export const randomCallsign = (): string => `CONTRAIL${Math.floor(Math.random() * 9000) + 1000}`;

export const randomIcao24 = (): string =>
  Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0');
