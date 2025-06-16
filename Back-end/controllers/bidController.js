import Bid from '../models/bidSchema.js';
import RepairRequest from '../models/repairRequestSchema.js';
import Notification from '../models/notificationSchema.js';
import TechnicianProfile from '../models/technicianSchema.js';
import User from '../models/userSchema.js';
import { apiResponse } from '../utils/apiResponse.js';
import { sendPushNotification } from '../utils/sendPushNotification.js';

// Helper function to parse estimated time string
const parseEstimatedTime = (timeString) => {
  if (!timeString) {
    throw new Error('Estimated time is required');
  }

  const timeStr = timeString.toLowerCase().trim();
  
  // Parse different time formats
  if (timeStr === 'same day') {
    return { value: 8, unit: 'hours' }; // Assuming same day = 8 hours
  }
  
  if (timeStr.includes('hour')) {
    const match = timeStr.match(/(\d+)/);
    if (match) {
      return { value: parseInt(match[1]), unit: 'hours' };
    }
  }
  
  if (timeStr.includes('day')) {
    // Handle ranges like "1-2 days", "2-3 days"
    const rangeMatch = timeStr.match(/(\d+)-(\d+)\s*days?/);
    if (rangeMatch) {
      // Take the average of the range
      const min = parseInt(rangeMatch[1]);
      const max = parseInt(rangeMatch[2]);
      return { value: Math.ceil((min + max) / 2), unit: 'days' };
    }
    
    // Handle single numbers like "3 days", "5 days"
    const singleMatch = timeStr.match(/(\d+)\s*days?/);
    if (singleMatch) {
      return { value: parseInt(singleMatch[1]), unit: 'days' };
    }
  }
  
  if (timeStr.includes('week')) {
    // Handle ranges like "3-4 weeks"
    const rangeMatch = timeStr.match(/(\d+)-(\d+)\s*weeks?/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1]);
      const max = parseInt(rangeMatch[2]);
      const avgWeeks = Math.ceil((min + max) / 2);
      return { value: avgWeeks * 7, unit: 'days' }; // Convert weeks to days
    }
    
    // Handle single numbers like "1 week", "2 weeks"
    const singleMatch = timeStr.match(/(\d+)\s*weeks?/);
    if (singleMatch) {
      const weeks = parseInt(singleMatch[1]);
      return { value: weeks * 7, unit: 'days' }; // Convert weeks to days
    }
  }
  
  // Default fallback
  throw new Error('Invalid estimated time format');
};

