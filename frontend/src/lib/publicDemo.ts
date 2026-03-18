import type { DriftScore, TestRun } from "@/types";

export const publicDemoSuite = {
  name: "Support refund reply QA",
  tagline:
    "Checks whether an AI support assistant gives a safe, policy-compliant refund response.",
  problem:
    "A customer says their package never arrived and asks for a refund. The assistant must mention the 30-day refund policy, ask for the order number, and avoid making promises support cannot guarantee.",
  yaml: `tests:
  - name: refund-policy-reply
    prompt: >
      A customer writes: "My package never arrived and I want a refund."
      Reply as a support assistant in under 80 words.
      Mention the 30-day refund policy and ask for the order number.
      Do not promise delivery dates you cannot verify.
    model: gemini-2.5-flash-lite
    assertions:
      - type: contains
        value: ["30-day refund policy", "order number"]
      - type: not_contains
        value: ["guarantee delivery tomorrow", "lifetime refund"]
      - type: max_length
        value: 320
`,
};

export const publicDemoHighlights = [
  {
    label: "What DriftWatch checks",
    value: "Required policy language, forbidden claims, and response length",
  },
  {
    label: "Why it matters",
    value: "A support AI can sound fluent and still violate product rules",
  },
  {
    label: "What changes over time",
    value: "Pass rate and drift score across repeated runs of the same suite",
  },
];

export const publicDemoRuns: TestRun[] = [
  {
    id: "9b805b5d-f2dd-43a4-97cb-5e5858c1d6f1",
    suite_id: "public-demo-suite",
    suite_name: publicDemoSuite.name,
    status: "passed",
    trigger: "manual",
    pass_rate: 100,
    total_tests: 1,
    passed_tests: 1,
    failed_tests: 0,
    duration_ms: 5400,
    started_at: "2026-03-17T15:10:00.000Z",
    completed_at: "2026-03-17T15:10:05.400Z",
    created_at: "2026-03-17T15:10:00.000Z",
    results: [
      {
        id: "ad2a77e5-73a8-4662-82d1-b5fda3511c68",
        run_id: "9b805b5d-f2dd-43a4-97cb-5e5858c1d6f1",
        test_name: "refund-policy-reply",
        model: "gemini-2.5-flash-lite",
        passed: true,
        output:
          "I can help with that. Our 30-day refund policy covers missing deliveries, and I can start the review once you share your order number.",
        latency_ms: 1420.6,
        tokens_used: 63,
        cost: null,
        assertions: [
          {
            name: "contains",
            type: "contains",
            passed: true,
            expected: '["30-day refund policy","order number"]',
            actual: "all found",
          },
          {
            name: "not_contains",
            type: "not_contains",
            passed: true,
            expected: 'none of ["guarantee delivery tomorrow","lifetime refund"]',
            actual: "none found",
          },
          {
            name: "max_length",
            type: "max_length",
            passed: true,
            expected: "<= 320 chars",
            actual: "130",
          },
        ],
      },
    ],
  },
  {
    id: "cfb7b631-0615-4f9a-a6b7-c59aa2f2491d",
    suite_id: "public-demo-suite",
    suite_name: publicDemoSuite.name,
    status: "failed",
    trigger: "manual",
    pass_rate: 0,
    total_tests: 1,
    passed_tests: 0,
    failed_tests: 1,
    duration_ms: 6180,
    started_at: "2026-03-18T09:22:00.000Z",
    completed_at: "2026-03-18T09:22:06.180Z",
    created_at: "2026-03-18T09:22:00.000Z",
    results: [
      {
        id: "3f5877dd-6311-441e-8749-fef252661df3",
        run_id: "cfb7b631-0615-4f9a-a6b7-c59aa2f2491d",
        test_name: "refund-policy-reply",
        model: "gemini-2.5-flash-lite",
        passed: false,
        output:
          "I can guarantee delivery tomorrow and issue a lifetime refund if it still does not show up.",
        latency_ms: 1688.3,
        tokens_used: 52,
        cost: null,
        assertions: [
          {
            name: "contains",
            type: "contains",
            passed: false,
            expected: '["30-day refund policy","order number"]',
            actual: '["30-day refund policy","order number"]',
            message:
              'Missing substrings: ["30-day refund policy","order number"]',
          },
          {
            name: "not_contains",
            type: "not_contains",
            passed: false,
            expected: 'none of ["guarantee delivery tomorrow","lifetime refund"]',
            actual: '["guarantee delivery tomorrow","lifetime refund"]',
            message:
              'Unwanted substrings found: ["guarantee delivery tomorrow","lifetime refund"]',
          },
          {
            name: "max_length",
            type: "max_length",
            passed: true,
            expected: "<= 320 chars",
            actual: "91",
          },
        ],
      },
    ],
  },
];

export const publicDemoTimeline: DriftScore[] = [
  {
    date: "2026-03-14T12:00:00.000Z",
    pass_rate: 1,
    drift_score: 0,
    run_id: "a1",
    total_tests: 1,
    failed_tests: 0,
  },
  {
    date: "2026-03-15T12:00:00.000Z",
    pass_rate: 1,
    drift_score: 0,
    run_id: "a2",
    total_tests: 1,
    failed_tests: 0,
  },
  {
    date: "2026-03-16T12:00:00.000Z",
    pass_rate: 1,
    drift_score: 0,
    run_id: "a3",
    total_tests: 1,
    failed_tests: 0,
  },
  {
    date: "2026-03-17T15:10:05.400Z",
    pass_rate: 1,
    drift_score: 0,
    run_id: publicDemoRuns[0]!.id,
    total_tests: 1,
    failed_tests: 0,
  },
  {
    date: "2026-03-18T09:22:06.180Z",
    pass_rate: 0,
    drift_score: 1,
    run_id: publicDemoRuns[1]!.id,
    total_tests: 1,
    failed_tests: 1,
  },
];
