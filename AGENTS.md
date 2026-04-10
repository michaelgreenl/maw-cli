# AGENTS.md

---

## General Global Rules

### KEY PERSONA CHECK

> **LEAVE THE SYCOPHANT PERSONA AT THE DOOR**. 
- You're a tool, not a girlfriend. You're hear to help, not stroke my ego.

#### Your Role

-   Your role relative to the user is a teammate.
    -   Teams work together and move as one.
    -   A bad team member is one that does things without ensuring the rest of the team is on the same page first.
-   If you have valid concerns for why a path you've been directed to take should not be taken;
    -   **NEVER** continue until you've surfaced those concerns with the user.
    -   **NEVER** assume the correct path and continue on your own.

### IMPORTANT SECURITY RULE: NEVER ACCESS `.env` / SECRETS

-   **NEVER** read, write, output, or inspect `.env` files or environment variables.
-   If a problem appears env-related, report the symptoms and ask the user for guidance.
-   **NEVER** log or echo env var names or values.
-   **THE ***ONLY*** EXCEPTION:** you are allowed to read and write to `.env.example` files.
    -   `.env.example` files should never contain anything but comments and undefined variable stubs.
    -   all other `.env` files (and `.env.*`) **DO NOT** fall under this exception

### Default Behavior

-   Small, reversible diffs only — no broad rewrites.
-   Patch-style edits; do not reformat or rename unrelated files.
-   No drive-by cleanups: no unrelated renames, reorganizations, or "while we're here" improvements.
-   Move one concern at a time (types, e2e, scripts, hooks — not combined).

### Output

-   Format only touched files — never run Prettier on the whole repo.
-   If you are in plan mode, you **NEVER** write code unless **EXPLICITLY** asked to.

### Verification

-   Never claim tests were run unless command output is provided.
-   For any code change, propose runnable commands for: typecheck, linting, unit tests, and e2e/integration (if present).
-   If you add tests, provide at least one acceptance check that isn't a brand-new unit test.

### Structural / High-Blast-Radius Changes

-   Split into PR-sized steps.
-   Introduce new structure before migrating to it — don't rewrite everything at once.
-   Changes spanning workspaces go in two PRs unless purely config.

---

## Bun

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

---

## Clean Code - Typescript

### AI Behavior

When reviewing code, identify violations by rule number (for example, "G5 violation: duplicated logic"). When fixing or editing code, report what was fixed (for example, "Fixed: extracted magic number to `SECONDS_PER_DAY` (G25)" or "Fixed: shortened `workerPath` to `path` (N1)").

---

### The Boy Scout Rule

> "Always leave the campground cleaner than you found it."
>
> -   Robert Baden-Powell

> "Always check a module in cleaner than when you checked it out."
>
> -   Robert C. Martin, _Clean Code_

#### The Philosophy

You don't have to make every module perfect. You simply have to make it **a little bit better** than when you found it.

If we all followed this simple rule:

-    Our systems would gradually get better as they evolved
-    Teams would care for the system as a whole
-    The relentless deterioration of software would end

#### When Working on Code

Every time you touch code, look for **at least one small improvement**:

##### Quick Wins (Do These Immediately)

-    Shorten an overly long local, param, or helper name when a single word is clear -> triggers `clean-names`
-    Delete a redundant comment -> triggers `clean-comments`
-    Remove dead code or unused imports
-    Replace a magic number with a named constant
-    Inline a single-use value
-    Remove unnecessary destructuring

##### Deeper Improvements (When Time Allows)

-    Split a function that does multiple things -> triggers `clean-functions`
-    Remove duplication (DRY) -> triggers `clean-general`
-    Add missing boundary checks
-    Improve test coverage -> triggers `clean-tests`

#### The Rule in Practice

```ts
// You are asked to fix a bug in this function:
export function proc(values: number[], results: number[], applyTax = false): number[] {
    for (const value of values) {
        if (value > 0) {
            if (applyTax) {
                results.push(value * 1.0825); // tax
            } else {
                results.push(value);
            }
        }
    }

    return results;
}

// Do not just fix the bug and leave.
// Leave it cleaner:
const TAX = 0.0825;

export function positive(values: number[]): number[] {
    return values.filter((value) => value > 0);
}

export function taxed(values: number[]): number[] {
    return positive(values).map((value) => value * (1 + TAX));
}
```

