import { getCellId, getCellsForBBox, toValidBBox } from '../src/grid';
import { describe, expect, test } from 'bun:test';

const columns = (cells: Array<string>) =>
  [...new Set(cells.map((cell) => Number(cell.split(':')[0])))].sort((a, b) => a - b);

describe('getCellId', () => {
  test('buckets by 5-degree cells', () => {
    expect(getCellId(52.1, 10.4)).toBe('2:10');
    expect(getCellId(-0.1, -0.1)).toBe('-1:-1');
  });

  test('wraps longitude so both sides of the antimeridian line up', () => {
    expect(getCellId(-30, 180)).toBe(getCellId(-30, -180));
    expect(getCellId(-30, 179)).toBe('35:-6');
    expect(getCellId(-30, -179)).toBe('-36:-6');
  });
});

describe('toValidBBox', () => {
  test('keeps a normal viewport as is', () => {
    expect(toValidBBox({ latMin: 36, latMax: 71, lonMin: -10, lonMax: 30 })).toEqual({
      latMin: 36,
      latMax: 71,
      lonMin: -10,
      lonMax: 30,
    });
  });

  test('normalizes viewports crossing the antimeridian or on another world copy', () => {
    const expected = { latMin: -50, latMax: -10, lonMin: 165, lonMax: 195 };
    expect(toValidBBox({ latMin: -50, latMax: -10, lonMin: 165, lonMax: 195 })).toEqual(expected);
    expect(toValidBBox({ latMin: -50, latMax: -10, lonMin: -195, lonMax: -165 })).toEqual(expected);
    expect(toValidBBox({ latMin: 36, latMax: 71, lonMin: 350, lonMax: 390 })).toEqual({
      latMin: 36,
      latMax: 71,
      lonMin: -10,
      lonMax: 30,
    });
  });

  test('clamps latitude and caps width at one world', () => {
    const bbox = toValidBBox({ latMin: -1e12, latMax: 1e12, lonMin: -1e12, lonMax: 1e12 });
    expect(bbox?.latMin).toBe(-90);
    expect(bbox?.latMax).toBe(90);
    expect(bbox && bbox.lonMax - bbox.lonMin).toBe(360);
  });

  test('rejects non-numbers and inverted longitude', () => {
    expect(toValidBBox({ latMin: Number.NaN, latMax: 10, lonMin: 0, lonMax: 10 })).toBeNull();
    // Client input is untyped JSON; a string must not slip through.
    expect(toValidBBox({ latMin: 0, latMax: 10, lonMin: '0' as unknown as number, lonMax: 10 })).toBeNull();
    expect(toValidBBox({ latMin: 0, latMax: 10, lonMin: 20, lonMax: 10 })).toBeNull();
  });
});

describe('getCellsForBBox', () => {
  test('covers a regular viewport', () => {
    const cells = getCellsForBBox({ latMin: 36, latMax: 71, lonMin: -10, lonMax: 30 });
    expect(columns(cells)).toEqual([-2, -1, 0, 1, 2, 3, 4, 5, 6]);
    expect(cells).toContain(getCellId(52, 10));
  });

  test('covers both sides of the antimeridian', () => {
    const cells = getCellsForBBox({ latMin: -50, latMax: -10, lonMin: 165, lonMax: 195 });
    expect(columns(cells)).toEqual([-36, -35, -34, -33, 33, 34, 35]);
    expect(cells).toContain(getCellId(-17, 178));
    expect(cells).toContain(getCellId(-17, -178));
  });

  test('stays bounded and duplicate-free for a whole-world viewport', () => {
    const cells = getCellsForBBox({ latMin: -90, latMax: 90, lonMin: 80, lonMax: 440 });
    expect(columns(cells)).toHaveLength(72);
    expect(new Set(cells).size).toBe(cells.length);
    expect(cells).toHaveLength(72 * 37);
  });
});
