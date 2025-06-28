import z from "zod"
import { fromZodError } from "zod-validation-error"

export class ValidationError extends Error {
  constructor(result: z.SafeParseError<unknown>) {
    let error = result.error
    // If the schema was a union, it is likely that the object was close to one of the union types, 
    // and the other is wildly different. In this case, the error message will be ridiculously long, because one of the
    // schemas will be wrong all over the place. To simplify, we will only select the simplest error out of the unions.
    const issue = result.error.issues[0]
    if (issue != null && result.error.issues.length === 1 && issue.code === 'invalid_union') {
      const simplestIssue = issue.unionErrors.reduce((a: z.ZodError | null, b) => 
        a == null ? b : (a.issues.length < b.issues.length ? a : b), null)
      if (simplestIssue != null) {
        error = simplestIssue
      }
    }
    super(fromZodError(error).message)
  }
}

export function parse<T extends z.ZodTypeAny>(schema: T, obj: unknown): z.infer<T> {
  const result = schema.safeParse(obj)
  if (!result.success) {
    // If the schema was a union, it is likely that the object was close to one of the union types, 
    // and the other is wildly different. In this case, the error message will be ridiculously long, because one of the
    // schemas will be wrong all over the place. To simplify, we will only select the simplest error out of the unions.
    let error = result.error
    const issue = result.error.issues[0]
    if (issue != null && result.error.issues.length === 1 && issue.code === 'invalid_union') {
      const simplestIssue = issue.unionErrors.reduce((a: z.ZodError | null, b) => 
        a == null ? b : (a.issues.length < b.issues.length ? a : b), null)
      if (simplestIssue != null) {
        error = simplestIssue
      }
    }

    throw new Error(fromZodError(error).message)
  }
  return result.data
}
