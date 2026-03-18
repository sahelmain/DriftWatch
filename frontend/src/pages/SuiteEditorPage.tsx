import {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createSuite,
  getApiErrorMessage,
  getSuite,
  getSuiteValidationFromError,
  updateSuite,
  validateSuiteDraft,
} from "@/api";
import InlineBanner from "@/components/InlineBanner";
import { suiteTemplates } from "@/lib/suiteTemplates";
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
      const savedSuite = isEditing && id
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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-drift-400" size={32} />
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="space-y-6">
        {banner && <InlineBanner {...banner} onDismiss={() => setBanner(null)} />}
        <div className="card p-10 text-center">
          <h1 className="text-xl font-semibold text-white">Suite unavailable</h1>
          <p className="mt-2 text-sm text-gray-400">
            The editor could not load this suite.
          </p>
          <Link to={APP_ROUTES.suites} className="btn-secondary mt-6 inline-flex items-center gap-2">
            <ArrowLeft size={16} />
            Back to suites
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            to={APP_ROUTES.suites}
            className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
          >
            <ArrowLeft size={16} />
            Back to suites
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {isEditing ? "Edit Suite" : "New Suite"}
          </h1>
          <p className="text-sm text-gray-400">
            YAML stays the source of truth. Define support-QA rules, validate them, and ship them with confidence.
          </p>
        </div>
        <button
          type="submit"
          form="suite-editor-form"
          disabled={!canSave}
          className="btn-primary inline-flex items-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isEditing ? "Save changes" : "Create suite"}
        </button>
      </div>

      {banner && <InlineBanner {...banner} onDismiss={() => setBanner(null)} />}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2.2fr)_minmax(320px,1fr)]">
        <form id="suite-editor-form" onSubmit={handleSave} className="space-y-6">
          <div className="card p-6">
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
          </div>

          <div className="card p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Suite YAML</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Top-level YAML <code className="font-mono text-gray-300">name</code> is optional here. The saved suite name comes from the field above.
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
                    {validation.errors.length} issue{validation.errors.length === 1 ? "" : "s"}
                  </>
                )}
              </div>
            </div>

            <textarea
              className="input min-h-[520px] resize-y font-mono text-sm leading-6"
              value={yamlContent}
              onChange={(event) => setYamlContent(event.target.value)}
              spellCheck={false}
            />

            {yamlIssues.length > 0 && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <h3 className="text-sm font-semibold text-red-200">
                  YAML and assertion issues
                </h3>
                <div className="mt-3 space-y-2">
                  {yamlIssues.map((issue, index) => (
                    <div
                      key={`${issue.code}-${index}`}
                      className="rounded-lg bg-surface-950/70 px-3 py-2 text-sm text-red-100"
                    >
                      <p>{issue.message}</p>
                      {(issue.test_name || issue.line || issue.column) && (
                        <p className="mt-1 text-xs text-red-200/80">
                          {issue.test_name && <span>{issue.test_name}</span>}
                          {issue.line && <span>{issue.test_name ? " | " : ""}line {issue.line}</span>}
                          {issue.column && <span>, column {issue.column}</span>}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white">Starter templates</h2>
            <p className="mt-1 text-sm text-gray-400">
              Pick a supported template and adapt it to your prompt.
            </p>
            <div className="mt-4 space-y-3">
              {suiteTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    selectedTemplateId === template.id
                      ? "border-drift-500/50 bg-drift-500/10"
                      : "border-surface-700 bg-surface-900/60 hover:border-surface-600 hover:bg-surface-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{template.label}</p>
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
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white">Validation summary</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-300">
              <div className="flex items-center justify-between rounded-lg bg-surface-900/70 px-3 py-2">
                <span>Status</span>
                <span className={validation.valid ? "text-emerald-300" : "text-amber-300"}>
                  {validation.valid ? "Ready to save" : "Needs attention"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-surface-900/70 px-3 py-2">
                <span>Errors</span>
                <span>{validation.errors.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-surface-900/70 px-3 py-2">
                <span>Warnings</span>
                <span>{validation.warnings.length}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white">Suite summary</h2>
            {validation.suite_summary ? (
              <div className="mt-4 space-y-4 text-sm text-gray-300">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Tests</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {validation.suite_summary.test_count}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Models</p>
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
                  <p className="text-xs uppercase tracking-wider text-gray-500">Test names</p>
                  <div className="mt-2 space-y-2">
                    {validation.suite_summary.test_names.map((testName) => (
                      <div
                        key={testName}
                        className="rounded-lg bg-surface-900/70 px-3 py-2 text-sm text-gray-200"
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
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white">Web runtime support</h2>
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
          </div>
        </div>
      </div>
    </div>
  );
}
