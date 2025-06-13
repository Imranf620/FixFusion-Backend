import express from "express";
import { protect } from "../middleware/auth.js";
import {
  createReview,
  getTechnicianReviews,
  getCustomerReviews,
  updateReview,
  deleteReview,
  getReviewById,
  reportReview
} from "../controllers/reviewController.js";

const router = express.Router();

router.post('/', protect, createReview);
router.get('/technician/:technicianId', getTechnicianReviews);
router.get('/my-reviews', protect, getCustomerReviews);
router.get('/:reviewId', getReviewById);
router.put('/:reviewId', protect, updateReview);
router.delete('/:reviewId', protect, deleteReview);
router.post('/:reviewId/report', protect, reportReview);

export default router;
