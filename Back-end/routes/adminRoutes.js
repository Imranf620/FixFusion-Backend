import express from "express";
import { protect, isAdmin } from "../middleware/auth.js";
import {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  getPendingTechnicians,
  approveTechnician,
  getAllRepairRequests,
  getRepairRequestDetails,
  getAllBids,
  getAllReviews
} from "../controllers/adminController.js";

const router = express.Router();

// Dashboard
router.get('/dashboard', protect, isAdmin, getDashboardStats);

// User Management
router.get('/users', protect, isAdmin, getAllUsers);
router.put('/users/:userId/status', protect, isAdmin, updateUserStatus);

// Technician Management
router.get('/technicians/pending', protect, isAdmin, getPendingTechnicians);
router.put('/technicians/:technicianId/approve', protect, isAdmin, approveTechnician);

// Repair Request Management
router.get('/repair-requests', protect, isAdmin, getAllRepairRequests);
router.get('/repair-requests/:requestId', protect, isAdmin, getRepairRequestDetails);

// Bid Management
router.get('/bids', protect, isAdmin, getAllBids);

// Review Management
router.get('/reviews', protect, isAdmin, getAllReviews);

export default router;
