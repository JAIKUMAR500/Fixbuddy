import mongoose from "mongoose";
import { httpError } from "../utils/asyncHandler.js";

export function paramObjectId(...names) {
  return (req, res, next) => {
    for (const name of names) {
      const value = req.params[name];
      if (value && !mongoose.isValidObjectId(value)) {
        return next(httpError(400, "Invalid ID"));
      }
    }
    next();
  };
}

export function queryObjectId(name) {
  return (req, res, next) => {
    const value = req.query[name];
    if (value && !mongoose.isValidObjectId(String(value))) {
      return next(httpError(400, "Invalid ID"));
    }
    next();
  };
}

export function isValidObjectId(value) {
  return mongoose.isValidObjectId(value);
}
