class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields; // optional { fieldName: 'message' } for form errors
  }
}

// Lets async route handlers throw, and sends the error to the error middleware.
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const isId = (v) => /^[a-f\d]{24}$/i.test(String(v || ''));

module.exports = { HttpError, ah, isId };
