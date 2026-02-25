import { afterEach } from "vitest";
import { clearBreadcrumbs } from "../breadcrumbs";

afterEach(() => {
  clearBreadcrumbs();
});
