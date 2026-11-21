# Blog CMS — whitebox pentest

`report` · `web` · `2026-06` · `20 findings`

A skills lab: a blog platform built as microservices behind an API gateway, tested whitebox
(source review plus dynamic testing) in a local environment. Findings are shared with the lab
owner's permission; the lab itself, its source and its links are not.

| Layer | Stack |
|---|---|
| Gateway | Kong |
| Services | auth (Node.js/Express) · blog (PHP) · user (Java/Spring Boot) · admin (C#/.NET) |
| Data | MongoDB 6.0 |
| Frontend | static HTML/JS |

## Findings

| Critical | High | Medium | Low | Info |
|---|---|---|---|---|
| 3 | 4 | 7 | 4 | 2 |

- **Critical:** hardcoded token-signing secret exposed by an endpoint; a backdoored upload path
  leading to remote code execution; NoSQL injection.
- **High:** self-service privilege escalation to admin; IDOR on user data; two stored XSS.
- **Medium and below:** guessable OTP with no rate limit, tokens that survive logout, an
  unauthenticated database and gateway admin API, wildcard CORS, client-side-only authorization,
  user enumeration, verbose errors, exposed API docs, missing security headers.

## How they chain

> [!danger] Unauthenticated → remote code execution
> Read the leaked signing secret → forge an admin token → plant a web shell through the backdoored
> upload → run commands on the server. No account needed.

- **Any user → admin:** register, grant yourself the admin role, log in again.
- **Stored XSS → account takeover:** script in a post steals the reader's session token.
- **IDOR + weak OTP → takeover of any account:** leak a victim's email, trigger a password reset,
  brute-force the OTP.

## What the fix list came down to

Secrets out of code; authorization decided on the server from the token, never from the request
body; output encoding plus a CSP; revoke both tokens at logout and check the blacklist everywhere;
close the database and admin ports; audit the codebase for planted backdoors.
