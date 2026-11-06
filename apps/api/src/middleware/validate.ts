import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

const formatIssues = (error: ZodError, where: string) =>
  error.issues.map((i) => ({ in: where, field: i.path.join('.') || undefined, message: i.message }));

/** Parses and replaces body / query / params with the validated (coerced, defaulted) values */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const issues: ReturnType<typeof formatIssues> = [];

    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key] ?? {});
      if (!result.success) {
        issues.push(...formatIssues(result.error, key));
        continue;
      }
      // Express 5 makes req.query a getter, so define the property instead of assigning
      Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true, enumerable: true });
    }

    if (issues.length) throw new ValidationError(issues);
    next();
  };
}