**What changed:**

-    Shorter names where one word is clear (N1)
-    No output argument mutation (F2)
-    Flag behavior split into separate functions (F3)
-    Named constant for magic number (G25)
-    Redundant comment removed (C3)

#### Skill Orchestration

This skill coordinates with specialized skills based on what you're doing:

| Task                                 | Trigger Skill                    |
| ------------------------------------ | -------------------------------- |
| Writing/reviewing any TypeScript     | `typescript-clean-code` (master) |
| Naming variables, functions, classes | `clean-names`                    |
| Writing or editing comments          | `clean-comments`                 |
| Creating or refactoring functions    | `clean-functions`                |
| Reviewing code quality               | `clean-general`                  |
| Writing or reviewing tests           | `clean-tests`                    |

#### The Mindset

**Don't:**

-    Leave code worse than you found it
-    Say "that's not my code"
-    Wait for a dedicated refactoring sprint
-    Make massive changes unrelated to your task

**Do:**

-    Make one small improvement with every commit
-    Fix what you see, even if you didn't break it
-    Keep changes proportional to your task
-    Leave a trail of quality improvements

#### AI Behavior

When working on code:

1. Complete the requested task first
2. Identify at least one small cleanup opportunity
3. Apply the appropriate specialized skill
4. Note the improvement made (for example, "Also cleaned up: shortened `workerPath` to `path` and inlined `journalPath` (N1, N3)")

When reviewing code:

1. Load `typescript-clean-code` for comprehensive rule checking
2. Flag violations by rule number
3. Suggest incremental improvements, not complete rewrites

#### The Boy Scout Promise

Every piece of code you touch gets a little better. Not perfect - just better.

Over time, better compounds into excellent.

---

### Clean Comments

#### C1: No Inappropriate Information

Comments should not hold metadata. Use Git for author names, change history, ticket numbers, and dates. Comments are for technical notes about code only.

#### C2: Delete Obsolete Comments

If a comment describes code that no longer exists or works differently, delete it immediately. Stale comments become "floating islands of irrelevance and misdirection."

#### C3: No Redundant Comments

```ts
// Bad - the code already says this
count += 1; // increment count
user.save(); // save the user

// Good - explains WHY, not WHAT
count += 1; // compensate for zero-indexing in display
```

#### C4: Write Comments Well

If a comment is worth writing, write it well:

-    Choose words carefully
-    Use correct grammar
-    Don't ramble or state the obvious
-    Be brief
-    Prefer TSDoc/JSDoc on exported APIs when behavior is not obvious

#### C5: Never Commit Commented-Out Code

```ts
// DELETE THIS - it is an abomination
// export function oldCalculateTax(income: number): number {
//   return income * 0.15;
// }
```

Who knows how old it is? Who knows if it is meaningful? Delete it. Git remembers everything.

#### The Goal

The best comment is the code itself. If you need a comment to explain what code does, refactor first, comment last.

---

### Clean Functions

#### F1: Too Many Arguments (Maximum 3)

```ts
// Bad - too many parameters
export function createUser(
    name: string,
    email: string,
    age: number,
    country: string,
    timezone: string,
    language: string,
    newsletter: boolean,
): void {
    // ...
}

// Good - use a parameter object type
export interface CreateUserInput {
    name: string;
    email: string;
    age: number;
    country: string;
    timezone: string;
    language: string;
    newsletter: boolean;
}

export function createUser(input: CreateUserInput): void {
    // ...
}
```

More than 3 arguments means your function is doing too much or needs a data structure.

#### F2: No Output Arguments

Don't modify arguments as side effects. Return values instead.

```ts
// Bad - modifies argument
export function appendFooter(reportLines: string[]): void {
    reportLines.push('---', 'Generated by System');
}

// Good - returns new value
export function withFooter(report: string): string {
    return `${report}\n---\nGenerated by System`;
}
```

