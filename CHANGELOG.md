# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CI pipeline with lint, typecheck, tests, Playwright, dependency audit, secret scanning, and SAST (#44)
- Deployment workflow with migration-first ordering, canary gates, and production promotion (#45)
- Golden signals and alert thresholds with runbook links (#46)
- Log redaction lint rules and PII hashing in structured logger (#46)
- HTTP security headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy (#47)
- Security checklist with credential rotation procedures (#47)
- k6 load test for concurrent player simulation (#48)
- Capacity planning runbook (#48)

### Changed
- Enhanced logger with secret pattern detection and request body redaction (#46)
- Excluded load test directory from TypeScript compilation (#48)
