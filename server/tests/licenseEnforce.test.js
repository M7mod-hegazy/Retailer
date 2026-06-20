// Fix #3: server-side license enforcement middleware.

const RUNTIME = "../../shared/licensing/runtime";
const GATE = "../../electron/licenseGate";
const MW = "../src/middleware/licenseEnforce";

function load({ packaged, status }) {
  jest.resetModules();
  jest.doMock(RUNTIME, () => ({ isPackagedApp: () => packaged }));
  jest.doMock(GATE, () => ({
    getStatus: () => {
      if (status instanceof Error) throw status;
      return status;
    },
  }));
  return require(MW).licenseEnforce;
}

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

afterEach(() => jest.resetModules());

test("dev/web/tests (not packaged): always passes through, never reads the gate", () => {
  const mw = load({ packaged: false, status: new Error("should not be called") });
  const next = jest.fn();
  const res = fakeRes();
  mw({}, res, next);
  expect(next).toHaveBeenCalled();
  expect(res.statusCode).toBeNull();
});

test("packaged + activated: passes through", () => {
  const mw = load({ packaged: true, status: { activated: true } });
  const next = jest.fn();
  const res = fakeRes();
  mw({}, res, next);
  expect(next).toHaveBeenCalled();
});

test("packaged + not activated: blocks with 403 and does not call next", () => {
  const mw = load({ packaged: true, status: { activated: false, reason: "no_license" } });
  const next = jest.fn();
  const res = fakeRes();
  mw({}, res, next);
  expect(next).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(403);
  expect(res.body).toEqual({ success: false, error: "license_required", reason: "no_license" });
});

test("packaged + gate throws: fails CLOSED (403)", () => {
  const mw = load({ packaged: true, status: new Error("boom") });
  const next = jest.fn();
  const res = fakeRes();
  mw({}, res, next);
  expect(next).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(403);
  expect(res.body.reason).toBe("gate_error");
});
