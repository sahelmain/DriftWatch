export interface SuiteTemplate {
  id: string;
  label: string;
  description: string;
  yaml: string;
}

export const suiteTemplates: SuiteTemplate[] = [
  {
    id: "basic",
    label: "Basic checks",
    description: "Starter template for contains and max-length assertions.",
    yaml: `tests:
  - name: greeting-check
    prompt: "Say hello to the DriftWatch team in one sentence."
    model: gpt-4o
    assertions:
      - type: contains
        value: ["hello", "DriftWatch"]
      - type: max_length
        value: 140
`,
  },
  {
    id: "json",
    label: "JSON schema",
    description: "Validate structured output against a JSON schema.",
    yaml: `tests:
  - name: structured-profile
    prompt: "Return a JSON object with keys name, role, and location for Ada Lovelace."
    model: gpt-4o
    assertions:
      - type: json_schema
        schema:
          type: object
          required: ["name", "role", "location"]
          properties:
            name:
              type: string
            role:
              type: string
            location:
              type: string
`,
  },
  {
    id: "latency-cost",
    label: "Latency and cost",
    description: "Track response speed and budget for a production prompt.",
    yaml: `tests:
  - name: concise-summary
    prompt: "Summarize the latest support ticket in under 50 words."
    model: gpt-4o
    assertions:
      - type: max_length
        value: 220
      - type: latency
        threshold_ms: 1500
      - type: cost
        budget: 0.02
`,
  },
  {
    id: "blank",
    label: "Blank",
    description: "Start from a minimal supported suite.",
    yaml: `tests:
  - name: my-test
    prompt: ""
    model: gpt-4o
    assertions:
      - type: contains
        value: [""]
`,
  },
];
