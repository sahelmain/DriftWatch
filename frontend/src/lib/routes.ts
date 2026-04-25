export const APP_ROUTES = {
  root: "/app",
  suites: "/app/suites",
  newSuite: "/app/suites/new",
  editSuite: (id: string) => `/app/suites/${id}/edit`,
  runs: "/app/runs",
  run: (id: string) => `/app/runs/${id}`,
  timeline: "/app/timeline",
  alerts: "/app/alerts",
  policies: "/app/policies",
  settings: "/app/settings",
} as const;

export const PUBLIC_ROUTES = {
  home: "/",
  demo: "/demo",
  truthfulQaResearch: "/research/truthfulqa",
  login: "/login",
} as const;
