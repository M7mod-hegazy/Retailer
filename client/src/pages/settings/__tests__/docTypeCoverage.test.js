import { describe, it, expect } from "vitest";
import { DOC_PAPER_CONFIG } from "../../../components/print/studio/studioData";
import { DOC_TYPES } from "@shared/docTypes";

describe("settings panel doc-type coverage", () => {
  it("every shared doc type has a paper config", () => {
    DOC_TYPES.forEach(t => expect(DOC_PAPER_CONFIG[t], `missing paper config: ${t}`).toBeTruthy());
  });
});
