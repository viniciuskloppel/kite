import { before, describe, test } from "node:test";
import assert from "node:assert";
import { Address } from "@solana/kit";
import { getPDAAndBump } from "../lib/pdas";

describe("getPDAAndBump", () => {
  test("getPDAAndBump returns the same as the web3.js v1 equivalent code", async () => {
    const aliceAddress = "qbuMdeYxYJXBjU6C6qFKjZKjXmrU83eDQomHdrch826" as Address;
    const programAddress = "CXSfSLuAf6gtkGBH6i1kyRXFtH7CqNRHnPMo39AFKn6X" as Address;
    const offerId = 420n;
    const { pda, bump } = await getPDAAndBump(programAddress, ["offer", aliceAddress, offerId]);

    assert.equal(pda.toString(), "GNhnD5ucxtTkuX4raePZxo4spK27t4qzBMHgscSYyLS3");
    assert.equal(bump, 253);
  });
});
