import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([{
    extends: [...nextCoreWebVitals],

    rules: {
        "react/no-unescaped-entities": "off",
        // React 19 / eslint-plugin-react-hooks v6 ile gelen yeni stil kuralları: uyarı olarak tutulur
        "react-hooks/set-state-in-effect": "warn",
        "react-hooks/purity": "warn",
        "react-hooks/immutability": "warn",
        "react-hooks/refs": "warn",
        "react-hooks/static-components": "warn",
        "react/use": "off",
        "@next/next/no-html-link-for-pages": "off",
    },
}]);