export const createBid = async (req, res) => {
  try {
    const { repairRequestId, amount, estimatedTime, description, partsIncluded, warranty, message } = req.body;
    console.log('Original estimated time:', estimatedTime);
    
    // Check if technician role
    if (req.user.role !== 'technician') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Only technicians can create bids'
      });
    }

    // Check if repair request exists and is open
    const repairRequest = await RepairRequest.findById(repairRequestId)
      .populate('customerId', 'name email expoPushToken');
    
    if (!repairRequest) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Repair request not found'
      });
    }

    if (repairRequest.status !== 'open' && repairRequest.status !== 'bidding') {
      return apiResponse(res, {
        statusCode: 400,
        message: 'This repair request is no longer accepting bids'
      });
    }

    // Check if technician already bid on this request
    const existingBid = await Bid.findOne({
      repairRequestId,
      technicianId: req.user._id
    });

    if (existingBid) {
      return apiResponse(res, {
        statusCode: 400,
        message: 'You have already placed a bid on this repair request'
      });
    }

    // Parse estimated time from string to object
    let parsedEstimatedTime;
    try {
      parsedEstimatedTime = parseEstimatedTime(estimatedTime);
      console.log('Parsed estimated time:', parsedEstimatedTime);
    } catch (error) {
      return apiResponse(res, {
        statusCode: 400,
        message: 'Invalid estimated time format'
      });
    }

    const bid = await Bid.create({
      repairRequestId,
      technicianId: req.user._id,
      amount,
      estimatedTime: parsedEstimatedTime, // Use parsed object instead of string
      description,
      partsIncluded: partsIncluded || [],
      warranty,
      message,
      status: 'pending'
    });

    // Update repair request status to bidding
    await RepairRequest.findByIdAndUpdate(repairRequestId, { status: 'bidding' });

    // Create notification for customer
    await Notification.create({
      userId: repairRequest.customerId._id,
      type: 'new_bid',
      title: 'New Bid Received',
      message: `You received a new bid of PKR ${amount} for your repair request "${repairRequest.title}"`,
      data: {
        repairRequestId,
        bidId: bid._id
      }
    });

    // Send push notification to customer
    if (repairRequest.customerId.expoPushToken) {
      await sendPushNotification(
        repairRequest.customerId.expoPushToken,
        '💰 New Bid Received',
        `PKR ${amount} for "${repairRequest.title}"`
      );
    }

    await bid.populate([
      { path: 'technicianId', select: 'name email phone profileImage' },
      { 
        path: 'technicianId',
        populate: {
          path: 'technicianProfile',
          model: 'TechnicianProfile',
          select: 'rating experience specializations serviceRadius'
        }
      }
    ]);

    // Emit real-time notification to customer
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${repairRequest.customerId._id}`).emit('new_bid', {
        bid,
        repairRequest: {
          id: repairRequest._id,
          title: repairRequest.title
        }
      });
    }

    return apiResponse(res, {
      statusCode: 201,
      message: 'Bid created successfully',
      data: bid
    });
  } catch (error) {
    console.log("error", error)
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error creating bid',
      error: error.message
    });
  }
};

export const getBidsForRepairRequest = async (req, res) => {
  try {
    const { repairRequestId } = req.params;
    const { sortBy = 'amount', order = 'asc' } = req.query;
    
    const repairRequest = await RepairRequest.findById(repairRequestId);
    if (!repairRequest) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Repair request not found'
      });
    }

    // Only customer who owns the request can see all bids
    if (req.user.role === 'customer' && repairRequest.customerId.toString() !== req.user._id.toString()) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Not authorized to view bids for this repair request'
      });
    }

    const sortOrder = order === 'desc' ? -1 : 1;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder;

    const bids = await Bid.find({ repairRequestId })
      .populate('technicianId', 'name email phone profileImage')
      .populate({
        path: 'technicianId',
        populate: {
          path: 'technicianProfile',
          model: 'TechnicianProfile',
          select: 'rating experience specializations serviceRadius bio'
        }
      })
      .sort(sortOptions);

    return apiResponse(res, {
      statusCode: 200,
      message: 'Bids retrieved successfully',
      data: bids
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching bids',
      error: error.message
    });
  }
};

export const getTechnicianBids = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = { technicianId: req.user._id };
    
    if (status) filter.status = status;

    const bids = await Bid.find(filter)
      .populate('repairRequestId', 'title description deviceInfo status location urgency')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bid.countDocuments(filter);

    return apiResponse(res, {
      statusCode: 200,
      message: 'Your bids retrieved successfully',
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
      message: 'Error fetching your bids',
      error: error.message
    });
  }
};

export const getCustomerBids = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    // Get all repair requests for this customer
    const repairRequests = await RepairRequest.find({ customerId: req.user._id });
    const repairRequestIds = repairRequests.map(req => req._id);
    
    const filter = { repairRequestId: { $in: repairRequestIds } };
    if (status) filter.status = status;

    const bids = await Bid.find(filter)
      .populate('technicianId', 'name email phone profileImage')
      .populate({
        path: 'technicianId',
        populate: {
          path: 'technicianProfile',
          model: 'TechnicianProfile',
          select: 'rating experience specializations'
        }
      })
      .populate('repairRequestId', 'title description deviceInfo status')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bid.countDocuments(filter);

    return apiResponse(res, {
      statusCode: 200,
      message: 'Bids for your requests retrieved successfully',
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
    console.log('error',error)
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching bids',
      error: error.message
    });
  }
};

export const acceptBid = async (req, res) => {
  try {
    const { bidId } = req.params;
    
    const bid = await Bid.findById(bidId)
      .populate('repairRequestId')
      .populate('technicianId', 'name email expoPushToken');
    
    if (!bid) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Bid not found'
      });
    }

    // Check if user is the customer who owns the repair request
    if (bid.repairRequestId.customerId.toString() !== req.user._id.toString()) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Not authorized to accept this bid'
      });
    }

    if (bid.status !== 'pending') {
      return apiResponse(res, {
        statusCode: 400,
        message: 'This bid has already been processed'
      });
    }

    // Update bid status
    bid.status = 'accepted';
    bid.acceptedAt = new Date();
    await bid.save();

    // Update repair request
    await RepairRequest.findByIdAndUpdate(bid.repairRequestId._id, {
      status: 'assigned',
      acceptedBid: bid._id,
      assignedTechnician: bid.technicianId._id
    });

    // Reject all other bids for this repair request
    await Bid.updateMany(
      { 
        repairRequestId: bid.repairRequestId._id, 
        _id: { $ne: bidId },
        status: 'pending'
      },
      { 
        status: 'rejected',
        rejectedAt: new Date()
      }
    );

    // Create notification for technician
    await Notification.create({
      userId: bid.technicianId._id,
      type: 'bid_accepted',
      title: 'Bid Accepted!',
      message: `Your bid of PKR ${bid.amount} has been accepted for "${bid.repairRequestId.title}"`,
      data: {
        repairRequestId: bid.repairRequestId._id,
        bidId: bid._id
      }
    });

    // Send push notification to technician
    if (bid.technicianId.expoPushToken) {
      await sendPushNotification(
        bid.technicianId.expoPushToken,
        '🎉 Bid Accepted!',
        `Your bid of PKR ${bid.amount} has been accepted`
      );
    }

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${bid.technicianId._id}`).emit('bid_accepted', {
        bid,
        repairRequest: bid.repairRequestId
      });
    }

    return apiResponse(res, {
      statusCode: 200,
      message: 'Bid accepted successfully',
      data: bid
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error accepting bid',
      error: error.message
    });
  }
};

