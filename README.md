# loyalty-core-customer

Technical core service for the **customer** vertical of the loyalty platform.

This repository now runs on **Go + Postgres** and keeps the same traceability contract already consumed by the BFF and web layers.

---

## What this service is responsible for

`loyalty-core-customer` validates the backend side of traceability.

It is responsible for:

- receiving handoff payloads from the BFF
- persisting technical traces in Postgres
- exposing lookup endpoints for each stage id
- acting as a contract-validation layer for the portfolio journey

---

## Journey records currently supported

This core service persists 3 types of traces:

- **customer enrollments**
- **customer password changes**
- **customer logins**

Identifiers supported:

- `transactionId`
- `requestId`
- `loginId`

It also stores the reusable technical context passed from the BFF:

- `customerEmailHash`

---

## Endpoints

- `GET /health`
- `POST /v1/customer-enrollments`
- `GET /v1/customer-enrollments`
- `GET /v1/customer-enrollments/:transactionId`
- `POST /v1/customer-password-changes`
- `GET /v1/customer-password-changes/:requestId`
- `POST /v1/customer-logins`
- `GET /v1/customer-logins/:loginId`

---

## Technical highlights

- **Go HTTP service** with standard library routing
- **Postgres-backed persistence** for technical traces
- **idempotent upserts** for trace updates per journey id
- **lookup endpoints** used by the BFF and trace screens
- lightweight implementation, but already aligned with the intended core stack

---

## Environment

Create the local env file:

```bash
cp .env.example .env
```

Main variables:

- `PORT=3001`
- `APP_ENV=development`
- `DATABASE_URL=postgresql://loyalty_app:loyalty_app_dev_2026@127.0.0.1:5432/loyalty_platform` _(required)_

---

## Run locally

Using the repo-local Go toolchain I left under `.tooling/go`:

```bash
export PATH="$(pwd)/.tooling/go/bin:$PATH"
go mod tidy
go run .
```

Build binary:

```bash
export PATH="$(pwd)/.tooling/go/bin:$PATH"
go build -o bin/core-customer .
```

Test:

```bash
export PATH="$(pwd)/.tooling/go/bin:$PATH"
go test ./...
```

---

## Validation status

Expected validation gates for this repo:

- `go test ./...`
- `go build ./...`
- Docker image build

If CI is green, the service is ready to be consumed by the BFF with the same HTTP contract.

---

## Architecture note

This repository now aligns with the project’s intended core direction:

- Go as core stack
- explicit technical contract for handoff traces
- room to evolve toward cleaner domain boundaries later

Related docs:

- `../docs/architecture/core-customer-contract.md`
- `../docs/architecture/architecture-decision.md`

---

## What I would improve next

1. split handlers, repository, and bootstrap into separate packages
2. add integration tests with ephemeral Postgres
3. version the API contract explicitly
4. add migrations instead of boot-time table creation
5. align naming with the future domain model once the functional scope grows
