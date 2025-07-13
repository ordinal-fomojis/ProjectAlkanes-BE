// UserError is a generic error class for user-facing errors.
// These are safe to be sent to the client, and should be presented to the user.
export class UserError extends Error {
  status = 400

  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }

  withStatus(status: number) {
    this.status = status;
    return this;
  }
}

// ServerError is a generic error class for server-side errors.
// These should not be sent to the client (unless caught and handled as a UserError).
// They will result in a 500 Internal Server Error response, and the message will be logged.
export class ServerError extends Error {
  status = 500

  constructor(message: string) {
    super(message);
    this.name = 'ServerError';
  }

  withStatus(status: number) {
    this.status = status;
    return this;
  }
}
