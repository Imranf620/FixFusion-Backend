import User from '../models/userSchema.js';
import TechnicianProfile from '../models/technicianSchema.js';
import RepairRequest from '../models/repairRequestSchema.js';
import Bid from '../models/bidSchema.js';
import Review from '../models/reviewSchema.js';
import Chat from '../models/chatSchema.js';
import Message from '../models/messageSchema.js';
import Notification from '../models/notificationSchema.js';
import { apiResponse } from '../utils/apiResponse.js';

// Dashboard Analytics
export const getDashboardStats = async (req, res) => {
  try {
    // Check admin role
    if (req.user.role !== 'admin') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const stats = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'technician' }),
      TechnicianProfile.countDocuments({ isApproved: true }),
      TechnicianProfile.countDocuments({ isApproved: false }),
      RepairRequest.countDocuments(),
      RepairRequest.countDocuments({ status: 'completed' }),
      Bid.countDocuments(),
      Review.countDocuments()
    ]);

    const [
      totalCustomers,
      totalTechnicians,
      approvedTechnicians,
      pendingTechnicians,
      totalRepairRequests,
      completedRepairs,
      totalBids,
      totalReviews
    ] = stats;

    // Recent activity
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt');

    const recentRepairRequests = await RepairRequest.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('customerId', 'name email')
      .select('title status createdAt customerId');

    // Monthly statistics
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const monthlyStats = await Promise.all([
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      RepairRequest.countDocuments({ createdAt: { $gte: startOfMonth } }),
      RepairRequest.countDocuments({ 
        status: 'completed', 
        updatedAt: { $gte: startOfMonth } 
      })
    ]);

    const [newUsersThisMonth, newRequestsThisMonth, completedThisMonth] = monthlyStats;

    return apiResponse(res, {
      statusCode: 200,
      message: 'Dashboard stats retrieved successfully',
      data: {
        overview: {
          totalCustomers,
          totalTechnicians,
          approvedTechnicians,
          pendingTechnicians,
          totalRepairRequests,
          completedRepairs,
          totalBids,
          totalReviews
        },
        monthly: {
          newUsers: newUsersThisMonth,
          newRequests: newRequestsThisMonth,
          completedRepairs: completedThisMonth
        },
        recent: {
          users: recentUsers,
          repairRequests: recentRepairRequests
        }
      }
    });
  } catch (error) {
    console.log('err', error)    
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching dashboard stats',
      error: error.message
    });
  }
};

// User Management
export const getAllUsers = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { page = 1, limit = 10, role, status, search } = req.query;
    const filter = {};
    
    if (role && role !== 'all') filter.role = role;
    if (status && status !== 'all') filter.isActive = status === 'active';
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    return apiResponse(res, {
      statusCode: 200,
      message: 'Users retrieved successfully',
      data: {
        users,
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
      message: 'Error fetching users',
      error: error.message
    });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { userId } = req.params;
    const { isActive, reason } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        isActive,
        ...(reason && { statusReason: reason })
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'User not found'
      });
    }

    // Create notification for user
    await Notification.create({
      userId: user._id,
      type: isActive ? 'account_activated' : 'account_suspended',
      title: isActive ? 'Account Activated' : 'Account Suspended',
      message: isActive 
        ? 'Your account has been activated by admin'
        : `Your account has been suspended. Reason: ${reason || 'Policy violation'}`,
      data: { reason }
    });

    return apiResponse(res, {
      statusCode: 200,
      message: `User ${isActive ? 'activated' : 'suspended'} successfully`,
      data: user
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error updating user status',
      error: error.message
    });
  }
};

// Technician Management
export const getPendingTechnicians = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { page = 1, limit = 10, includeRejected = false } = req.query;
    
    // Build filter - include rejected if requested
    const filter = includeRejected === 'true' 
      ? { $or: [{ isApproved: false }, { rejectedAt: { $exists: true } }] }
      : { isApproved: false, rejectedAt: { $exists: false } };

    const technicians = await TechnicianProfile.find(filter)
      .populate({
        path: 'userId', 
        select: 'name email phone profileImage createdAt isVerified isActive location',
        match: { isActive: true } // Only show active users
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Filter out technicians whose user account is inactive
    const activeTechnicians = technicians.filter(tech => tech.userId);

    const total = await TechnicianProfile.countDocuments({
      ...filter,
      userId: { $in: await User.find({ isActive: true }).distinct('_id') }
    });

    // Add computed fields for better frontend handling
    const enrichedTechnicians = activeTechnicians.map(tech => ({
      ...tech.toObject(),
      status: tech.isApproved ? 'approved' : 
              tech.rejectedAt ? 'rejected' : 'pending',
      userStatus: {
        isActive: tech.userId.isActive,
        isVerified: tech.userId.isVerified,
        needsSync: tech.isApproved && !tech.userId.isVerified
      },
      canApprove: tech.userId.isActive && !tech.isApproved,
      daysSinceSubmission: Math.floor((new Date() - tech.createdAt) / (1000 * 60 * 60 * 24)),
      location: tech.userId.location || {},

    }));
    

    return apiResponse(res, {
      statusCode: 200,
      message: 'Pending technicians retrieved successfully',
      data: {
        technicians: enrichedTechnicians,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        summary: {
          totalPending: await TechnicianProfile.countDocuments({ 
            isApproved: false, 
            rejectedAt: { $exists: false } 
          }),
          totalRejected: await TechnicianProfile.countDocuments({ 
            rejectedAt: { $exists: true } 
          }),
          totalApproved: await TechnicianProfile.countDocuments({ 
            isApproved: true 
          })
        }
      }
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching pending technicians',
      error: error.message
    });
  }
};


