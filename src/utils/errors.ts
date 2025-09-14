export abstract class BaseError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'BaseError';
  }

  withStatus(status: number) {
    this.status = status;
    return this;
  }
}

// UserError is a generic error class for user-facing errors.
// These are safe to be sent to the client, and should be presented to the user.
// They can be either 4xx or 5xx status error codes, depending on the error, so they are not always client errors,
// they are just errors that are safe to present to the user.
export class UserError extends BaseError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'UserError';
  }
}

// ServerError is a generic error class for server-side errors.
// These should not be sent to the client (unless caught and handled as a UserError).
// They will result in a 500 Internal Server Error response, and the message will be logged.
export class ServerError extends BaseError {
  constructor(message: string) {
    super(message, 500);
    this.name = 'ServerError';
  }
}
