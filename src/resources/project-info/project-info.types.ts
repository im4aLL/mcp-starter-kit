import type { z } from "zod";

import type { ProjectInfoSchema } from "./project-info.schemas";

// Schema-derived resource domain result type.
export type ProjectInfo = z.output<typeof ProjectInfoSchema>;
