import { describe, expect, test } from 'bun:test';
import { FeedMock } from '../src';

describe('FeedMock', () => {
  test('spawns fleet correctly', () => {
    const feed = new FeedMock({ fleetSize: 10, tickMs: 1000 });
    const snapshot = feed.snapshot();
    expect(snapshot.length).toBe(10);
  });

  test('tick advances positions', () => {
    const feed = new FeedMock({ fleetSize: 5, tickMs: 1000 });
    const before = feed.snapshot();
    feed.tick();
    const after = feed.snapshot();
    expect(after).not.toEqual(before);
  });
});
