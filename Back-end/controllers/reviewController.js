import Review from '../models/reviewSchema.js';
import RepairRequest from '../models/repairRequestSchema.js';
import TechnicianProfile from '../models/technicianSchema.js';
import { apiResponse } from '../utils/apiResponse.js';

// Helper function to update technician's average rating
const updateTechnicianRating = async (technicianId) => {
  try {
    const reviews = await Review.find({ technicianId });
    
    if (reviews.length === 0) return;
    
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    
    // Calculate aspect averages
    const aspectTotals = {
      quality: 0,
      timeliness: 0,
      communication: 0,
      pricing: 0
    };
    
    const aspectCounts = {
      quality: 0,
      timeliness: 0,
      communication: 0,
      pricing: 0
    };
    
    reviews.forEach(review => {
      if (review.aspects) {
        Object.keys(aspectTotals).forEach(aspect => {
          if (review.aspects[aspect]) {
            aspectTotals[aspect] += review.aspects[aspect];
            aspectCounts[aspect]++;
          }
        });
      }
    });
    
    const aspectAverages = {};
    Object.keys(aspectTotals).forEach(aspect => {
      aspectAverages[aspect] = aspectCounts[aspect] > 0 
        ? aspectTotals[aspect] / aspectCounts[aspect] 
        : 0;
    });
    
    await TechnicianProfile.findOneAndUpdate(
      { userId: technicianId },
      {
        'rating.average': Number(averageRating.toFixed(2)),
        'rating.count': reviews.length,
        'rating.aspects': aspectAverages
      }
    );
  } catch (error) {
    console.error('Error updating technician rating:', error);
  }
};

export const createReview = async (req, res) => {
  try {
    const { repairRequestId, technicianId, rating, comment, aspects, isRecommended } = req.body;
    
    // Verify repair request is completed
    const repairRequest = await RepairRequest.findById(repairRequestId);
    if (!repairRequest) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Repair request not found'
      });
    }

    if (repairRequest.status !== 'completed') {
      return apiResponse(res, {
        statusCode: 400,
        message: 'Can only review completed repair requests'
      });
    }

    if (repairRequest.customerId.toString() !== req.user._id.toString()) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Only the customer can review this repair'
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ repairRequestId });
    if (existingReview) {
      return apiResponse(res, {
        statusCode: 400,
        message: 'Review already exists for this repair request'
      });
    }

    const review = await Review.create({
      repairRequestId,
      customerId: req.user._id,
      technicianId,
      rating,
      comment,
      aspects,
      isRecommended
    });

    // Update technician's average rating
    await updateTechnicianRating(technicianId);

    await review.populate([
      { path: 'customerId', select: 'name profileImage' },
      { path: 'technicianId', select: 'name' },
      { path: 'repairRequestId', select: 'title' }
    ]);

    return apiResponse(res, {
      statusCode: 201,
      message: 'Review created successfully',
      data: review
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error creating review',
      error: error.message
    });
  }
};

export const getTechnicianReviews = async (req, res) => {
  try {
    const { technicianId } = req.params;
    const { page = 1, limit = 10, minRating, maxRating } = req.query;
    
    const filter = { technicianId };
    
    // Add rating filter if provided
    if (minRating || maxRating) {
      filter.rating = {};
      if (minRating) filter.rating.$gte = parseInt(minRating);
      if (maxRating) filter.rating.$lte = parseInt(maxRating);
    }
    
    const reviews = await Review.find(filter)
      .populate('customerId', 'name profileImage')
      .populate('repairRequestId', 'title deviceInfo')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(filter);
    
    // Calculate rating statistics
    const ratingStats = await Review.aggregate([
      { $match: { technicianId: technicianId } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);

    return apiResponse(res, {
      statusCode: 200,
      message: 'Reviews retrieved successfully',
      data: {
        reviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        stats: ratingStats[0] || { averageRating: 0, totalReviews: 0 }
      }
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching reviews',
      error: error.message
    });
  }
};

export const getCustomerReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const reviews = await Review.find({ customerId: req.user._id })
      .populate('technicianId', 'name profileImage')
      .populate('repairRequestId', 'title deviceInfo status')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments({ customerId: req.user._id });

    return apiResponse(res, {
      statusCode: 200,
      message: 'Your reviews retrieved successfully',
      data: {
        reviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching your reviews',
      error: error.message
    });
  }
};

export const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment, aspects, isRecommended } = req.body;
    
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Review not found'
      });
    }

    // Only the customer who created the review can update it
    if (review.customerId.toString() !== req.user._id.toString()) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Not authorized to update this review'
      });
    }

    // Check if review is not too old (e.g., 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (review.createdAt < thirtyDaysAgo) {
      return apiResponse(res, {
        statusCode: 400,
        message: 'Cannot update review older than 30 days'
      });
    }

    const updatedReview = await Review.findByIdAndUpdate(
      reviewId,
      {
        rating,
        comment,
        aspects,
        isRecommended,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).populate([
      { path: 'customerId', select: 'name profileImage' },
      { path: 'technicianId', select: 'name' },
      { path: 'repairRequestId', select: 'title' }
    ]);

    // Update technician's average rating
    await updateTechnicianRating(review.technicianId);

    return apiResponse(res, {
      statusCode: 200,
      message: 'Review updated successfully',
      data: updatedReview
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error updating review',
      error: error.message
    });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Review not found'
      });
    }

    // Only the customer who created the review can delete it
    if (review.customerId.toString() !== req.user._id.toString()) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Not authorized to delete this review'
      });
    }

    const technicianId = review.technicianId;
    await Review.findByIdAndDelete(reviewId);

    // Update technician's average rating after deletion
    await updateTechnicianRating(technicianId);

    return apiResponse(res, {
      statusCode: 200,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error deleting review',
      error: error.message
    });
  }
};

export const getReviewById = async (req, res) => {
  try {
    const { reviewId } = req.params;
    
    const review = await Review.findById(reviewId)
      .populate('customerId', 'name profileImage')
      .populate('technicianId', 'name profileImage')
      .populate('repairRequestId', 'title deviceInfo');

    if (!review) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Review not found'
      });
    }

    return apiResponse(res, {
      statusCode: 200,
      message: 'Review retrieved successfully',
      data: review
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching review',
      error: error.message
    });
  }
};

export const reportReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reason, description } = req.body;
    
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Review not found'
      });
    }

    // Add report to review
    review.reports = review.reports || [];
    review.reports.push({
      reporterId: req.user._id,
      reason,
      description,
      reportedAt: new Date()
    });

    await review.save();

    return apiResponse(res, {
      statusCode: 200,
      message: 'Review reported successfully'
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error reporting review',
      error: error.message
    });
  }
};