#### F3: No Flag Arguments

Boolean flags mean your function does at least two things.

```ts
// Bad - function does two different things
export function render(isTest: boolean): string {
    if (isTest) {
        return renderTestPage();
    }

    return renderProductionPage();
}

// Good - split into two functions
export function renderTestPage(): string {
    return 'test';
}

export function renderProductionPage(): string {
    return 'production';
}
```

#### F4: Delete Dead Functions

If it's not called, delete it. No "just in case" code. Git preserves history.

---

### General Clean Code Principles

#### Critical Rules

**G5: DRY (Don't Repeat Yourself)**

Every piece of knowledge has one authoritative representation.

```ts
// Bad - duplication
const caTotal = subtotal * 1.0825;
const nyTotal = subtotal * 1.07;

// Good - single source of truth
type State = 'CA' | 'NY';
const TAX_RATES: Record<State, number> = { CA: 0.0825, NY: 0.07 };

export function calculateTotal(subtotal: number, state: State): number {
    return subtotal * (1 + TAX_RATES[state]);
}
```

**G16: No Obscured Intent**

Don't be clever. Be clear.

```ts
// Bad - what does this do?
return ((x & 0x0f) << 4) | (y & 0x0f);

// Good - obvious intent
return packCoordinates(x, y);
```

**G23: Prefer Polymorphism to If/Else**

```ts
// Bad - will grow forever
function calculatePay(employee: {
    type: string;
    salary?: number;
    hours?: number;
    rate?: number;
    base?: number;
    commission?: number;
}): number {
    if (employee.type === 'SALARIED') {
        return employee.salary ?? 0;
    }

    if (employee.type === 'HOURLY') {
        return (employee.hours ?? 0) * (employee.rate ?? 0);
    }

    if (employee.type === 'COMMISSIONED') {
        return (employee.base ?? 0) + (employee.commission ?? 0);
    }

    return 0;
}

// Good - open/closed principle
interface Employee {
    calculatePay(): number;
}

class SalariedEmployee implements Employee {
    constructor(private readonly salary: number) {}

    calculatePay(): number {
        return this.salary;
    }
}

class HourlyEmployee implements Employee {
    constructor(
        private readonly hours: number,
        private readonly rate: number,
    ) {}

    calculatePay(): number {
        return this.hours * this.rate;
    }
}

class CommissionedEmployee implements Employee {
    constructor(
        private readonly base: number,
        private readonly commission: number,
    ) {}

    calculatePay(): number {
        return this.base + this.commission;
    }
}
```

**G25: Replace Magic Numbers with Named Constants**

```ts
// Bad
if (elapsedTimeSeconds > 86400) {
    // ...
}

// Good
const SECONDS_PER_DAY = 86_400;

if (elapsedTimeSeconds > SECONDS_PER_DAY) {
    // ...
}
```

**G30: Functions Should Do One Thing**

If you can extract another function, your function does more than one thing.

**G36: Law of Demeter (Avoid Train Wrecks)**

```ts
// Bad - reaching through multiple objects
const outputDir = context.options.scratchDir.absolutePath;

// Good - one dot
const outputDir = context.getScratchDir();
```

#### Enforcement Checklist

When reviewing AI-generated code, verify:

-    [ ] No duplication (G5)
-    [ ] Clear intent, no magic numbers (G16, G25)
-    [ ] Polymorphism over conditionals (G23)
-    [ ] Functions do one thing (G30)
-    [ ] No Law of Demeter violations (G36)
-    [ ] Boundary conditions handled (G3)
-    [ ] Dead code removed (G9)

---

### Clean Names

#### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

#### N1: Single-Word Names by Default

THIS RULE IS MANDATORY FOR AGENT WRITTEN CODE.

-    Use single word names by default for new locals, params, and helper functions.
-    Do not introduce new camelCase compounds when a short single-word alternative is clear.
-    Before finishing edits, review touched lines and shorten newly introduced identifiers where possible.
-    Good short names to prefer: `pid`, `cfg`, `err`, `opts`, `dir`, `root`, `child`, `state`, `timeout`.
-    Avoid unless truly required: `inputPID`, `existingClient`, `connectTimeout`, `workerPath`.

```ts
// Good
const foo = 1;
function journal(dir: string): void {}

// Bad
const fooBar = 1;
function prepareJournal(dir: string): void {}
```

#### N2: Multi-Word Names Only When Necessary

Use multiple words only when a single word would be unclear or ambiguous. This is most common at public or exported boundaries.

```ts
// Bad - too vague at module boundary
export function rename(from: string, to: string): void {
    // ...
}

// Good - multi-word name is justified here
export function renameFile(from: string, to: string): void {
    // ...
}
```

#### N3: Inline Single-Use Values

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json();

// Bad
const journalPath = path.join(dir, "journal.json");
const journal = await Bun.file(journalPath).json();
```

#### N4: Avoid Unnecessary Destructuring

Prefer dot notation to preserve context and avoid introducing extra names.

```ts
// Good
obj.a;
obj.b;

// Bad
const { a, b } = obj;
```

Only destructure when it clearly improves readability or is required by an API.

#### N5: Prefer `const` Over `let`

Use `const` by default. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2;

// Bad
let foo;
if (condition) foo = 1;
else foo = 2;
```

#### N6: Avoid `else` Statements

Prefer early returns. Keep branches flat.

```ts
// Good
function foo() {
    if (condition) return 1;
    return 2;
}

// Bad
function foo() {
    if (condition) return 1;
    else return 2;
}
```

#### N7: Use `snake_case` for Database Schema Names

Use `snake_case` for database table and column names across ORMs.

-    If the ORM maps field names directly to column names, prefer `snake_case` in the schema definition.
-    If the ORM has a separate application-facing model API, use the ORM's idiomatic naming there and map to `snake_case` at the database boundary.

```ts
// Drizzle - good
const table = sqliteTable("session", {
    id: text().primaryKey(),
    project_id: text().notNull(),
    created_at: integer().notNull(),
});

// Drizzle - bad
const table = sqliteTable("session", {
    id: text("id").primaryKey(),
    projectID: text("project_id").notNull(),
    createdAt: integer("created_at").notNull(),
});
```

```prisma
// Prisma - good
model Session {
    id        String @id
    projectId String @map("project_id")
    createdAt Int    @map("created_at")

    @@map("session")
}

// Prisma - bad
model Session {
    id        String @id
    projectId String
    createdAt Int
}
```

#### N8: Short Names Must Still Reveal Behavior

Short names are preferred, but they must still be clear in context and must not hide side effects.

-    Use standard domain terms when available.
-    If one word would mislead, choose the shortest multi-word name that stays clear.

```ts
const cfg = new Map<string, string>();

// Bad - name hides creation side effect
export function config(key: string): string {
    if (!cfg.has(key)) {
        cfg.set(key, "{}");
    }

    return cfg.get(key) ?? "{}";
}

// Good - multi-word name is justified because it reveals behavior
export function ensureConfig(key: string): string {
    if (!cfg.has(key)) {
        cfg.set(key, "{}");
    }

    return cfg.get(key) ?? "{}";
}
```

---

### Clean Tests

#### T1: Insufficient Tests

Test everything that could possibly break. Use coverage tools as a guide, not a goal.

```ts
// Bad - only tests happy path
it('divides two numbers', () => {
    expect(divide(10, 2)).toBe(5);
});

// Good - tests edge cases too
it('divides normal values', () => {
    expect(divide(10, 2)).toBe(5);
});

it('throws on divide by zero', () => {
    expect(() => divide(10, 0)).toThrow('Cannot divide by zero');
});

it('handles negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5);
});
```

#### T2: Use a Coverage Tool

Coverage tools report gaps in your testing strategy. Don't ignore them.

```bash
# Run Vitest through the project's test script
bun run test -- --coverage

# Or run Vitest directly
bun x vitest run --coverage
```

Aim for meaningful coverage, not 100%.

#### T3: Don't Skip Trivial Tests

Trivial tests document behavior and catch regressions. They're worth more than their cost.

```ts
it('uses member role by default', () => {
    const user = new User({ name: 'Alice' });
    expect(user.role).toBe('member');
});
```

#### T4: An Ignored Test Is a Question About an Ambiguity

Don't use `it.skip` to hide problems. Either fix the test or delete it.

```ts
// Bad - hiding a problem
it.skip('flaky, fix later', async () => {
    // ...
});

// Good - explicit and actionable skip reason
it.skip('requires Redis; see CONTRIBUTING.md for setup', async () => {
    // ...
});
```

#### T5: Test Boundary Conditions

Bugs congregate at boundaries. Test them explicitly.

```ts
it('covers pagination boundaries', () => {
    const items = Array.from({ length: 100 }, (_, index) => index);

    // First page
    expect(paginate(items, 1, 10)).toEqual(items.slice(0, 10));

    // Last page
    expect(paginate(items, 10, 10)).toEqual(items.slice(90, 100));

    // Beyond last page
    expect(paginate(items, 11, 10)).toEqual([]);

    // Page zero (invalid)
    expect(() => paginate(items, 0, 10)).toThrow('Page must be >= 1');

    // Empty list
    expect(paginate([], 1, 10)).toEqual([]);
});
```

#### T6: Exhaustively Test Near Bugs

When you find a bug, write tests for all similar cases. Bugs cluster.

```ts
it('covers month boundaries', () => {
    expect(lastDayOfMonth(2024, 1)).toBe(31); // January
    expect(lastDayOfMonth(2024, 2)).toBe(29); // Leap year February
    expect(lastDayOfMonth(2023, 2)).toBe(28); // Non-leap February
    expect(lastDayOfMonth(2024, 4)).toBe(30); // 30-day month
    expect(lastDayOfMonth(2024, 12)).toBe(31); // December
});
```

#### T7: Patterns of Failure Are Revealing

When tests fail, look for patterns. They often point to deeper issues.

```ts
// If all async tests fail intermittently,
// the problem is usually async coordination, not random test flakiness.
```

#### T8: Test Coverage Patterns Can Be Revealing

Look at which code paths are untested. Often they reveal design problems.

```ts
// If you cannot test a function without complex setup,
// it likely does too much and needs refactoring.
```

#### T9: Tests Should Be Fast

Slow tests don't get run. Keep unit tests under 100ms each.

```ts
// Bad - hits real database
it('creates a user', async () => {
    const db = await connectToDatabase(); // Slow
    const user = await db.createUser('Alice');
    expect(user.name).toBe('Alice');
});

// Good - uses in-memory dependency
it('creates a user', async () => {
    const db = new InMemoryDatabase();
    const user = await db.createUser('Alice');
    expect(user.name).toBe('Alice');
});
```

#### Test Organization

##### F.I.R.S.T. Principles

-    **Fast**: Tests should run quickly
-    **Independent**: Tests should not depend on each other
-    **Repeatable**: Same result every time, in any environment
-    **Self-Validating**: Pass or fail, no manual inspection
-    **Timely**: Written before or with the code, not far after it

##### One Concept Per Test

```ts
// Bad - testing multiple things
it('user behavior', () => {
    const user = new User('Alice', 'alice@example.com');
    expect(user.name).toBe('Alice');
    expect(user.email).toBe('alice@example.com');
    expect(user.isValid()).toBe(true);
    user.activate();
    expect(user.isActive).toBe(true);
});

// Good - one concept each
it('stores name', () => {
    const user = new User('Alice', 'alice@example.com');
    expect(user.name).toBe('Alice');
});

it('stores email', () => {
    const user = new User('Alice', 'alice@example.com');
    expect(user.email).toBe('alice@example.com');
});

it('new user is valid', () => {
    const user = new User('Alice', 'alice@example.com');
    expect(user.isValid()).toBe(true);
});

it('can be activated', () => {
    const user = new User('Alice', 'alice@example.com');
    user.activate();
    expect(user.isActive).toBe(true);
});
```

---
