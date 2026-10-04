---
name: add-api-endpoint
description: Add a new API endpoint to apps/backend, following the app.ts -> service -> repository -> dao layering with co-located tests at every layer. Use when adding, wiring, or scaffolding a new backend route/endpoint, or when asked how a backend endpoint should be structured.
---

# Add a backend API endpoint

`apps/backend` request handling is strictly layered (see `apps/backend/AGENTS.md`):

```
route (src/app.ts) -> service (src/service/*.service.ts)
                    -> repository (src/repository/*.repository.ts)
                    -> dao (src/dao/*.interface.ts;
                            D1/R2 implementations in apps/backend-worker/src/dao)
```

- A **route** depends only on a service. No business logic or datastore access in `app.ts`.
- A **service** holds business logic, orchestrates one or more repositories, and is the only
  layer that decides outcomes like "not found" / validation. It knows nothing about HTTP.
- A **repository** maps a DAO's raw storage shape to a domain entity. No datastore access here
  either — that's the DAO's job.
- A **dao** is the only layer that talks to a datastore, behind an interface, so different
  runtime packages (`apps/backend-*`) can wire in their own concrete DAOs without touching service/repository/route code.

Most endpoints don't need a new DAO: reads go through `ReadDao` / `StoreRepository`
(`src/dao/read.interface.ts`, `src/repository/store.repository.ts`) and every write through
`StoreRepository.commit(bumps, mutations)` (one D1 batch, with the sync revisions bumped; see
`apps/backend/AGENTS.md`). Existing services such as `src/service/schedule.service.ts` are the
reference. Add a DAO method only for a read the existing ones can't express.

## Procedure

Build bottom-up — each layer's test needs the layer below it to already have an interface.
Replace `<name>` below with the resource name (e.g. `widget`), matching the `sample.*` naming
scheme.

### 1. DAO layer (only when a new read is needed)

- Add the method to the interface in `src/dao/*.interface.ts` (raw rows, snake_case types from
  `src/dao/records.ts`).
- Implement it in `apps/backend-worker/src/dao/*.d1.ts` and test it there against the local D1
  (`src/dao/test-env.ts`). There are no in-memory DAOs for the D1 tables.

### 2. Repository layer

- `src/repository/<name>.repository.ts` — the domain entity type (`<Name>`), the
  `<Name>Repository` interface, and `create<Name>Repository(dao)` mapping the DAO's raw record to
  the domain entity.
- Most mapping is `camelize` (`src/repository/case.ts`); test a repository only when it does more
  than that, with a hand-written fake DAO.

### 3. Service layer

- `src/service/<name>.service.ts` — the response/view type the route will return (`<Name>View`),
  the `<Name>Service` interface, and `create<Name>Service(repository)` implementing the business
  logic and orchestration. Express "not found" / "invalid" as `null` or a thrown error — never an
  HTTP status here.
- `src/service/<name>.service.test.ts` — co-located test, using a hand-written fake
  `<Name>Repository` (see `sample.service.test.ts`).

### 4. Route layer (`src/app.ts`)

- Add the new dependency to `AppDependencies` (e.g. `<name>Service: <Name>Service`).
- Add the route inside `createApp(...)`, calling only the service and translating its result to
  an HTTP response (status code, JSON body). No business logic in the route itself. Route paths
  are written without the `/api` prefix (`basePath('/api')` adds it), but requests in tests and
  `auth.excludePaths` entries use the full path (`/api/<name>/...`).
- Extend `src/app.test.ts` (already co-located with `app.ts`) with cases for the new route, using
  a hand-written fake `<Name>Service` — covering the success path, the "not found"/error path, and
  auth guard interaction if the route isn't excluded from it.

### 5. Wire real dependencies

- Update `build()` in `apps/backend-worker/src/worker.ts` to construct the new service and pass it
  into `createApp`, and cover the endpoint end to end in `apps/backend-worker/src/worker.test.ts`.

### 6. Validate

```bash
vp check   # format, lint, type check
vp test    # or: vp run backend#test
```

## Notes

- Every file has its test right next to it (`foo.ts` + `foo.test.ts`) — never a separate `test/`
  or `__tests__/` tree.
- Each layer's test fakes only the interface directly below it, not the real implementation, so
  layers stay independently testable. The DAO tests and `worker.test.ts` are the ones that touch
  the real (local D1/R2) implementation.
- `sample.*` and `/sample/:id` are template leftovers; delete them with the frontend's sample
  screens (see `apps/backend/AGENTS.md`).