export const rejectBid = async (req, res) => {
  try {
    const { bidId } = req.params;
    const { reason } = req.body;
    
    const bid = await Bid.findById(bidId)
      .populate('repairRequestId')
      .populate('technicianId', 'name email expoPushToken');
    
    if (!bid) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Bid not found'
      });
    }

    // Check if user is the customer who owns the repair request
    if (bid.repairRequestId.customerId.toString() !== req.user._id.toString()) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Not authorized to reject this bid'
      });
    }

    if (bid.status !== 'pending') {
      return apiResponse(res, {
        statusCode: 400,
        message: 'This bid has already been processed'
      });
    }

    // Update bid status
    bid.status = 'rejected';
    bid.rejectedAt = new Date();
    bid.rejectionReason = reason;
    await bid.save();

    // Create notification for technician
    await Notification.create({
      userId: bid.technicianId._id,
      type: 'bid_rejected',
      title: 'Bid Rejected',
      message: `Your bid of PKR ${bid.amount} has been rejected for "${bid.repairRequestId.title}"`,
      data: {
        repairRequestId: bid.repairRequestId._id,
        bidId: bid._id,
        reason
      }
    });

    // Send push notification to technician
    if (bid.technicianId.expoPushToken) {
      await sendPushNotification(
        bid.technicianId.expoPushToken,
        '❌ Bid Rejected',
        `Your bid of PKR ${bid.amount} has been rejected`
      );
    }

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${bid.technicianId._id}`).emit('bid_rejected', {
        bid,
        repairRequest: bid.repairRequestId,
        reason
      });
    }

    return apiResponse(res, {
      statusCode: 200,
      message: 'Bid rejected successfully'
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error rejecting bid',
      error: error.message
    });
  }
};