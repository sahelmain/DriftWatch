import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Clock,
  FlaskConical,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { deleteSuite, getApiErrorMessage, getSuites, triggerRun } from "@/api";
import InlineBanner from "@/components/InlineBanner";
import type { BannerState, Suite } from "@/types";

interface SuitesLocationState {
  banner?: BannerState;
}

export default function SuitesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [suites, setSuites] = useState<Suite[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [runningSuiteId, setRunningSuiteId] = useState<string | null>(null);
  const [deletingSuiteId, setDeletingSuiteId] = useState<string | null>(null);
  const [bannerActionLoading, setBannerActionLoading] = useState(false);

  useEffect(() => {
    const state = location.state as SuitesLocationState | null;
    if (state?.banner) {
      setBanner(state.banner);
      navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: null,
      });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    loadSuites();
  }, []);

  async function loadSuites() {
    setLoading(true);
    try {
      const data = await getSuites();
      setSuites(data);
    } catch (error) {
      setBanner({
        variant: "error",
        title: "Unable to load suites",
        message: getApiErrorMessage(
          error,
          "The suite list could not be loaded.",
        ),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this suite?")) {
      return;
    }

    setDeletingSuiteId(id);
    try {
      await deleteSuite(id);
      setSuites((current) => current.filter((suite) => suite.id !== id));
      setBanner({
        variant: "success",
        title: "Suite deleted",
        message: "The suite was removed from the active list.",
      });
    } catch (error) {
      setBanner({
        variant: "error",
        title: "Unable to delete suite",
        message: getApiErrorMessage(
          error,
          "The suite could not be deleted.",
        ),
      });
    } finally {
      setDeletingSuiteId(null);
    }
  }

  async function handleRun(id: string) {
    if (runningSuiteId === id) {
      return;
    }

    setRunningSuiteId(id);
    try {
      const run = await triggerRun(id);
      navigate(`/runs/${run.id}`);
    } catch (error) {
      setBanner({
        variant: "error",
        title: "Unable to start run",
        message: getApiErrorMessage(
          error,
          "The run could not be started.",
        ),
      });
    } finally {
      setRunningSuiteId(null);
    }
  }

  async function handleBannerAction() {
    if (!banner?.actionSuiteId) {
      return;
    }

    setBannerActionLoading(true);
    try {
      const run = await triggerRun(banner.actionSuiteId);
      navigate(`/runs/${run.id}`);
    } catch (error) {
      setBanner({
        variant: "error",
        title: "Unable to start run",
        message: getApiErrorMessage(
          error,
          "The run could not be started.",
        ),
      });
    } finally {
      setBannerActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-drift-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Test Suites</h1>
          <p className="mt-1 text-gray-400">
            Build, validate, and launch supported web-runtime suites.
          </p>
        </div>
        <button
          onClick={() => navigate("/suites/new")}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus size={16} />
          New Suite
        </button>
      </div>

      {banner && (
        <InlineBanner
          {...banner}
          actionLoading={bannerActionLoading}
          onAction={banner.actionSuiteId ? handleBannerAction : undefined}
          onDismiss={() => setBanner(null)}
        />
      )}

      {suites.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="table-header">Name</th>
                <th className="table-header">Schedule</th>
                <th className="table-header">Created</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suites.map((suite) => (
                <tr
                  key={suite.id}
                  className="cursor-pointer border-b border-surface-700/50 transition-colors hover:bg-surface-800/50"
                  onClick={() => navigate(`/timeline?suite=${suite.id}`)}
                >
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-drift-500/10">
                        <FlaskConical size={16} className="text-drift-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white">{suite.name}</p>
                        {suite.description && (
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {suite.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    {suite.schedule_cron ? (
                      <span className="flex items-center gap-1.5 text-gray-300">
                        <Clock size={13} className="text-gray-500" />
                        {suite.schedule_cron}
                      </span>
                    ) : (
                      <span className="text-gray-500">Manual</span>
                    )}
                  </td>
                  <td className="table-cell text-gray-400">
                    {format(new Date(suite.created_at), "MMM dd, HH:mm")}
                  </td>
                  <td className="table-cell text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        onClick={() => handleRun(suite.id)}
                        disabled={runningSuiteId === suite.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-drift-500/10 px-3 py-2 text-sm font-medium text-drift-300 transition-colors hover:bg-drift-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {runningSuiteId === suite.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Play size={14} />
                        )}
                        {runningSuiteId === suite.id ? "Starting" : "Run"}
                      </button>
                      <button
                        onClick={() => navigate(`/suites/${suite.id}/edit`)}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-surface-700 hover:text-gray-200"
                        aria-label={`Edit ${suite.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(suite.id)}
                        disabled={deletingSuiteId === suite.id}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={`Delete ${suite.name}`}
                      >
                        {deletingSuiteId === suite.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-16 text-center">
          <FlaskConical className="mx-auto mb-4 text-gray-600" size={48} />
          <h3 className="text-lg font-medium text-gray-300">No test suites yet</h3>
          <p className="mx-auto mt-2 max-w-md text-gray-500">
            Start with a supported template, validate the YAML, and launch your first run from the suite editor.
          </p>
          <button
            onClick={() => navigate("/suites/new")}
            className="btn-primary mt-6 inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Create Suite
          </button>
        </div>
      )}
    </div>
  );
}
