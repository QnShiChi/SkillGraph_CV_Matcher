export function toHundredPointScore(value: number | null): number {
  if (value == null) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}
