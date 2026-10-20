import test from "node:test";
import assert from "node:assert/strict";
import { assertDemoEnvironment } from "../src/config/demo.js";

test("demo accepts only its dedicated loopback database and origin", () => {
  assert.doesNotThrow(() => assertDemoEnvironment("mongodb://127.0.0.1:27018/zonify_demo", "http://127.0.0.1:3001", "127.0.0.1"));
  for (const uri of ["mongodb://127.0.0.1:27017/zonify", "mongodb://example.com/zonify_demo", "mongodb://127.0.0.1/zonify_demo?authSource=zonify", "mongodb://user:pass@127.0.0.1/zonify_demo", "mongodb://127.0.0.1/zonify_demo,zonify"]) {
    assert.throws(() => assertDemoEnvironment(uri, "http://127.0.0.1:3001", "127.0.0.1"));
  }
  assert.throws(() => assertDemoEnvironment("mongodb://127.0.0.1/zonify_demo", "https://public.example.com", "127.0.0.1"));
  assert.throws(() => assertDemoEnvironment("mongodb://127.0.0.1/zonify_demo", "http://127.0.0.1:3001", "0.0.0.0"));
});
