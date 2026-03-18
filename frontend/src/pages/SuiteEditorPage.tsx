import {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileCode2,
  Layers3,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import {
  createSuite,
  getApiErrorMessage,
  getSuite,
  getSuiteValidationFromError,
  updateSuite,
  validateSuiteDraft,
} from "@/api";
import EmptyStatePanel from "@/components/EmptyStatePanel";
import InlineBanner from "@/components/InlineBanner";
import PageHero from "@/components/PageHero";
import SignalCard from "@/components/SignalCard";
import { suiteTemplates } from "@/lib/suiteTemplates";
import {
  monitoringToneStyles,
  type MonitoringTone,
} from "@/lib/monitoringTone";
import { APP_ROUTES } from "@/lib/routes";
import type {
  BannerState,
  SuiteDraft,
  SuiteValidationResponse,
  ValidationIssue,
} from "@/types";

const DEFAULT_TEMPLATE = suiteTemplates[0]!;

const EMPTY_VALIDATION: SuiteValidationResponse = {
  valid: false,
  errors: [],
  warnings: [],
  supported_assertions: [],
  unsupported_assertions: [],
};

interface EditorPosture {
  tone: MonitoringTone;
  label: string;
  title: string;
  description: string;
  insight: string;
}

function buildEditorPosture(options: {
  isEditing: boolean;
  isValidating: boolean;
  validation: SuiteValidationResponse;
}): EditorPosture {
  const { isEditing, isValidating, validation } = options;

  if (isValidating) {
    return {
      tone: "active",
      label: "In motion",
      title: isEditing
        ? "Your suite draft is being re-validated"
        : "Your new suite draft is being checked in real time",
      description:
        "The editor is validating YAML structure, supported assertions, and schedule syntax before save so the runtime does not reject the suite later.",
      insight:
        "Keep the YAML clean and the web runtime subset supported. This is where unsupported assertions are blocked before they become confusing execution failures.",
    };
  }

  if (validation.valid) {
    return {
      tone: "healthy",
      label: "Healthy",
      title: isEditing
        ? "This suite is ready to be saved back into the roster"
        : "This suite draft is ready to become a live monitor",
      description:
        "The editor accepts the current YAML, the current assertion mix is supported by the web runtime, and the parsed suite summary is ready for save.",
      insight:
        "Treat this page as a quality gate for authoring. A valid draft here should translate into a clean run flow after save.",
    };
  }

  if (validation.errors.length > 0) {
    return {
      tone: "attention",
      label: "Needs attention",
      title: isEditing
        ? "This suite has blocking issues that must be resolved before save"
        : "This draft still has blocking issues before it can become a suite",
      description:
        "The editor found validation or assertion problems. Fix them here so the suite does not fail later with preventable runtime errors.",
      insight:
        "The most important issues are the ones tied to YAML structure or unsupported assertions. Fix those first; the rest usually falls into place.",
    };
  }

  return {
    tone: "quiet",
    label: "No recent signal",
    title: isEditing
      ? "The editor is ready for changes"
      : "Start shaping this suite from a supported template",
    description:
      "YAML remains the source of truth. Use the guided validation panel and supported templates to move from idea to runnable suite without guessing the schema.",
    insight:
      "A strong suite is specific, readable, and backed by assertions the web runtime can actually execute today.",
  };
}

function FieldIssues({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1">
      {issues.map((issue, index) => (
        <p key={`${issue.code}-${index}`} className="text-sm text-red-300">
          {issue.message}
        </p>
      ))}
    </div>
  );
}

export default function SuiteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(isEditing);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [validation, setValidation] =
    useState<SuiteValidationResponse>(EMPTY_VALIDATION);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [yamlContent, setYamlContent] = useState(DEFAULT_TEMPLATE.yaml);
  const [schedule, setSchedule] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    DEFAULT_TEMPLATE.id,
  );

  const deferredName = useDeferredValue(name);
  const deferredYamlContent = useDeferredValue(yamlContent);
  const deferredSchedule = useDeferredValue(schedule);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadFailed(false);
    setBanner(null);

    getSuite(id)
      .then((suite) => {
        if (!active) {
          return;
        }
        setName(suite.name);
        setDescription(suite.description || "");
        setYamlContent(suite.yaml_content || DEFAULT_TEMPLATE.yaml);
        setSchedule(suite.schedule_cron || "");
        setSelectedTemplateId("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setLoadFailed(true);
        setBanner({
          variant: "error",
          title: "Unable to load suite",
          message: getApiErrorMessage(error, "The suite could not be loaded."),
        });
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (loading) {
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(() => {
      setIsValidating(true);
      validateSuiteDraft({
        name: deferredName,
        description,
        yaml_content: deferredYamlContent,
        schedule_cron: deferredSchedule || undefined,
      })
        .then((result) => {
          if (!active) {
            return;
          }
          startTransition(() => {
            setValidation(result);
          });
        })
        .catch((error) => {
          if (!active) {
            return;
          }
          const validationFromError = getSuiteValidationFromError(error);
          if (validationFromError) {
            startTransition(() => {
              setValidation(validationFromError);
            });
            return;
          }
          setBanner({
            variant: "error",
            title: "Validation request failed",
            message: getApiErrorMessage(
              error,
              "We could not validate the draft right now.",
            ),
          });
        })
        .finally(() => {
          if (active) {
            setIsValidating(false);
          }
        });
    }, 450);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [deferredName, deferredSchedule, deferredYamlContent, description, loading]);

  const nameIssues = validation.errors.filter((issue) => issue.field === "name");
  const scheduleIssues = validation.errors.filter(
    (issue) => issue.field === "schedule_cron",
  );
  const yamlIssues = validation.errors.filter(
    (issue) => issue.field === "yaml_content" || issue.field === "assertions",
  );
  const canSave = !loading && !saving && !isValidating && validation.valid;
  const posture = buildEditorPosture({
    isEditing,
    isValidating,
    validation,
  });
  const postureTone = monitoringToneStyles[posture.tone];
  const parsedModels = validation.suite_summary?.models.length ?? 0;
  const parsedTests = validation.suite_summary?.test_count ?? 0;

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);

    if (!canSave) {
      setBanner({
        variant: "warning",
        title: "Resolve validation issues first",
        message: "The suite can only be saved once the draft is valid.",
      });
      return;
    }

    const payload: SuiteDraft = {
      name,
      description,
      yaml_content: yamlContent,
      schedule_cron: schedule || undefined,
    };

    setSaving(true);
    try {
      const savedSuite =
        isEditing && id
          ? await updateSuite(id, payload)
          : await createSuite(payload);
      navigate(APP_ROUTES.suites, {
        replace: true,
        state: {
          banner: isEditing
            ? {
                variant: "success",
                title: "Suite updated",
                message: `${savedSuite.name} is ready.`,
              }
            : {
                variant: "success",
                title: "Suite created",
                message: `${savedSuite.name} is ready to run.`,
                actionLabel: "Run now",
                actionSuiteId: savedSuite.id,
              },
        },
      });
    } catch (error) {
      const validationFromError = getSuiteValidationFromError(error);
      if (validationFromError) {
        setValidation(validationFromError);
      }
      setBanner({
        variant: "error",
        title: "Unable to save suite",
        message: validationFromError
          ? "Please fix the validation issues and try again."
          : getApiErrorMessage(error, "The suite could not be saved."),
      });
    } finally {
      setSaving(false);
    }
  }

  function handleTemplateSelect(templateId: string) {
    const template = suiteTemplates.find((entry) => entry.id === templateId);
    if (!template) {
      return;
    }
    setSelectedTemplateId(template.id);
    setYamlContent(template.yaml);
    setBanner({
      variant: "info",
      title: `Template applied: ${template.label}`,
      message: template.description,
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse rounded-[28px] border border-surface-700 bg-surface-800/80 p-8">
          <div className="h-5 w-40 rounded bg-surface-700" />
          <div className="mt-4 h-10 w-2/3 rounded bg-surface-700" />
          <div className="mt-3 h-4 w-3/4 rounded bg-surface-700" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-[24px] border border-surface-700 bg-surface-800/80 p-5"
            >
              <div className="h-4 w-24 rounded bg-surface-700" />
              <div className="mt-3 h-8 w-24 rounded bg-surface-700" />
              <div className="mt-3 h-3 w-36 rounded bg-surface-700" />
            </div>
          ))}
        </div>
        <div className="flex h-48 items-center justify-center rounded-[24px] border border-surface-700 bg-surface-800/80">
          <Loader2 className="animate-spin text-drift-400" size={32} />
        </div>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="space-y-6">
        {banner && <InlineBanner {...banner} onDismiss={() => setBanner(null)} />}
        <EmptyStatePanel
          icon={TriangleAlert}
          title="Suite unavailable"
          description="The editor could not load this suite. Return to the roster and try opening it again once the API is reachable."
          actions={
            <Link
              to={APP_ROUTES.suites}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Back to suites
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        tone={posture.tone}
        label={posture.label}
        title={posture.title}
        description={posture.description}
        insight={posture.insight}
        badgeIcon={Sparkles}
        actions={
          <>
            <Link
              to={APP_ROUTES.suites}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Back to suites
            </Link>
            <button
              type="submit"
              form="suite-editor-form"
              disabled={!canSave}
              className="btn-primary inline-flex items-center gap-2"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {isEditing ? "Save changes" : "Create suite"}
            </button>
          </>
        }
        aside={
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                  Editor posture
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">
                  Current draft state
                </h2>
              </div>
              <div className={clsx("rounded-2xl p-3", postureTone.icon)}>
                <ShieldCheck size={20} />
              </div>
            </div>

            {[
              {
                label: "Mode",
                value: isEditing ? "Editing" : "Creating",
                helper: isEditing
                  ? "This draft is loaded from an existing suite"
                  : "This draft starts from a guided template",
                tone: "quiet" as const,
              },
              {
                label: "Validation",
                value: isValidating
                  ? "Checking"
                  : validation.valid
                    ? "Ready"
                    : `${validation.errors.length} issue${
                        validation.errors.length === 1 ? "" : "s"
                      }`,
                helper:
                  validation.errors.length === 0
                    ? "Blocking validation is currently clear"
                    : "Resolve YAML or assertion issues before saving",
                tone: posture.tone,
              },
              {
                label: "Supported templates",
                value: `${suiteTemplates.length}`,
                helper: "Use these to avoid guessing the YAML shape",
                tone: "healthy" as const,
              },
            ].map((item) => {
              const tone = monitoringToneStyles[item.tone];
              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-surface-700/80 bg-surface-950/40 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-200">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">{item.helper}</p>
                    </div>
                    <span
                      className={clsx(
                        "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                        tone.badge,
                      )}
                    >
                      {item.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        }
      />

      {banner && <InlineBanner {...banner} onDismiss={() => setBanner(null)} />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SignalCard
          label="Save readiness"
          value={
            isValidating
              ? "Checking"
              : validation.valid
                ? "Ready"
                : "Blocked"
          }
          helper={
            validation.valid
              ? "The draft passes current web-runtime validation"
              : "Save remains disabled until blocking issues are resolved"
          }
          icon={CheckCircle2}
          tone={
            isValidating ? "amber" : validation.valid ? "green" : "red"
          }
        />
        <SignalCard
          label="Parsed tests"
          value={parsedTests > 0 ? String(parsedTests) : "No preview"}
          helper={
            parsedTests > 0
              ? "Tests currently visible in the parsed suite summary"
              : "Valid YAML will unlock the suite summary preview"
          }
          icon={Layers3}
          tone={parsedTests > 0 ? "blue" : "violet"}
        />
        <SignalCard
          label="Models referenced"
          value={parsedModels > 0 ? String(parsedModels) : "None yet"}
          helper={
            parsedModels > 0
              ? "Unique models found in the current suite draft"
              : "Model inventory appears once the suite parses cleanly"
          }
          icon={FileCode2}
          tone={parsedModels > 0 ? "green" : "amber"}
        />
        <SignalCard
          label="Blocked assertions"
          value={String(validation.unsupported_assertions.length)}
          helper={
            validation.unsupported_assertions.length === 0
              ? "Current draft stays within the supported web subset"
              : "Unsupported assertions must be removed or replaced"
          }
          icon={TriangleAlert}
          tone={validation.unsupported_assertions.length === 0 ? "green" : "red"}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2.15fr)_minmax(340px,1fr)]">
        <form id="suite-editor-form" onSubmit={handleSave} className="space-y-6">
          <section className="surface-panel p-6">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Suite metadata
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Describe what this suite protects
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                Keep the suite name and context clear so operators can understand what failed without reading the YAML first.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-200">
                  Name
                </label>
                <input
                  className="input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Customer support regression checks"
                />
                <FieldIssues issues={nameIssues} />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-200">
                  Description
                </label>
                <input
                  className="input"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional context for the team"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-200">
                  Schedule (cron)
                </label>
                <input
                  className="input"
                  value={schedule}
                  onChange={(event) => setSchedule(event.target.value)}
                  placeholder="0 * * * *"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Leave blank for manual runs. Cron uses standard five-field crontab syntax.
                </p>
                <FieldIssues issues={scheduleIssues} />
              </div>
            </div>
          </section>

          <section className="surface-panel p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  YAML source of truth
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Author the suite
                </h2>
                <p className="mt-2 text-sm text-gray-400">
                  Top-level YAML <code className="font-mono text-gray-300">name</code> is optional here. The suite name above is used as the saved display name.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-surface-900 px-3 py-1.5 text-xs text-gray-400">
                {isValidating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Validating
                  </>
                ) : validation.valid ? (
                  <>
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    Draft valid
                  </>
                ) : (
                  <>
                    <Sparkles size={13} className="text-amber-400" />
                    {validation.errors.length} issue
                    {validation.errors.length === 1 ? "" : "s"}
                  </>
                )}
              </div>
            </div>

            <textarea
              className="input min-h-[620px] resize-y bg-[#09101e] font-mono text-sm leading-6"
              value={yamlContent}
              onChange={(event) => setYamlContent(event.target.value)}
              spellCheck={false}
            />

            {yamlIssues.length > 0 && (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                <h3 className="text-sm font-semibold text-red-200">
                  YAML and assertion issues
                </h3>
                <div className="mt-3 space-y-2">
                  {yamlIssues.map((issue, index) => (
                    <div
                      key={`${issue.code}-${index}`}
                      className="rounded-xl bg-surface-950/70 px-3 py-3 text-sm text-red-100"
                    >
                      <p>{issue.message}</p>
                      {(issue.test_name || issue.line || issue.column) && (
                        <p className="mt-1 text-xs text-red-200/80">
                          {issue.test_name && <span>{issue.test_name}</span>}
                          {issue.line && (
                            <span>{issue.test_name ? " | " : ""}line {issue.line}</span>
                          )}
                          {issue.column && <span>, column {issue.column}</span>}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </form>

        <div className="space-y-6">
          <section className="surface-panel p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Starter templates
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Start from a supported pattern
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              These templates are already aligned with the current web runtime subset.
            </p>
            <div className="mt-4 space-y-3">
              {suiteTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template.id)}
                  className={clsx(
                    "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                    selectedTemplateId === template.id
                      ? "border-drift-500/50 bg-drift-500/10"
                      : "border-surface-700 bg-surface-900/60 hover:border-surface-600 hover:bg-surface-900",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {template.label}
                      </p>
                      <p className="mt-1 text-sm text-gray-400">
                        {template.description}
                      </p>
                    </div>
                    {selectedTemplateId === template.id && (
                      <CheckCircle2 size={16} className="mt-0.5 text-drift-300" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="surface-panel p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Draft health
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Validation summary
            </h2>
            <div className="mt-4 space-y-3 text-sm text-gray-300">
              {[
                {
                  label: "Status",
                  value: validation.valid ? "Ready to save" : "Needs attention",
                },
                {
                  label: "Errors",
                  value: String(validation.errors.length),
                },
                {
                  label: "Warnings",
                  value: String(validation.warnings.length),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl bg-surface-900/70 px-3 py-3"
                >
                  <span>{item.label}</span>
                  <span
                    className={clsx(
                      "font-medium",
                      item.label === "Status" && validation.valid
                        ? "text-emerald-300"
                        : item.label === "Status"
                          ? "text-amber-300"
                          : "text-white",
                    )}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-panel p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Parsed preview
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Suite summary
            </h2>
            {validation.suite_summary ? (
              <div className="mt-4 space-y-4 text-sm text-gray-300">
                <div className="surface-panel-muted p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500">
                    Tests
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {validation.suite_summary.test_count}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">
                    Models
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {validation.suite_summary.models.map((model) => (
                      <span
                        key={model}
                        className="rounded-full bg-surface-900 px-3 py-1 text-xs text-gray-300"
                      >
                        {model}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">
                    Test names
                  </p>
                  <div className="mt-2 space-y-2">
                    {validation.suite_summary.test_names.map((testName) => (
                      <div
                        key={testName}
                        className="rounded-xl bg-surface-900/70 px-3 py-3 text-sm text-gray-200"
                      >
                        {testName}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                Add valid YAML to preview the parsed suite summary.
              </p>
            )}
          </section>

          <section className="surface-panel p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Runtime support
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Web executor coverage
            </h2>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Supported assertions
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {validation.supported_assertions.map((assertion) => (
                  <span
                    key={assertion}
                    className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200"
                  >
                    {assertion}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Blocked in the web editor
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {validation.unsupported_assertions.map((assertion) => (
                  <span
                    key={assertion}
                    className="rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-200"
                  >
                    {assertion}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
