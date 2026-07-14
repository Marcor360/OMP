import {execFileSync} from "node:child_process";
import path from "node:path";

describe("collectionGroup index guard", () => {
  it("covers every audited query shape in firestore.indexes.json", () => {
    expect(() => execFileSync(process.execPath, [
      path.resolve("scripts/check-collection-group-indexes.mjs"),
    ])).not.toThrow();
  });

  it("rejects undeclared dynamic usage by policy", () => {
    const output = execFileSync(process.execPath, [
      path.resolve("scripts/check-collection-group-indexes.mjs"), "--self-test",
    ], {encoding: "utf8"});
    expect(output).toContain("dynamic allowlist self-test passed");
  });
});
