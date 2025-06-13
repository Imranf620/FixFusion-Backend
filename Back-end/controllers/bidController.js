import Bid from '../models/bidSchema.js';
import RepairRequest from '../models/repairRequestSchema.js';
import Notification from '../models/notificationSchema.js'

export const createBid = async (req, res) => {
  try {
    const { repairRequestId, amount, estimatedTime, description, partsIncluded, warranty, message } = req.body;
    
    // Check if technician role
    if (req.user.role !== 'technician') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Only technicians can create bids'
      });
    }

    // Check if repair request exists and is open
    const repairRequest = await RepairRequest.findById(repairRequestId);
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

    const bid = await Bid.create({
      repairRequestId,
      technicianId: req.user._id,
      amount,
      estimatedTime,
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
      userId: repairRequest.customerId,
      type: 'new_bid',
      title: 'New Bid Received',
      message: `You received a new bid of PKR ${amount} for your repair request`,
      data: {
        repairRequestId,
        bidId: bid._id
      }
    });

    await bid.populate('technicianId', 'name email phone');

    return apiResponse(res, {
      statusCode: 201,
      message: 'Bid created successfully',
      data: bid
    });
  } catch (error) {
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
          select: 'rating experience specializations'
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
      .populate('repairRequestId', 'title description deviceInfo status location')
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

export const acceptBid = async (req, res) => {
  try {
    const { bidId } = req.params;
    
    const bid = await Bid.findById(bidId).populate('repairRequestId technicianId');
    
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
      message: `Your bid of PKR ${bid.amount} has been accepted`,
      data: {
        repairRequestId: bid.repairRequestId._id,
        bidId: bid._id
      }
    });

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
    
    const bid = await Bid.findById(bidId).populate('repairRequestId technicianId');
    
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
    await bid.save();

    // Create notification for technician
    await Notification.create({
      userId: bid.technicianId._id,
      type: 'bid_rejected',
      title: 'Bid Rejected',
      message: `Your bid of PKR ${bid.amount} has been rejected`,
      data: {
        repairRequestId: bid.repairRequestId._id,
        bidId: bid._id
      }
    });

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