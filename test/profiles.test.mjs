import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");

function makeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    keys: () => [...map.keys()],
    snapshot: () => Object.fromEntries(map),
  };
}

function makeElement(id, handlers, extra = {}) {
  const base = {
    id,
    value: "",
    textContent: "",
    innerHTML: "",
    hidden: false,
    disabled: false,
    checked: false,
    max: "",
    dataset: {},
    style: {},
    children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener(type, fn) {
      (handlers[id] ||= {})[type] = fn;
    },
    removeEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    getAttribute: () => null,
    appendChild(child) {
      this.children.push(child);
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    focus() {},
    click() {},
    scrollIntoView() {},
    getBoundingClientRect: () => ({ width: 560, height: 300, top: 0, left: 0, right: 560, bottom: 300 }),
    getContext: () => new Proxy({}, { get: () => () => {} }),
    ...extra,
  };
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === "symbol") return undefined;
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
}

async function bootApp({ storage = makeStorage(), prompts = [], confirms = [] } = {}) {
  const html = await readFile(path.join(root, "index.html"), "utf-8");
  const blocks = [...html.matchAll(/<script>\n([\s\S]*?)\n<\/script>/g)].map((m) => m[1]);
  const appScript = blocks.at(-1);
  assert.ok(appScript.includes("childStore"), "앱 스크립트를 찾지 못했다");

  const handlers = {};
  const elements = new Map();
  const alerts = [];
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement(id, handlers));
    return elements.get(id);
  };

  const sandbox = {
    localStorage: storage,
    console,
    Math,
    Date,
    JSON,
    Intl,
    navigator: { language: "ko", share: undefined, clipboard: { writeText: async () => {} } },
    location: { origin: "https://example.test", pathname: "/", href: "https://example.test/" },
    alert: (msg) => alerts.push(msg),
    prompt: () => (prompts.length ? prompts.shift() : null),
    confirm: () => (confirms.length ? confirms.shift() : true),
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    setTimeout,
    clearTimeout,
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    ToddlerGrowth: require(path.join(root, "lib/growth.js")),
    ToddlerDosing: require(path.join(root, "lib/dosing.js")),
    document: {
      getElementById,
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: (tag) => makeElement(tag + ":created", handlers),
      createTextNode: (text) => makeElement("#text", handlers, { textContent: text }),
      createDocumentFragment: () => makeElement("#fragment", handlers),
      addEventListener() {},
      documentElement: makeElement("html", handlers),
      body: makeElement("body", handlers),
      title: "",
    },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  new vm.Script(appScript, { filename: "index.html:inline" }).runInContext(sandbox);

  return {
    storage,
    alerts,
    el: getElementById,
    fire(id, type = "click") {
      const fn = handlers[id]?.[type];
      assert.ok(fn, `${id}에 ${type} 핸들러가 없다`);
      fn({ target: getElementById(id) });
    },
    setAndFire(id, value, type = "change") {
      getElementById(id).value = value;
      this.fire(id, type);
    },
  };
}

test("첫 실행이면 아이 하나짜리 프로필이 생긴다", async () => {
  const app = await bootApp();
  assert.deepEqual(JSON.parse(app.storage.getItem("dev-profiles-v1")), [{ id: "1", name: "" }]);
  assert.equal(app.storage.getItem("dev-active-profile-v1"), "1");
  assert.equal(app.el("profile-bar").hidden, true);
});

test("기존 사용자의 단일 아이 데이터가 첫 프로필로 옮겨진다", async () => {
  const storage = makeStorage({
    "dev-child-birthdate": "2025-03-01",
    "dev-child-sex": "girl",
    "dev-regression-flag": "no",
    "dev-checklist-responses-v3": '{"12-0":true}',
    "dev-growth-log-v1": '[{"date":"2026-01-01","height":75,"weight":9.5}]',
  });
  const app = await bootApp({ storage });

  assert.equal(storage.getItem("dev-p1-child-birthdate"), "2025-03-01");
  assert.equal(storage.getItem("dev-p1-child-sex"), "girl");
  assert.equal(storage.getItem("dev-p1-regression-flag"), "no");
  assert.equal(storage.getItem("dev-p1-checklist-responses-v3"), '{"12-0":true}');
  assert.equal(JSON.parse(storage.getItem("dev-p1-growth-log-v1")).length, 1);

  for (const legacy of Object.keys(storage.snapshot())) {
    assert.ok(!/^dev-(child|regression|checklist|growth)/.test(legacy), `옛 키가 남음: ${legacy}`);
  }
  assert.equal(app.el("child-birthdate-input").value, "2025-03-01");
  assert.equal(app.el("child-sex-input").value, "girl");
});

