import { describe, it, expect } from "vitest";
import { estimateContentHeight } from "../../../mcp-server/src/heightEstimator";

describe("estimateContentHeight", () => {
  it("returns 240 (DEFAULT_NODE_HEIGHT) for empty content", () => {
    expect(estimateContentHeight("")).toBe(240);
    expect(estimateContentHeight("   ")).toBe(240);
  });

  it("returns 240 for a single heading (below minimum)", () => {
    const md = "## Hello";
    // heading(28) + padding(48) = 76 → clamped to 240
    expect(estimateContentHeight(md)).toBe(240);
  });

  it("returns 240 for a heading with a few lines (still below minimum)", () => {
    const md = "## Title\n\nSome text\nAnother line";
    // heading(28) + blank(12) + body(22) + body(22) + padding(48) = 132 → clamped to 240
    expect(estimateContentHeight(md)).toBe(240);
  });

  it("grows beyond 240 for long content with code block", () => {
    const md = [
      "## kubectl Commands",
      "",
      "```bash",
      "kubectl get pods",
      "kubectl describe pod <name>",
      "kubectl logs <pod-name> -f",
      "kubectl apply -f deployment.yaml",
      "kubectl set image deployment/nginx nginx=nginx:1.25",
      "kubectl rollout status deployment/nginx",
      "kubectl rollout undo deployment/nginx",
      "kubectl exec -it <pod> -- /bin/sh",
      "kubectl port-forward pod/<pod> 8080:80",
      "kubectl top nodes / pods",
      "kubectl get pods -n kube-system",
      "kubectl create namespace staging",
      "```",
    ].join("\n");

    const height = estimateContentHeight(md);
    // heading(28) + blank(12) + 12 code lines(12*18=216) + code padding(16) + padding(48) = 320
    expect(height).toBeGreaterThan(240);
    expect(height).toBe(320);
  });

  it("accounts for bullet lists", () => {
    const md = [
      "## Features",
      "",
      "- Item one",
      "- Item two",
      "- Item three",
      "- Item four",
      "- Item five",
      "- Item six",
      "- Item seven",
      "- Item eight",
      "- Item nine",
      "- Item ten",
    ].join("\n");

    const height = estimateContentHeight(md);
    // heading(28) + blank(12) + 10 list items(10*24=240) + padding(48) = 328
    expect(height).toBeGreaterThan(240);
    expect(height).toBe(328);
  });

  it("accounts for table rows", () => {
    const md = [
      "## Comparison",
      "",
      "| Name | Value |",
      "|------|-------|",
      "| A    | 1     |",
      "| B    | 2     |",
      "| C    | 3     |",
    ].join("\n");

    const height = estimateContentHeight(md);
    // heading(28) + blank(12) + table header(36) + 3 rows(3*32=96) + padding(48) = 220 → clamped to 240
    expect(height).toBe(240);
  });

  it("handles blockquotes", () => {
    const md = "## Quote\n\n> This is a quote";
    const height = estimateContentHeight(md);
    // heading(28) + blank(12) + blockquote(22) + padding(48) = 110 → clamped to 240
    expect(height).toBe(240);
  });

  it("handles mixed content that exceeds minimum", () => {
    const md = [
      "# Big Title",
      "",
      "Some intro paragraph.",
      "",
      "- bullet 1",
      "- bullet 2",
      "- bullet 3",
      "",
      "```typescript",
      "const x = 1;",
      "const y = 2;",
      "const z = 3;",
      "console.log(x + y + z);",
      "```",
      "",
      "> Important note here",
      "",
      "Final paragraph.",
    ].join("\n");

    const height = estimateContentHeight(md);
    // h1(36) + blank(12) + body(22) + blank(12) + 3 list(3*24=72) + blank(12) +
    // 4 code(4*18=72) + code padding(16) + blank(12) + blockquote(22) + blank(12) +
    // body(22) + padding(48) = 370
    expect(height).toBeGreaterThan(240);
    expect(height).toBe(370);
  });
});
