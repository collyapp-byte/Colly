// Standalone test for the deterministic price negotiation engine.
//
// Run with:  node scripts/test-negotiation.ts
//
// The product below is in-memory: this exercises lib/negotiation.ts, which has
// no database dependencies, so no environment or seed data is needed.

type NegotiationState = import("../lib/negotiation").NegotiationState;

async function main() {
  // Resolved as a variable so this runtime import works under Node's native
  // TypeScript support without fighting the project's bundler module settings.
  const modulePath = "../lib/negotiation.ts";
  const { calculateCounterOffer } = (await import(modulePath)) as {
    calculateCounterOffer: (state: NegotiationState) => {
      counter: number;
      isFinal: boolean;
      explanation: string;
    };
  };

  // The product the AI would be selling.
  const product = {
    name: "Hisense 32 inch LED TV",
    listPrice: 145000,
    floorPrice: 130000,
    negotiable: true,
  };

  // Six rounds of customer offers: a lowball, a climb, a touch of the floor and
  // a final wobble below it.
  const customerOffers = [100000, 120000, 125000, 128000, 130000, 128000];

  const state: NegotiationState = {
    listPrice: product.listPrice,
    floorPrice: product.floorPrice,
    currentOffer: product.listPrice,
    round: 0,
    maxRounds: 6,
    cumulativeConcession: 0,
    startingPrice: product.listPrice,
  };

  console.log(`Test product: ${product.name}`);
  console.log(
    `listPrice ${product.listPrice}  floorPrice ${product.floorPrice}  negotiable ${product.negotiable}`,
  );
  console.log("");

  let minCounter = Number.POSITIVE_INFINITY;

  for (let i = 0; i < customerOffers.length; i++) {
    const customerOffer = customerOffers[i];
    state.round += 1;

    const result = calculateCounterOffer(state);

    console.log(
      `Round ${state.round}: customer offered ${customerOffer} -> counter ${result.counter}` +
        ` (${result.isFinal ? "final" : "open"}) - ${result.explanation}`,
    );

    if (result.counter < minCounter) minCounter = result.counter;

    state.currentOffer = result.counter;
    state.cumulativeConcession = state.startingPrice - result.counter;
  }

  console.log("");
  console.log(`Lowest counter: ${minCounter} (floor ${product.floorPrice})`);

  const pass = minCounter >= product.floorPrice;
  console.log(pass ? "PASS" : "FAIL");
}

main();
