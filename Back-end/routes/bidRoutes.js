// routes/bidRoutes.js
import express from "express";
import { protect } from "../middleware/auth.js";
import {
  createBid,
  getBidsForRepairRequest,
  getTechnicianBids,
  getCustomerBids,
  acceptBid,
  rejectBid
} from "../controllers/bidController.js";

const router = express.Router();

// Technician routes
router.post('/', protect, createBid);
router.get('/my-bids', protect, getTechnicianBids);

// Customer routes
router.get('/my-received-bids', protect, getCustomerBids);
router.get('/repair-request/:repairRequestId', protect, getBidsForRepairRequest);
router.put('/:bidId/accept', protect, acceptBid);
router.put('/:bidId/reject', protect, rejectBid);

export default router;
