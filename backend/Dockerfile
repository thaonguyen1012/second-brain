FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1 STATIC_ROOT=/srv/alex-brain/staticfiles
WORKDIR /app
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
RUN useradd --system --uid 10001 app && mkdir -p /srv/alex-brain/staticfiles && chown app /srv/alex-brain/staticfiles
USER app
EXPOSE 8000
# migrate + collectstatic on start (both idempotent), then gunicorn
CMD ["sh", "-c", "uv run --no-sync python manage.py migrate --noinput && uv run --no-sync python manage.py collectstatic --noinput && exec uv run --no-sync gunicorn config.wsgi -b 0.0.0.0:8000 -w 3 --access-logfile -"]
