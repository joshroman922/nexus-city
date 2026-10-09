import { test } from "node:test";
import assert from "node:assert/strict";
import { judgeChange, lastPrMarker, parseJob, prMarker, stateOf, stripMarkers } from "./lib.mjs";

test("small additive change lands on its own", () => {
  assert.deepEqual(judgeChange({ files: 3, deleted: [], lines: 40, question: null }), { auto: true, reasons: [] });
});

test("any deletion waits for Joshua", () => {
  const v = judgeChange({ files: 1, deleted: ["test.txt"], lines: 1, question: null });
  assert.equal(v.auto, false);
  assert.match(v.reasons[0], /deletes 1 file$/);
});

test("big changes and questions wait", () => {
  assert.equal(judgeChange({ files: 11, deleted: [], lines: 10, question: null }).auto, false);
  assert.equal(judgeChange({ files: 2, deleted: [], lines: 301, question: null }).auto, false);
  assert.equal(judgeChange({ files: 1, deleted: [], lines: 2, question: "Which one?" }).auto, false);
});

test("job marker must name a known repo", () => {
  const body = 'Fix it\n<!-- nexus:job {"lot":"maintain","repo":"maintain","kind":"fix","worker":"Ada"} -->';
  assert.equal(parseJob(body).repo, "maintain");
  assert.equal(parseJob(body.replace('"repo":"maintain"', '"repo":"someone-else"')), null);
  assert.equal(parseJob("no marker"), null);
  assert.equal(stripMarkers(body), "Fix it");
});

test("latest PR marker wins and state comes from nx: label", () => {
  const a = { repo: "maintain", number: 1, branch: "nexus/job-1" };
  const b = { ...a, number: 2 };
  assert.equal(lastPrMarker([{ body: prMarker(a) }, { body: "hi" }, { body: `x\n${prMarker(b)}` }]).number, 2);
  assert.equal(stateOf({ labels: [{ name: "nexus-job" }, { name: "nx:review" }] }), "review");
});
