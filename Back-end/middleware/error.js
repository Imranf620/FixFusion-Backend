import { apiResponse } from "../utils/apiResponse.js";

const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // Handle wrong MongoDB ID error (CastError)
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Resource not found. Invalid: ${err.path}`;
  }

  // Handle Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 400;
    message = `Duplicate ${Object.keys(err.keyValue)} entered`;
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 400;
    message = `Json Web Token is invalid, Try again`;
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 400;
    message = `Json Web Token is expired, Try again`;
  }

  return apiResponse(res, {
    statusCode,
    message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    data: null,
  });
};

export default errorMiddleware;
