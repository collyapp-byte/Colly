import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_MAX_ROUNDS, calculateCounterOffer, parseOffer } from "../lib/negotiation";

test("counter offers step down towards the floor and never cross it", () => {
  const first = calculateCounterOffer({
    listPrice: 100_000,
    floorPrice: 80_000,
    currentOffer: 100_000,
    round: 0,
    maxRounds: DEFAULT_MAX_ROUNDS,
  });

  // 15% of the 20,000 gap = 3,000, rounded to the nearest 100.
  assert.equal(first.counter, 97_000);
  assert.equal(first.isFinal, false);

  const last = calculateCounterOffer({
    listPrice: 100_000,
    floorPrice: 80_000,
    currentOffer: 97_000,
    round: DEFAULT_MAX_ROUNDS - 1,
    maxRounds: DEFAULT_MAX_ROUNDS,
  });

  assert.equal(last.isFinal, true);
  assert.ok(last.counter >= 80_000);
  assert.ok(last.counter <= 97_000);
});

test("the floor price is final and out-of-rounds holds the price", () => {
  assert.deepEqual(
    calculateCounterOffer({
      listPrice: 100_000,
      floorPrice: 80_000,
      currentOffer: 80_000,
      round: 1,
      maxRounds: DEFAULT_MAX_ROUNDS,
    }),
    { counter: 80_000, isFinal: true, explanation: "This is my best price." },
  );

  const outOfRounds = calculateCounterOffer({
    listPrice: 100_000,
    floorPrice: 90_000,
    currentOffer: 95_000,
    round: DEFAULT_MAX_ROUNDS,
    maxRounds: DEFAULT_MAX_ROUNDS,
  });
  assert.equal(outOfRounds.counter, 95_000);
  assert.equal(outOfRounds.isFinal, true);
});

test("a product without a floor still never quotes above its standing price", () => {
  const offer = calculateCounterOffer({
    listPrice: 50_000,
    floorPrice: null,
    currentOffer: 50_000,
    round: 0,
    maxRounds: DEFAULT_MAX_ROUNDS,
  });

  assert.equal(offer.counter, 42_500); // 50,000 - 15% of 50,000
  assert.ok(offer.counter <= 50_000);
});

test("offers are parsed from digits, currency prefixes and spelled-out amounts", () => {
  assert.equal(parseOffer("I can do 100k", 150_000), 100_000);
  assert.equal(parseOffer("₦100,000 is my price", 150_000), 100_000);
  assert.equal(parseOffer("NGN 120000", 150_000), 120_000);
  assert.equal(parseOffer("one hundred thousand", 150_000), 100_000);
  assert.equal(parseOffer("what is the price?", 150_000), null);
  assert.equal(parseOffer("", 150_000), null);
  // Quantities and day counts are not offers.
  assert.equal(parseOffer("I want 3 pieces", 150_000), null);
});

test("when several amounts appear, the highest one below the list wins", () => {
  assert.equal(parseOffer("I saw it for 90,000 but I can pay 120,000", 150_000), 120_000);
  assert.equal(parseOffer("my final 200,000", 150_000), 200_000);
});
