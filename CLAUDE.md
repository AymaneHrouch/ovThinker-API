# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the backend API for the Aymane Diary journaling app (package name `journalapp`, deployed as `aymanediary-api`). Express 4 + Mongoose 5 on MongoDB, JWT auth. The frontend client lives in the sibling repo `aymanediary`.

## Commands

```bash
npm start   # node index.js — starts the API on $PORT or 3900
```

There is no test suite (`npm test` is a stub that exits 1) and no lint script. Node engine is pinned to `v14.15.1` in package.json.

### Required config before running

`config` (node-config) reads from `config/default.json`, overridden by env vars listed in `config/custom-environment-variables.json` (`jwtPrivateKey`, `db`). `startup/config.js` throws at boot if `jwtPrivateKey` is unset. Set env vars matching the names in `custom-environment-variables.json` (e.g. `mini_jwtPrivateKey`, `mini_db`) or edit `config/default.json` locally, then point `db` at a running MongoDB instance.

## Architecture

**Boot sequence (`index.js`)** — requires each `startup/*` module in sequence: `logging` → `routes` → `db` → `logging` (again — harmless duplicate, not intentional) → `config` → `prod`, then wires the catch-all 404 handler from `middleware/ok.js` last. Route registration order matters in Express, so `error` middleware (registered inside `startup/routes.js`) and `helmet`/`compression` (registered later via `startup/prod.js`) end up interleaved with route handlers rather than wrapping everything — be aware of this when adding new global middleware.

**Data model — two competing designs coexist:**
- `models/journal.js` + `routes/journals.js` (mounted at `/api/journals`, wired in `startup/routes.js`) is the **live** design: `Journal` is its own Mongoose collection with a `user` ObjectId ref. All current CRUD, pagination, `starred`/`locked`/`random`/`search` sub-routes operate on this collection.
- `routes/journalss.js` (note the double "s") is **dead code** — not required anywhere in `startup/routes.js`. It implements an older embedded-array design where journals live in `User.data[]`. Don't extend it; if touching journal storage, use `routes/journals.js` / `models/journal.js`.

**Auth** — `middleware/auth.js` verifies the `x-auth-token` header JWT (via `config.get('jwtPrivateKey')`) and sets `req.user` from the decoded payload; every protected route depends on this shape (`req.user._id`, `req.user.isAdmin`). `middleware/admin.js` additionally gates admin-only routes (`GET /api/users`). Login (`routes/auth.js`) checks bcrypt password hash and returns a fresh token via `user.genAuthToken()` (defined on the Mongoose model in `models/user.js`).

**Validation** — uses the older `joi` v13 API (`Joi.validate(obj, schema)`, not `schema.validate`), consistent with the frontend's `joi-browser`. Validation schemas are defined per-route/model rather than centralized.

**Journal fields**: `comment`, `date`, `starred` (bool), `locked` (bool), `unlockDate` (required only when `locked` is true, enforced in `models/journal.js` via a conditional `required` function). All journal queries scope by `user: req.user._id` — any new route must do the same to keep entries private per-user.

**Misc dead weight**: `views/*.hbs` and the `hbs` dependency are present but no view engine is configured anywhere (no `app.set('view engine', ...)`) — they are unused.

## Conventions & gotchas

- `routes/users.js` `PUT /changepassword` hardcodes a check blocking password changes for one specific ObjectId (`6025d7a61adafc001705d0c6`) — a protected demo/sample account. Don't remove without understanding why.
- `.gitignore` excludes `seed*.js`, `backup*.json`, `MOCK*.json`, and `changeword.js` — these are local-only scripts/data, expect them to be absent from a fresh clone.
- CORS is wide open (`app.use(cors())` with no options) in `index.js`.
