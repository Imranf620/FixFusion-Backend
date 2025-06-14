import RepairRequest from '../models/repairRequestSchema.js';
import { apiResponse } from '../utils/apiResponse.js';
import TechnicianProfile from '../models/technicianSchema.js';
import { uploadRepairImages } from '../utils/uploadRepairImages.js';
import User from '../models/userSchema.js';
import { sendPushNotification } from '../utils/sendPushNotification.js';


export const createRepairRequest = [
  uploadRepairImages.array('images', 5),
  async (req, res) => {
    try {
      let {
        title,
        description,
        deviceInfo,
        issueType,
        urgency,
        preferredBudget,
        location,
      } = req.body;

      if (typeof deviceInfo === 'string') deviceInfo = JSON.parse(deviceInfo);
      if (typeof preferredBudget === 'string') preferredBudget = JSON.parse(preferredBudget);
      if (typeof location === 'string') location = JSON.parse(location);

      const imageDocs = req.files?.map(file => ({
        url: `/uploads/repairImages/${file.filename}`,
        uploadedAt: new Date(),
      })) || [];

      const repairRequest = await RepairRequest.create({
        customerId: req.user._id,
        title,
        description,
        deviceInfo,
        issueType,
        images: imageDocs,
        urgency: urgency || 'medium',
        preferredBudget,
        location,
        status: 'open',
      });

      await repairRequest.populate('customerId', 'name email phone');

      // 🔔 Send Push Notifications to all Technicians
      const technicians = await TechnicianProfile.find({}, 'userId');
      const userIds = technicians.map(t => t.userId);
      const users = await User.find({ _id: { $in: userIds }, expoPushToken: { $exists: true, $ne: null } });

      for (const tech of users) {
        await sendPushNotification(
          tech.expoPushToken,
          '🛠️ New Repair Request Available',
          `${repairRequest.title} - ${repairRequest.description}`
        );
      }

      return apiResponse(res, {
        statusCode: 201,
        message: 'Repair request created and notifications sent successfully',
        data: repairRequest
      });
    } catch (error) {
      console.error('Create Repair Request Error:', error);
      return apiResponse(res, {
        statusCode: 500,
        message: 'Error creating repair request',
        error: error.message
      });
    }
  }
];

export const getRepairRequests = async (req, res) => {
  try {
    const { status, issueType, page = 1, limit = 10, radius = 10 } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (issueType) filter.issueType = issueType;
    
    // For technicians, show requests within their service radius
    if (req.user.role === 'technician') {
      const techProfile = await TechnicianProfile.findOne({ userId: req.user._id });
      if (techProfile && req.user.location?.coordinates) {
        filter.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: req.user.location.coordinates
            },
            $maxDistance: (techProfile.serviceRadius || radius) * 1000 // Convert km to meters
          }
        };
      }
    }
    
    // For customers, show only their requests
    if (req.user.role === 'customer') {
      filter.customerId = req.user._id;
    }

    const requests = await RepairRequest.find(filter)
      .populate('customerId', 'name email phone')
      .populate('assignedTechnician', 'name email phone')
      .populate('acceptedBid')
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

export const getRepairRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const repairRequest = await RepairRequest.findById(id)
      .populate('customerId', 'name email phone location')
      .populate('assignedTechnician', 'name email phone')
      .populate('acceptedBid');

    if (!repairRequest) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Repair request not found'
      });
    }

    // Check authorization
    if (req.user.role === 'customer' && repairRequest.customerId._id.toString() !== req.user._id.toString()) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Not authorized to view this repair request'
      });
    }

    return apiResponse(res, {
      statusCode: 200,
      message: 'Repair request retrieved successfully',
      data: repairRequest
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching repair request',
      error: error.message
    });
  }
};

export const updateRepairRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const repairRequest = await RepairRequest.findById(id);
    
    if (!repairRequest) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Repair request not found'
      });
    }

    // Only customer can update their own request
    if (repairRequest.customerId.toString() !== req.user._id.toString()) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Not authorized to update this repair request'
      });
    }

    // Prevent updating if already assigned
    if (repairRequest.status === 'assigned' || repairRequest.status === 'in_progress') {
      return apiResponse(res, {
        statusCode: 400,
        message: 'Cannot update repair request after it has been assigned'
      });
    }

    const updatedRequest = await RepairRequest.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('customerId', 'name email phone');

    return apiResponse(res, {
      statusCode: 200,
      message: 'Repair request updated successfully',
      data: updatedRequest
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error updating repair request',
      error: error.message
    });
  }
};

export const deleteRepairRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    const repairRequest = await RepairRequest.findById(id);
    
    if (!repairRequest) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Repair request not found'
      });
    }

    // Only customer can delete their own request
    if (repairRequest.customerId.toString() !== req.user._id.toString()) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Not authorized to delete this repair request'
      });
    }

    // Cannot delete if already assigned
    if (repairRequest.status === 'assigned' || repairRequest.status === 'in_progress') {
      return apiResponse(res, {
        statusCode: 400,
        message: 'Cannot delete repair request after it has been assigned'
      });
    }

    await RepairRequest.findByIdAndDelete(id);

    return apiResponse(res, {
      statusCode: 200,
      message: 'Repair request deleted successfully'
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error deleting repair request',
      error: error.message
    });
  }
};