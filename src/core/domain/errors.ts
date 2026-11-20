// Domain errors. Outer layers translate these into HTTP status codes;
// the core never knows about HTTP.

export abstract class DomainError extends Error {
  abstract readonly kind: "validation" | "not_found" | "conflict" | "unauthorized";
  constructor(message: string, readonly detail?: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  readonly kind = "validation" as const;
}

export class NotFoundError extends DomainError {
  readonly kind = "not_found" as const;
}

/** Duplicate key, or a relation that does not exist / is still referenced. */
export class ConflictError extends DomainError {
  readonly kind = "conflict" as const;
}

export class UnauthorizedError extends DomainError {
  readonly kind = "unauthorized" as const;
}
