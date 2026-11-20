import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Clean Architecture "Dependency Rule": source code dependencies only point
// inward. Enforced here so CI fails when an inner layer imports an outer one.
const FRAMEWORKS = ["next", "next/*", "react", "react-dom", "server-only"];
const DRIVERS = ["postgres", "jose", "bcryptjs"];
const OUTER = ["@/adapters/*", "@/infrastructure/*", "@/app/*", "@/components/*", "@/proxy"];

const restrict = (patterns, message) => ({
  "no-restricted-imports": ["error", { patterns: [{ group: patterns, message }] }],
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/core/domain/**/*.ts"],
    rules: restrict(
      [...FRAMEWORKS, ...DRIVERS, ...OUTER, "@/core/application/*", "../application/*", "../../application/*"],
      "Entities (core/domain) must not depend on use cases, adapters, frameworks or drivers.",
    ),
  },
  {
    files: ["src/core/application/**/*.ts"],
    rules: restrict(
      [...FRAMEWORKS, ...DRIVERS, ...OUTER],
      "Use cases (core/application) may only depend on core/domain and their own ports.",
    ),
  },
  {
    files: ["src/adapters/**/*.ts"],
    rules: restrict(
      [...FRAMEWORKS, "@/infrastructure/*", "@/app/*", "@/components/*", "@/proxy"],
      "Adapters may depend on core and drivers, never on the web framework or the composition root.",
    ),
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: restrict(
      [...DRIVERS, "@/adapters/*", "@/infrastructure/*"],
      "UI components receive data as props; they must not reach the database or adapters.",
    ),
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
