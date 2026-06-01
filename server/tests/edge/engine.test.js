// Smoke-tested: temporarily breaking model.js applyPayment (off-by-one) makes this
// suite fail with a shrunk Payment counterexample. See plan Task 6.
const fc = require("fast-check");
const request = require("supertest");
const { freshWorld } = require("./helpers");
const { newModel } = require("./model");
const { checkInvariants } = require("./invariants");
const { CreateCustomer } = require("./commands/customers");
const { SaleCredit, SaleCash } = require("./commands/sales");
const { Payment } = require("./commands/payments");

const RUNS = Number(process.env.EDGE_RUNS || 30);
// Each sequence boots a fresh app + migrations + many HTTP calls, so property
// runs are heavy. Give Jest plenty of headroom (env-tunable for deep runs).
const TIMEOUT_MS = Number(process.env.EDGE_TIMEOUT_MS || 600000);
const SEED = process.env.EDGE_SEED ? Number(process.env.EDGE_SEED) : undefined;

// Generators that produce Command instances with random args.
const allCommands = [
  fc.record({ openingBalance: fc.integer({ min: 0, max: 500 }) }).map((a) => new CreateCustomer(a)),
  fc
    .record({ quantity: fc.integer({ min: 1, max: 5 }), unitPrice: fc.integer({ min: 1, max: 100 }) })
    .map((a) => new SaleCredit(a)),
  fc
    .record({ quantity: fc.integer({ min: 1, max: 5 }), unitPrice: fc.integer({ min: 1, max: 100 }) })
    .map((a) => new SaleCash(a)),
  fc.record({ amount: fc.integer({ min: 1, max: 200 }) }).map((a) => new Payment(a)),
];

describe("edge engine", () => {
  // Routes fire background work after responding (notifications/audit, some via a
  // lazy require). Let those settle before Jest tears the environment down, else
  // the late require throws "import after environment torn down".
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
  });

  test("invariants hold across random action sequences", async () => {
    await fc.assert(
      fc.asyncProperty(fc.commands(allCommands, { maxCommands: 40 }), async (cmds) => {
        const world = freshWorld();
        const real = { ...world, http: request(world.app) };
        const model = newModel();

        // fc.asyncModelRun replays only the applicable (check()===true) commands.
        const setup = () => ({ model, real });
        await fc.asyncModelRun(setup, cmds);

        checkInvariants(world.db, model);
      }),
      { numRuns: RUNS, seed: SEED, verbose: true },
    );
  }, TIMEOUT_MS);
});
