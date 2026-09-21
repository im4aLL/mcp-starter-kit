import type { z } from "zod";

import type { ProjectInfoSchema } from "./project-info.schemas";

// Schema-derived resource domain result type.
export type ProjectInfoType = z.output<typeof ProjectInfoSchema>;
