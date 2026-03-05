from __future__ import annotations

import yaml
from apscheduler.triggers.cron import CronTrigger
from pydantic import ValidationError

from app.schemas import SuiteSummary, SuiteValidationResponse, ValidationIssue
from driftwatch.core.suite_loader import load_suite_content, validate_suite

SUPPORTED_WEB_ASSERTIONS = frozenset(
    {
        "max_length",
        "min_length",
        "contains",
        "not_contains",
        "regex",
        "exact_match",
        "json_schema",
        "latency",
        "cost",
    }
)
UNSUPPORTED_WEB_ASSERTIONS = frozenset({"semantic_similarity", "llm_judge", "custom"})


def validate_suite_draft(
    *,
    name: str | None,
    yaml_content: str | None,
    schedule_cron: str | None,
) -> SuiteValidationResponse:
    errors: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []
    suite_summary: SuiteSummary | None = None

    if not (name or "").strip():
        errors.append(_issue(field="name", code="required", message="Suite name is required."))

    if not (yaml_content or "").strip():
        errors.append(_issue(field="yaml_content", code="required", message="YAML configuration is required."))
    else:
        suite_summary, yaml_errors = _validate_yaml_content(yaml_content, suite_name=name)
        errors.extend(yaml_errors)

    if schedule_cron and schedule_cron.strip():
        try:
            CronTrigger.from_crontab(schedule_cron.strip())
        except Exception as exc:
            errors.append(
                _issue(
                    field="schedule_cron",
                    code="invalid_cron",
                    message=f"Invalid cron expression: {exc}",
                )
            )

    return SuiteValidationResponse(
        valid=not errors,
        errors=errors,
        warnings=warnings,
        supported_assertions=sorted(SUPPORTED_WEB_ASSERTIONS),
        unsupported_assertions=sorted(UNSUPPORTED_WEB_ASSERTIONS),
        suite_summary=suite_summary,
    )


def _validate_yaml_content(raw: str, *, suite_name: str | None) -> tuple[SuiteSummary | None, list[ValidationIssue]]:
    try:
        spec = load_suite_content(raw, source="suite draft", suite_name=suite_name or "__draft__")
    except ValueError as exc:
        return None, [_yaml_value_error_issue(exc)]
    except ValidationError as exc:
        return None, _pydantic_issues(exc)

    issues: list[ValidationIssue] = []
    for message in validate_suite(spec):
        issues.append(_validate_suite_issue(message))

    for test in spec.tests:
        unsupported = sorted(
            {
                assertion.type
                for assertion in test.assertions
                if assertion.type in UNSUPPORTED_WEB_ASSERTIONS
            }
        )
        if unsupported:
            issues.append(
                _issue(
                    field="assertions",
                    code="unsupported_assertion",
                    message=f"Unsupported web assertions: {', '.join(unsupported)}",
                    test_name=test.name,
                )
            )

    models = sorted({(test.model or spec.model_default) for test in spec.tests})
    summary = SuiteSummary(
        test_count=len(spec.tests),
        test_names=[test.name for test in spec.tests],
        models=models,
    )
    return summary, issues


def _yaml_value_error_issue(exc: ValueError) -> ValidationIssue:
    cause = exc.__cause__
    if isinstance(cause, yaml.YAMLError):
        mark = getattr(cause, "problem_mark", None)
        return _issue(
            field="yaml_content",
            code="invalid_yaml",
            message=str(exc),
            line=(mark.line + 1) if mark else None,
            column=(mark.column + 1) if mark else None,
        )

    return _issue(field="yaml_content", code="invalid_yaml", message=str(exc))


def _pydantic_issues(exc: ValidationError) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    for error in exc.errors():
        loc = [str(part) for part in error.get("loc", ())]
        message = error.get("msg", "Invalid suite schema.")
        code = str(error.get("type", "invalid_schema")).replace(".", "_")
        issues.append(
            _issue(
                field="yaml_content",
                code=code,
                message=_format_schema_message(loc, message),
                test_name=_extract_test_name(loc),
            )
        )
    return issues


def _format_schema_message(loc: list[str], message: str) -> str:
    if not loc:
        return message
    return f"{' -> '.join(loc)}: {message}"


def _extract_test_name(loc: list[str]) -> str | None:
    if len(loc) >= 2 and loc[0] == "tests":
        return f"tests[{loc[1]}]"
    return None


def _validate_suite_issue(message: str) -> ValidationIssue:
    lowered = message.lower()
    if "assertion" in lowered:
        return _issue(field="assertions", code="invalid_assertion", message=message)
    return _issue(field="yaml_content", code="invalid_suite", message=message)


def _issue(
    *,
    field: str,
    code: str,
    message: str,
    test_name: str | None = None,
    line: int | None = None,
    column: int | None = None,
) -> ValidationIssue:
    return ValidationIssue(
        field=field,
        code=code,
        message=message,
        test_name=test_name,
        line=line,
        column=column,
    )
