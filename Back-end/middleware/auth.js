import jwt from 'jsonwebtoken';
import User from '../models/userSchema.js';
import { apiResponse } from '../utils/apiResponse.js';

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return apiResponse(res, { statusCode: 401, message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return apiResponse(res, { statusCode: 401, message: 'User not found' });
    }
    next();
  } catch (error) {
    return apiResponse(res, { statusCode: 401, message: 'Token is invalid or expired' });
  }
};


export const isAdmin = async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized: User not logged in' });
      }
  
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Admins only' });
      }
  
      next();
    } catch (error) {
      console.error('isAdmin middleware error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };
  