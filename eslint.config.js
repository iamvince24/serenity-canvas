import webConfig from "./apps/web/eslint.config.js";
import { globalIgnores } from "eslint/config";

export default [...webConfig, globalIgnores(["apps/site/"])];