test("아이를 추가하면 저장 키가 아이별로 갈린다", async () => {
  const app = await bootApp({ prompts: ["둘째"] });

  app.setAndFire("child-birthdate-input", "2024-01-15");
  app.setAndFire("child-sex-input", "boy");
  assert.equal(app.storage.getItem("dev-p1-child-birthdate"), "2024-01-15");

  app.fire("profile-add-btn");
  const profiles = JSON.parse(app.storage.getItem("dev-profiles-v1"));
  assert.deepEqual(profiles, [{ id: "1", name: "" }, { id: "2", name: "둘째" }]);
  assert.equal(app.storage.getItem("dev-active-profile-v1"), "2");

  assert.equal(app.el("child-birthdate-input").value, "");
  assert.equal(app.el("child-sex-input").value, "");

  app.setAndFire("child-birthdate-input", "2026-02-20");
  assert.equal(app.storage.getItem("dev-p2-child-birthdate"), "2026-02-20");
  assert.equal(app.storage.getItem("dev-p1-child-birthdate"), "2024-01-15");
  assert.equal(app.el("profile-bar").hidden, false);
});

test("아이를 바꾸면 그 아이의 기록을 다시 읽어온다", async () => {
  const app = await bootApp({ prompts: ["둘째"] });
  app.setAndFire("child-birthdate-input", "2024-01-15");
  app.fire("profile-add-btn");
  app.setAndFire("child-birthdate-input", "2026-02-20");

  app.setAndFire("profile-select", "1");
  assert.equal(app.el("child-birthdate-input").value, "2024-01-15");

  app.setAndFire("profile-select", "2");
  assert.equal(app.el("child-birthdate-input").value, "2026-02-20");
});

test("아이를 지우면 그 아이 기록만 지워진다", async () => {
  const app = await bootApp({ prompts: ["둘째"], confirms: [true] });
  app.setAndFire("child-birthdate-input", "2024-01-15");
  app.fire("profile-add-btn");
  app.setAndFire("child-birthdate-input", "2026-02-20");

  app.fire("profile-delete-btn");

  assert.equal(app.storage.getItem("dev-p2-child-birthdate"), null);
  assert.equal(app.storage.getItem("dev-p1-child-birthdate"), "2024-01-15");
  assert.deepEqual(JSON.parse(app.storage.getItem("dev-profiles-v1")), [{ id: "1", name: "" }]);
  assert.equal(app.storage.getItem("dev-active-profile-v1"), "1");
  assert.equal(app.el("child-birthdate-input").value, "2024-01-15");
});

test("아이가 하나뿐이면 삭제되지 않는다", async () => {
  const app = await bootApp();
  app.setAndFire("child-birthdate-input", "2024-01-15");

  app.fire("profile-delete-btn");

  assert.equal(app.alerts.length, 1);
  assert.equal(app.storage.getItem("dev-p1-child-birthdate"), "2024-01-15");
  assert.deepEqual(JSON.parse(app.storage.getItem("dev-profiles-v1")).length, 1);
});

test("지웠다 다시 추가한 아이가 지운 아이의 키를 물려받지 않는다", async () => {
  const app = await bootApp({ prompts: ["둘째", "셋째"], confirms: [true] });
  app.fire("profile-add-btn");
  app.setAndFire("child-birthdate-input", "2026-02-20");
  app.fire("profile-delete-btn");

  app.fire("profile-add-btn");
  const profiles = JSON.parse(app.storage.getItem("dev-profiles-v1"));
  assert.equal(profiles.at(-1).id, "3", "삭제된 id를 재사용하면 남은 키가 딸려온다");
  assert.equal(app.el("child-birthdate-input").value, "");
});

test("저장된 프로필 목록이 깨져 있어도 앱이 뜬다", async () => {
  for (const broken of ["not json", "null", '{"id":"1"}', '[null, 3, {"name":"이름만"}]']) {
    const app = await bootApp({ storage: makeStorage({ "dev-profiles-v1": broken }) });
    const profiles = JSON.parse(app.storage.getItem("dev-profiles-v1"));
    assert.ok(Array.isArray(profiles) && profiles.length >= 1, broken);
  }
});

test("언어와 약국 지역은 아이별이 아니라 기기 설정으로 남는다", async () => {
  const storage = makeStorage({ lang: "en", nearbyRegion: "busan" });
  const app = await bootApp({ storage, prompts: ["둘째"] });
  app.fire("profile-add-btn");
  assert.equal(app.storage.getItem("lang"), "en");
  assert.equal(app.storage.getItem("nearbyRegion"), "busan");
});