export const approveTechnician = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { technicianId } = req.params;
    const { approved, reason } = req.body;

    // Find the technician profile
    const technicianProfile = await TechnicianProfile.findById(technicianId)
      .populate('userId', 'name email isVerified isActive');

    if (!technicianProfile) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Technician profile not found'
      });
    }

    const user = technicianProfile.userId;

    // Check if user account is active
    if (!user.isActive) {
      return apiResponse(res, {
        statusCode: 400,
        message: 'Cannot approve technician with inactive user account'
      });
    }

    // Update technician profile
    const updatedTechnicianProfile = await TechnicianProfile.findByIdAndUpdate(
      technicianId,
      { 
        isApproved: approved,
        approvedAt: approved ? new Date() : null,
        approvedBy: approved ? req.user._id : null,
        rejectedAt: !approved ? new Date() : null,
        rejectionReason: !approved && reason ? reason : null,
        ...(reason && { approvalReason: reason })
      },
      { new: true }
    ).populate('userId', 'name email phone');

    // Sync user verification status with technician approval
    if (approved) {
      // If technician is approved, ensure user is also verified
      await User.findByIdAndUpdate(user._id, { 
        isVerified: true,
        lastLogin: null // Reset to force fresh login after approval
      });
    } else {
      // If technician is rejected, ensure user verification is set to false
      await User.findByIdAndUpdate(user._id, { 
        isVerified: false 
      });
    }

    // Create notification for technician
    await Notification.create({
      userId: user._id,
      type: approved ? 'profile_approved' : 'profile_rejected',
      title: approved ? 'Profile Approved!' : 'Profile Rejected',
      message: approved 
        ? 'Congratulations! Your technician profile has been approved. You can now receive repair requests and start working.'
        : `Your technician profile has been rejected. Reason: ${reason || 'Does not meet our requirements'}. You can update your profile and reapply.`,
      data: { 
        reason,
        canReapply: !approved,
        profileId: technicianProfile._id
      },
      priority: 'high'
    });

    // Log admin action
    console.log(`Admin ${req.user.name} (${req.user.email}) ${approved ? 'approved' : 'rejected'} technician ${user.name} (${user.email})`);

    return apiResponse(res, {
      statusCode: 200,
      message: `Technician ${approved ? 'approved' : 'rejected'} successfully`,
      data: {
        technician: updatedTechnicianProfile,
        userVerified: approved,
        notificationSent: true
      }
    });
  } catch (error) {
    console.error('Error in approveTechnician:', error);
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error updating technician approval',
      error: error.message
    });
  }
};
// Repair Request Management
export const getAllRepairRequests = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { page = 1, limit = 10, status, search } = req.query;
    const filter = {};
    
    if (status && status !== 'all') filter.status = status;
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const requests = await RepairRequest.find(filter)
      .populate('customerId', 'name email phone')
      .populate('assignedTechnician', 'name email phone')
      .populate('acceptedBid', 'amount technicianId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await RepairRequest.countDocuments(filter);

    return apiResponse(res, {
      statusCode: 200,
      message: 'Repair requests retrieved successfully',
      data: {
        requests,
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
      message: 'Error fetching repair requests',
      error: error.message
    });
  }
};

export const getRepairRequestDetails = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { requestId } = req.params;

    const request = await RepairRequest.findById(requestId)
      .populate('customerId', 'name email phone profileImage location')
      .populate('assignedTechnician', 'name email phone profileImage')
      .populate({
        path: 'acceptedBid',
        populate: {
          path: 'technicianId',
          select: 'name email phone'
        }
      });

    if (!request) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Repair request not found'
      });
    }

    // Get all bids for this request
    const bids = await Bid.find({ repairRequestId: requestId })
      .populate('technicianId', 'name email phone profileImage')
      .sort({ createdAt: -1 });

    // Get reviews if completed
    let review = null;
    if (request.status === 'completed') {
      review = await Review.findOne({ repairRequestId: requestId })
        .populate('customerId', 'name email')
        .populate('technicianId', 'name email');
    }

    return apiResponse(res, {
      statusCode: 200,
      message: 'Repair request details retrieved successfully',
      data: {
        request,
        bids,
        review
      }
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching repair request details',
      error: error.message
    });
  }
};

