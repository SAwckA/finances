# Project Rules For Codex

These instructions apply to the entire repository.

## Startup Policy (Strict)

- Never start any project component automatically.
- Backend, frontend, infrastructure, scripts, builds, and tests must not trigger app startup on their own.
- Never start backend or frontend applications yourself, even on explicit user request.
- Only provide clear run instructions/commands for the user to execute manually.

## Dependency Management (uv only)

- Use only `uv` for dependency and environment management.
- Keep dependencies in `pyproject.toml` (do not use `requirements.txt`).
- Keep `uv.lock` committed and up to date.
- Python version is defined in `.python-version`.
- Do not edit `uv.lock` manually.
- Do not use `pip install`, `poetry`, or `pipenv`.

## Python Development Rules

Apply these rules when working with Python code.

- Follow PEP 8 and keep code readable and explicit.
- Use SQLAlchemy 2.0 style (`Mapped`, `mapped_column`, typed models).
- Prefer dataclasses and Pydantic models over raw dictionaries.
- Avoid deep nesting (target max depth 3-4).
- Do not suppress linter/type checker warnings (`# noqa`, `# type: ignore`, `# pylint: disable`, `# pyright: ignore`, etc.).
- Fix linting issues in code instead of suppressing them.
- Avoid `hasattr` checks for method existence; rely on explicit interfaces and docs.
- Use docstrings when documentation is needed.

## Formatting

- After Python edits, run formatter with `uv format`.

## FastAPI Architecture Conventions

Target layout:

```text
app/
├── config/
├── auth/
├── api/
│   ├── dependencies/
│   ├── controllers/
│   ├── exception_handlers.py
│   └── router.py
├── services/
├── repositories/
├── models/
└── exceptions.py
migrations/
main.py
pyproject.toml
uv.lock
.python-version
```

### Services

- Services inherit from `BaseService`.
- Declare dependencies as class type annotations (not via `__init__` by default).
- Define service-specific exceptions at the top of the service file, before service class.
- Use transaction context managers (`async with ...`).
- Use module logger pattern (`logging.getLogger(__name__)`).

### Repositories

- Repositories inherit from generic `BaseRepository[Model]`.
- Reuse base CRUD methods where possible.
- If soft-delete is supported by model mixins, preserve soft-delete behavior.
- Use session/context management provided by project infrastructure.

### Models

- Keep ORM model and related Pydantic schemas in one module when consistent with existing project style.
- Preferred schema naming: `{Entity}Base`, `{Entity}Create`, `{Entity}Update`, `{Entity}Response`.
- Prefer modern typing (`list`, `dict`, `|`) instead of legacy `Optional`/`List` forms.
