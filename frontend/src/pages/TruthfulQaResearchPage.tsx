import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  ExternalLink,
  Gauge,
  Layers3,
  LineChart as LineChartIcon,
  ShieldAlert,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { APP_ROUTES, PUBLIC_ROUTES } from "@/lib/routes";
import {
  formatPercent,
  modelComparison,
  promptTemplates,
  researchCharts,
  truthfulStudy,
  vulnerableCategories,
} from "@/lib/truthfulQaResearch";

const templateChartData = promptTemplates.map((item) => ({
  ...item,
  label: item.template.replace(/_/g, " "),
  hallucinationPct: Math.round(item.hallucinationRate * 1000) / 10,
  accuracyPct: Math.round(item.accuracy * 1000) / 10,
}));

const bridgePoints = [
  {
    icon: BarChart3,
    title: "Slice risk by category",
    body: "The paper shows why one benchmark-wide score is too blunt. Production monitoring needs the same category-aware view.",
  },
  {
    icon: BrainCircuit,
    title: "Compare models and prompts",
    body: "Model size and prompt template both moved results. DriftWatch turns those choices into repeatable runs instead of one-off notes.",
  },
  {
    icon: LineChartIcon,
    title: "Keep watching after launch",
    body: "A study finds the pattern once. A monitoring workflow checks whether that pattern changes when the AI stack changes.",
  },
];

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-700 bg-surface-900/90 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export default function TruthfulQaResearchPage() {
  return (
    <div className="min-h-screen bg-surface-950 text-gray-100">
      <header className="border-b border-surface-800/80 bg-surface-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <Link
            to={PUBLIC_ROUTES.home}
            className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
          >
            <ArrowLeft size={15} />
            Back to DriftWatch
          </Link>
          <div className="flex items-center gap-3">
            <Link to={PUBLIC_ROUTES.demo} className="btn-secondary hidden sm:inline-flex">
              View Demo
            </Link>
            <a
              href={truthfulStudy.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-primary inline-flex items-center gap-2"
            >
              Paper repo
              <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-20">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-200">
              <ShieldAlert size={15} />
              Research-backed LLM risk map
            </div>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl">
                LLMs do not fail uniformly.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-gray-300">
                This TruthfulQA study evaluated local open-source models and found
                that hallucination risk clusters in specific question categories,
                prompt templates, and model choices. DriftWatch is the monitoring
                workflow for that same lesson.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {truthfulStudy.stats.map((stat) => (
                <MetricPill key={stat.label} label={stat.label} value={stat.value} />
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to={PUBLIC_ROUTES.demo} className="btn-primary inline-flex items-center gap-2 px-5 py-3">
                See it in DriftWatch
                <ArrowRight size={15} />
              </Link>
              <a
                href={truthfulStudy.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary inline-flex items-center gap-2 px-5 py-3"
              >
                Open the research repo
                <ExternalLink size={15} />
              </a>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-xl border border-surface-700 bg-surface-900 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-300">
                  <Gauge size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Corrected paper result</p>
                  <h2 className="text-xl font-semibold text-white">Global average hides the pattern</h2>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-red-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-red-200/80">
                    Hallucination rate
                  </p>
                  <p className="mt-2 text-4xl font-semibold text-red-200">
                    {formatPercent(truthfulStudy.global.hallucinationRate)}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-200/80">
                    Accuracy
                  </p>
                  <p className="mt-2 text-4xl font-semibold text-emerald-200">
                    {formatPercent(truthfulStudy.global.accuracy)}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-gray-400">
                The useful signal is not only the average. It is where the failures
                concentrate and whether that concentration changes over time.
              </p>
            </div>

            <div className="rounded-xl border border-surface-700 bg-surface-900 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-gray-500">
                Most vulnerable category
              </p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Confusion: People</h2>
                  <p className="mt-2 text-sm text-gray-400">
                    23 questions, 552 scored generations
                  </p>
                </div>
                <p className="text-4xl font-semibold text-orange-200">81.2%</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-xl border border-surface-700 bg-surface-800 p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-gray-500">
                    Category risk map
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Some categories break much harder than others
                  </h2>
                </div>
                <Layers3 className="text-orange-300" size={24} />
              </div>
              <div className="mt-6 space-y-4">
                {vulnerableCategories.map((item, index) => (
                  <div key={item.category}>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium text-gray-200">{item.category}</span>
                      <span className="text-orange-200">{formatPercent(item.hallucinationRate)}</span>
                    </div>
                    <div className="mt-2 h-3 rounded-full bg-surface-700">
                      <div
                        className={index < 3 ? "h-3 rounded-full bg-orange-400" : "h-3 rounded-full bg-amber-400"}
                        style={{ width: `${item.hallucinationRate * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{item.questions} TruthfulQA questions</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-surface-700 bg-surface-800 p-6">
              <div className="mb-5">
                <p className="text-xs uppercase tracking-[0.22em] text-gray-500">
                  Model and prompt findings
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Bigger and shorter were not automatically better
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {modelComparison.map((model) => (
                  <div key={model.model} className="rounded-xl border border-surface-700 bg-surface-900 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
                      {model.sizeClass}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{model.model}</h3>
                    <div className="mt-4 space-y-3 text-sm">
                      <div>
                        <div className="flex justify-between text-gray-400">
                          <span>Hallucination</span>
                          <span>{formatPercent(model.hallucinationRate)}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-surface-700">
                          <div
                            className="h-2 rounded-full bg-orange-400"
                            style={{ width: `${model.hallucinationRate * 100}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-gray-400">
                          <span>Accuracy</span>
                          <span>{formatPercent(model.accuracy)}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-surface-700">
                          <div
                            className="h-2 rounded-full bg-sky-400"
                            style={{ width: `${model.accuracy * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={templateChartData}>
                    <CartesianGrid stroke="#27324a" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="#8b9dc4" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} stroke="#8b9dc4" tickFormatter={(value) => `${value}%`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#10182b",
                        border: "1px solid #27324a",
                        borderRadius: "10px",
                      }}
                      formatter={(value: number) => [`${value}%`, "Rate"]}
                    />
                    <Line type="monotone" dataKey="hallucinationPct" stroke="#fb923c" strokeWidth={3} />
                    <Line type="monotone" dataKey="accuracyPct" stroke="#38bdf8" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-3">
            {bridgePoints.map((point) => (
              <div key={point.title} className="rounded-xl border border-surface-700 bg-surface-800 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-drift-500/10 text-drift-300">
                  <point.icon size={21} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{point.title}</h3>
                <p className="mt-3 text-sm leading-7 text-gray-400">{point.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <div className="rounded-xl border border-surface-700 bg-surface-800 p-6">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-gray-500">
                  Paper charts
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Original study visuals for the LinkedIn walkthrough
                </h2>
              </div>
              <p className="max-w-lg text-sm leading-7 text-gray-400">
                These static charts come from the corrected local paper artifacts
                and are included so the demo can move from research evidence to
                product workflow in one screen recording.
              </p>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              {researchCharts.map((chart) => (
                <figure key={chart.src} className="overflow-hidden rounded-xl border border-surface-700 bg-white">
                  <img src={chart.src} alt={chart.alt} className="h-64 w-full object-contain" />
                  <figcaption className="border-t border-surface-200 bg-surface-950 px-4 py-3 text-sm text-gray-300">
                    {chart.title}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="rounded-xl border border-drift-500/30 bg-drift-500/10 p-6">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 text-drift-200">
                  <Activity size={19} />
                  <p className="text-sm font-medium">From benchmark finding to production monitoring</p>
                </div>
                <h2 className="mt-3 max-w-3xl text-2xl font-semibold text-white">
                  DriftWatch turns category-level evaluation into a workflow you can rerun after every model, prompt, or provider change.
                </h2>
              </div>
              <Link to={APP_ROUTES.root} className="btn-primary inline-flex items-center gap-2">
                Open DriftWatch
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