// Bid Management
export const getAllBids = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { page = 1, limit = 10, status, search } = req.query;
    const filter = {};
    
    if (status && status !== 'all') filter.status = status;

    const bids = await Bid.find(filter)
      .populate('technicianId', 'name email phone')
      .populate('repairRequestId', 'title status customerId')
      .populate({
        path: 'repairRequestId',
        populate: {
          path: 'customerId',
          select: 'name email'
        }
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bid.countDocuments(filter);

    return apiResponse(res, {
      statusCode: 200,
      message: 'Bids retrieved successfully',
      data: {
        bids,
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
      message: 'Error fetching bids',
      error: error.message
    });
  }
};

// Review Management
export const getAllReviews = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { page = 1, limit = 10, rating, search } = req.query;
    const filter = {};
    
    if (rating && rating !== 'all') {
      filter.rating = parseInt(rating);
    }

    if (search) {
      filter.$or = [
        { comment: { $regex: search, $options: 'i' } }
      ];
    }

    const reviews = await Review.find(filter)
      .populate('customerId', 'name email')
      .populate('technicianId', 'name email')
      .populate('repairRequestId', 'title')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(filter);

    // Calculate average rating
    const avgRatingResult = await Review.aggregate([
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);
    const avgRating = avgRatingResult.length > 0 ? avgRatingResult[0].avgRating : 0;

    return apiResponse(res, {
      statusCode: 200,
      message: 'Reviews retrieved successfully',
      data: {
        reviews,
        avgRating: Math.round(avgRating * 100) / 100,
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
      message: 'Error fetching reviews',
      error: error.message
    });
  }
};

// System Settings
export const getSystemSettings = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // This would typically come from a settings collection
    const settings = {
      platformCommission: 5, // percentage
      maxBidsPerRequest: 10,
      bidValidityHours: 48,
      requestExpiryDays: 7,
      maxServiceRadius: 50,
      minServiceRadius: 1,
      supportEmail: 'support@repairplatform.com',
      supportPhone: '+92-300-1234567'
    };

    return apiResponse(res, {
      statusCode: 200,
      message: 'System settings retrieved successfully',
      data: settings
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching system settings',
      error: error.message
    });
  }
};

export const updateSystemSettings = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const updates = req.body;
    
    // Validate settings
    if (updates.platformCommission && (updates.platformCommission < 0 || updates.platformCommission > 50)) {
      return apiResponse(res, {
        statusCode: 400,
        message: 'Platform commission must be between 0 and 50 percent'
      });
    }

    // In a real app, you would update a settings collection
    // For now, just return the updated settings
    return apiResponse(res, {
      statusCode: 200,
      message: 'System settings updated successfully',
      data: updates
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error updating system settings',
      error: error.message
    });
  }
};

// Analytics
export const getAnalytics = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { period = '30d' } = req.query;
    
    let startDate;
    const endDate = new Date();
    
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // User registrations over time
    const userRegistrations = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            role: "$role"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.date": 1 } }
    ]);

    // Request completion rates
    const completionStats = await RepairRequest.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Top performing technicians
    const topTechnicians = await Review.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$technicianId",
          avgRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 }
        }
      },
      { $match: { reviewCount: { $gte: 3 } } },
      { $sort: { avgRating: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'technician'
        }
      },
      { $unwind: '$technician' },
      {
        $project: {
          name: '$technician.name',
          email: '$technician.email',
          avgRating: 1,
          reviewCount: 1
        }
      }
    ]);

    return apiResponse(res, {
      statusCode: 200,
      message: 'Analytics data retrieved successfully',
      data: {
        userRegistrations,
        completionStats,
        topTechnicians,
        period
      }
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching analytics data',
      error: error.message
    });
  }
};

// Notification Management
export const sendBulkNotification = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { userRole, title, message, type = 'system_update', priority = 'medium' } = req.body;

    if (!title || !message) {
      return apiResponse(res, {
        statusCode: 400,
        message: 'Title and message are required'
      });
    }

    const filter = userRole && userRole !== 'all' ? { role: userRole } : {};
    const users = await User.find(filter).select('_id');

    const notifications = users.map(user => ({
      userId: user._id,
      type,
      title,
      message,
      priority
    }));

    await Notification.insertMany(notifications);

    return apiResponse(res, {
      statusCode: 200,
      message: `Notification sent to ${notifications.length} users successfully`
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error sending bulk notification',
      error: error.message
    });
  }
};