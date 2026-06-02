# loyalty-core-customer

Technical core mock for the **customer** vertical of the loyalty platform.

This service is not pretending to be the full final domain implementation. Its purpose is to provide a believable core-facing integration point so the web and BFF can validate handoff, persistence, and lookup across the journey.

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

This core mock persists 3 types of traces:

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

- **Node.js service** used as a lightweight core mock
- **Postgres-backed persistence** for technical traces
- **separate storage per journey stage**
- **lookup endpoints** used by the BFF and trace screens
- enough realism to validate end-to-end integration without overbuilding the domain

---

## Why this layer exists in the case study

Without this service, the portfolio story would stop at “frontend and BFF talk to each other”.

With this core mock in place, the project can demonstrate:

- handoff from BFF to core
- persistence outside the web layer
- technical lookup by stage identifiers
- end-to-end traceability across multiple steps

That is much closer to real platform work.

---

## Environment

Create the local env file:

```bash
cp .env.example .env
```

Main variables:

- `PORT=3001`
- `NODE_ENV=development`
- `DATABASE_URL=postgresql://loyalty_app:loyalty_app_dev_2026@127.0.0.1:5432/loyalty_platform` _(required)_

---

## Run locally

```bash
npm install
npm run dev
```

Test:

```bash
npm test
```

---

## Validation status

Latest validated status:

- `npm test` ✅

This currently validates the service syntax entrypoint and supports the full local journey already used by the web and BFF layers.

---

## Architecture note

This repository represents the layer that should eventually evolve toward the project’s intended core architecture:

- Go as the long-term core stack
- DDD light
- hexagonal / clean architecture

Right now it stays intentionally lightweight so the full journey can be demonstrated without blocking on the final domain implementation.

Related docs:

- `../docs/architecture/core-customer-contract.md`
- `../docs/architecture/architecture-decision.md`

---

## What I would improve next

1. move from technical mock toward a more explicit domain model
2. add stronger automated tests around persistence and lookup behavior
3. separate infrastructure concerns from the HTTP entrypoint
4. align the implementation more closely with the target Go ownership model
5. prepare the repository for standalone publication with clearer contract examples and startup failure troubleshooting
