// routes/bidRoutes.js
import express from "express";
import { protect } from "../middleware/auth.js";
import {
  createBid,
  getBidsForRepairRequest,
  getTechnicianBids,
  acceptBid,
  rejectBid
} from "../controllers/bidController.js";

const router = express.Router();

router.post('/', protect, createBid);
router.get('/repair-request/:repairRequestId', protect, getBidsForRepairRequest);
router.get('/my-bids', protect, getTechnicianBids);
router.put('/:bidId/accept', protect, acceptBid);
router.put('/:bidId/reject', protect, rejectBid);

export default router;