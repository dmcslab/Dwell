# Contributing to Dwell

Thank you for your interest in contributing. Dwell is free software licensed under the **GNU General Public License v3.0**. All contributions must be compatible with this license.

---

## Table of Contents

- [License Agreement](#license-agreement)
- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Scenario Contribution Guide](#scenario-contribution-guide)
- [Development Setup](#development-setup)
- [Submitting Changes](#submitting-changes)
- [Branch Strategy](#branch-strategy)
- [Coding Standards](#coding-standards)
- [Commit Message Format](#commit-message-format)
- [Reporting Issues](#reporting-issues)

---

## License Agreement

By submitting a contribution to this project, you agree that:

1. Your contribution is your original work or you have the right to submit it.
2. You license your contribution under the **GNU General Public License v3.0** (GPL-3.0-or-later).
3. You understand that your contribution will be distributed as part of free software — anyone who receives the software also receives the right to study, modify, and redistribute it under the same terms.
4. You grant no additional restrictions beyond those stated in the GPL-3.0.

This project does **not** use a Contributor License Agreement (CLA). All contributions remain under GPL-3.0.

> If you include code from third-party sources, ensure it is compatible with GPL-3.0 and include proper attribution.

---

## Code of Conduct

This project is a professional security training tool. All contributors are expected to:

- Communicate respectfully and constructively.
- Keep discussions focused on technical merit.
- Avoid submitting content that depicts or facilitates real harm.
- Respect the time of maintainers and reviewers.

Harassment of any kind will result in permanent removal from the project.

---

## Ways to Contribute

| Type | Description |
|---|---|
| **New scenario** | Author an IR simulation scenario following the content rules |
| **Bug fix** | Fix a reproducible defect with a test case |
| **Feature** | Propose and implement a new capability (open an issue first) |
| **Documentation** | Improve README, inline docs, or this guide |
| **Translation** | Translate scenario text or UI strings |
| **Security report** | See responsible disclosure below |

---

## Scenario Contribution Guide

Scenarios are the primary content of this project. Quality and consistency are essential.

### Content rules (mandatory)

All scenarios **must** comply with the following rules. Pull requests that violate these rules will not be merged.

| Rule | Required |
|---|---|
| No specific years in narrative text | ✅ |
| No real company or victim names in prompts, context, or consequences | ✅ |
| No specific ransom dollar amounts in decision text | ✅ |
| First-person analyst perspective throughout | ✅ |
| Every stage has an `irPhase` field matching a NIST SP 800-61r2 phase | ✅ |
| `keyTTPs` contains valid MITRE ATT&CK technique IDs (`Txxxx.xxx — Description`) | ✅ |
| At least one incorrect option per stage with a realistic consequence and technical explanation | ✅ |
| `lessonsLearned` has at least 4 actionable items | ✅ |
| `referenceLinks` contains at least 2 authoritative sources | ✅ |

### NIST SP 800-61r2 phase values

Use these exact values in `irPhase` fields:

```
Preparation
Detection & Analysis
Containment
Containment, Eradication & Recovery
Eradication & Recovery
Post-Incident Activity
```

Stages that span a transition may use `"Detection & Analysis → Containment"` format.

### Difficulty guidelines

| Level | Stages | Options per stage | Wrong paths |
|---|---|---|---|
| Easy | 3–4 | 2–3 | 1 obvious wrong path per stage |
| Medium | 4–5 | 2–3 | Wrong paths with plausible-but-flawed reasoning |
| Hard | 4–5 | 2–3 | Multiple plausible wrong paths; wrong paths cause cascade consequences |

### Scenario JSON skeleton

```json
{
  "name": "Operation: [Descriptive Name]",
  "description": "One-line summary of the simulation. No company names or years.",
  "initial_prompt": "You are a Tier-X analyst... [First-person present tense setup]",
  "difficulty_level": "easy|medium|hard",
  "max_attempts": 3,
  "scenario_structure": {
    "ransomwareFamily": "Variant-class (key technical characteristics)",
    "irPhase": "Primary NIST phase",
    "attackVector": "Technical description of how the attack enters and spreads.",
    "keyTTPs": ["T1566.001 — Phishing: Spearphishing Attachment"],
    "simulationContext": "Organisation type, size, and technical environment. No real names.",
    "decisionTree": [
      {
        "stageId": "phase2_initial_triage",
        "irPhase": "Detection & Analysis",
        "prompt": "What the analyst sees and must decide.",
        "analystContext": "Available tools and known information at this stage.",
        "options": [
          {
            "actionText": "The specific action the analyst takes.",
            "isCorrect": true,
            "consequence": "What happens as a result of this choice.",
            "nextStageId": "phase3_containment",
            "technicalExplanation": "Why this is correct — grounded in real security practice."
          }
        ]
      }
    ],
    "lessonsLearned": ["Actionable lesson 1", "Actionable lesson 2"],
    "referenceLinks": ["https://authoritative-source.example/"]
  }
}
```

### Scenario validation checklist

Before opening a PR for a new scenario, verify:

- [ ] No years in `initial_prompt`, `prompt`, `analystContext`, `consequence`, `description`, or `simulationContext`
- [ ] No real company or product names in narrative fields
- [ ] No dollar amounts in decision text
- [ ] All `stageId` values referenced in `nextStageId` exist in the `decisionTree`
- [ ] Final stage(s) have `"nextStageId": null`
- [ ] Every stage has at least one `"isCorrect": true` option
- [ ] Technical explanations cite specific TTPs or documented security practices
- [ ] Reference links are to primary sources (CISA, NIST, MITRE, vendor advisories, RFCs)
- [ ] Python seed file parses without syntax errors: `python3 -c "import ast; ast.parse(open('scripts/seed_scenarios.py').read()); print('OK')"`

---

## Development Setup

### Prerequisites

- Docker + Docker Compose v2
- Python 3.12+
- Node.js 20+
- Git

### Local setup

```bash
git clone https://github.com/yourorg/dwell.git
cd dwell

# Start dependencies only
docker compose up db redis -d

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python scripts/seed_scenarios.py
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Running the full stack

```bash
docker compose up --build
docker exec -it dwell_backend alembic upgrade head
docker exec -it dwell_backend python scripts/seed_scenarios.py
```

---

## Submitting Changes

1. **Open an issue first** for anything beyond a trivial bug fix. Discuss the approach before writing code.
2. Fork the repository and create a branch from `main`.
3. Make your changes following the coding standards below.
4. Add or update tests where applicable.
5. Ensure all existing tests pass.
6. Run the scenario compliance check if you modified `seed_scenarios.py`:
   ```bash
   docker exec -it dwell_backend python scripts/seed_scenarios.py
   ```
7. Open a pull request against `main` with a clear description of what changed and why.

### Pull request requirements

- [ ] Description explains the change and links to the relevant issue
- [ ] No breaking changes to the scenario JSON schema without a migration path
- [ ] No new dependencies added without justification
- [ ] All added scenarios pass the content rules checklist
- [ ] Existing scenarios are not modified without a clear reason

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, always deployable |
| `develop` | Integration branch for in-progress work |
| `feature/short-name` | New features |
| `fix/short-name` | Bug fixes |
| `scenario/operation-name` | New scenario additions |
| `docs/short-name` | Documentation-only changes |

---

## Coding Standards

### Python (backend / orchestrator / worker)

- Python 3.12+
- Follow PEP 8
- Type hints on all function signatures
- Async-first: use `async def` for all route handlers and DB/Redis calls
- No bare `except:` — always catch specific exception types
- SQLAlchemy 2.0 style (`select()`, `mapped_column`, `Mapped`)
- Pydantic v2 models for all request/response schemas
- Max line length: 120 characters

### TypeScript / React (frontend)

- TypeScript strict mode
- Functional components with hooks only — no class components
- Tailwind utility classes only — no custom CSS files beyond `index.css`
- Props interfaces defined above each component
- No `any` types except where genuinely unavoidable
- API calls via `src/api/` modules — never fetch directly in components

### General

- No secrets, credentials, or API keys committed to the repository
- No hardcoded IPs or internal hostnames
- Environment-specific config belongs in `.env` files, which are gitignored

---

## Commit Message Format

Use the following format:

```
<type>(<scope>): <short summary>

[Optional longer body explaining why, not what]

[Optional: Fixes #issue-number]
```

**Types:**

| Type | Use for |
|---|---|
| `feat` | New feature or scenario |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructure with no behaviour change |
| `test` | Adding or fixing tests |
| `chore` | Build, CI, dependency updates |
| `scenario` | New or updated IR scenario content |

**Examples:**

```
feat(game): add SOAR automation to WebSocket game loop

fix(frontend): correct attempts meter display on failed state

scenario(hard): add Operation: Hypervisor Lockout (ESXi encryption)

docs(readme): add scenario content rules to contribution guide
```

---

## Reporting Issues

### Bug reports

Open a GitHub issue with:
- Steps to reproduce
- Expected vs actual behaviour
- Browser/OS/Docker version if relevant
- Any relevant log output (`docker compose logs backend`)

### Security vulnerabilities

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues via private disclosure:
1. Email the maintainer(s) directly, or
2. Use GitHub's private security advisory feature if enabled on this repository.

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested remediation if known

You will receive a response within 5 business days. We will credit responsible disclosures in the release notes.

---

## Questions

Open a GitHub Discussion or an issue tagged `question`.

---

*Dwell is free software. Contributions you make will be freely available to the security community under the same terms. Thank you for helping make IR training more accessible.*
