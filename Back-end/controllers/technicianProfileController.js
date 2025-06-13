import TechnicianProfile from '../models/technicianSchema.js';

export const createTechnicianProfile = async (req, res) => {
  try {
    if (req.user.role !== 'technician') {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Only technicians can create technician profiles'
      });
    }

    // Check if profile already exists
    const existingProfile = await TechnicianProfile.findOne({ userId: req.user._id });
    if (existingProfile) {
      return apiResponse(res, {
        statusCode: 400,
        message: 'Technician profile already exists'
      });
    }

    const profile = await TechnicianProfile.create({
      userId: req.user._id,
      ...req.body
    });

    await profile.populate('userId', 'name email phone profileImage');

    return apiResponse(res, {
      statusCode: 201,
      message: 'Technician profile created successfully',
      data: profile
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error creating technician profile',
      error: error.message
    });
  }
};

export const getTechnicianProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const targetUserId = userId || req.user._id;

    const profile = await TechnicianProfile.findOne({ userId: targetUserId })
      .populate('userId', 'name email phone profileImage location');

    if (!profile) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Technician profile not found'
      });
    }

    return apiResponse(res, {
      statusCode: 200,
      message: 'Technician profile retrieved successfully',
      data: profile
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching technician profile',
      error: error.message
    });
  }
};

export const updateTechnicianProfile = async (req, res) => {
  try {
    const profile = await TechnicianProfile.findOne({ userId: req.user._id });
    
    if (!profile) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Technician profile not found'
      });
    }

    const updatedProfile = await TechnicianProfile.findByIdAndUpdate(
      profile._id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('userId', 'name email phone profileImage');

    return apiResponse(res, {
      statusCode: 200,
      message: 'Technician profile updated successfully',
      data: updatedProfile
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error updating technician profile',
      error: error.message
    });
  }
};

export const getAllTechnicians = async (req, res) => {
  try {
    const { 
      specialization, 
      minRating = 0, 
      maxPrice, 
      isApproved = true,
      page = 1, 
      limit = 10,
      latitude,
      longitude,
      maxDistance = 10000 // 10km in meters
    } = req.query;

    const filter = { isApproved };
    
    if (specialization) {
      filter.specializations = { $in: [specialization] };
    }
    
    if (minRating) {
      filter['rating.average'] = { $gte: parseFloat(minRating) };
    }
    
    if (maxPrice) {
      filter['priceRange.max'] = { $lte: parseFloat(maxPrice) };
    }

    let query = TechnicianProfile.find(filter);

    // Add location-based filtering if coordinates provided
    if (latitude && longitude) {
      query = query.find({
        'userId.location': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            $maxDistance: parseInt(maxDistance)
          }
        }
      });
    }

    const technicians = await query
      .populate('userId', 'name email phone profileImage location')
      .sort({ 'rating.average': -1, totalJobs: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await TechnicianProfile.countDocuments(filter);

    return apiResponse(res, {
      statusCode: 200,
      message: 'Technicians retrieved successfully',
      data: {
        technicians,
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
      message: 'Error fetching technicians',
      error: error.message
    });
  }
};