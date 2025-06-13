import jwt from "jsonwebtoken";
import User from "../models/userSchema.js";
import TechnicianProfile from "../models/technicianSchema.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { uploadProfileImage } from "../utils/upload.js";

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

export const signup = catchAsyncError(async (req, res, next) => {
  const { firstName, lastName, email, password, role, phone } = req.body;

  if (!firstName || !lastName || !email || !password || !role) {
    return apiResponse(res, {
      statusCode: 400,
      message: "All fields are required",
    });
  }

  if (!["customer", "technician"].includes(role)) {
    return apiResponse(res, {
      statusCode: 400,
      message: "Invalid role. Allowed roles are 'customer' or 'technician'",
    });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return apiResponse(res, {
      statusCode: 400,
      message: "Email already exists",
    });
  }

  // Create user with proper verification status
  const user = await User.create({
    name: `${firstName} ${lastName}`,
    email,
    password,
    phone,
    role,
    // Customers are automatically verified, technicians need admin approval
    isVerified: role === "customer" ? true : false,
    isActive: true
  });

  // If technician, create initial technician profile (unApproved)
  if (role === "technician") {
    await TechnicianProfile.create({
      userId: user._id,
      experience: 0,
      specializations: [],
      workingHours: {
        monday: { start: "09:00", end: "17:00", available: false },
        tuesday: { start: "09:00", end: "17:00", available: false },
        wednesday: { start: "09:00", end: "17:00", available: false },
        thursday: { start: "09:00", end: "17:00", available: false },
        friday: { start: "09:00", end: "17:00", available: false },
        saturday: { start: "09:00", end: "17:00", available: false },
        sunday: { start: "09:00", end: "17:00", available: false }
      },
      serviceRadius: 10,
      isApproved: false,
      biography: "",
      priceRange: { min: 0, max: 10000 }
    });
  }

  const token = generateToken(user._id);

  return apiResponse(res, {
    statusCode: 201,
    message: role === "technician" 
      ? "Signup successful! Your technician profile is pending admin approval." 
      : "Signup successful!",
    data: {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive,
        requiresApproval: role === "technician"
      },
    },
  });
});

export const login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return apiResponse(res, {
      statusCode: 400,
      message: "Email and password are required",
    });
  }

  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return apiResponse(res, {
      statusCode: 401,
      message: "Invalid email or password",
    });
  }

  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    return apiResponse(res, {
      statusCode: 401,
      message: "Invalid email or password",
    });
  }

  // Check if user account is active
  if (!user.isActive) {
    return apiResponse(res, {
      statusCode: 403,
      message: "Your account has been suspended. Please contact support.",
    });
  }

  // For customers, check isVerified
  if (user.role === "customer" && !user.isVerified) {
    return apiResponse(res, {
      statusCode: 403,
      message: "Your account is not verified yet. Please contact support.",
    });
  }

  // For technicians, check both isVerified and isApproved in TechnicianProfile
  if (user.role === "technician") {
    const technicianProfile = await TechnicianProfile.findOne({ userId: user._id });
    
    if (!technicianProfile) {
      return apiResponse(res, {
        statusCode: 403,
        message: "Technician profile not found. Please complete your profile setup.",
      });
    }

    if (!technicianProfile.isApproved) {
      return apiResponse(res, {
        statusCode: 403,
        message: "Your technician profile is pending admin approval. You will be notified once approved.",
      });
    }

    // Update user verification status if technician is approved but user isn't verified
    if (!user.isVerified) {
      await User.findByIdAndUpdate(user._id, { isVerified: true });
      user.isVerified = true;
    }
  }

  // Update last login
  await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

  const token = generateToken(user._id);

  // Get additional profile data for technicians
  let additionalData = {};
  if (user.role === "technician") {
    const technicianProfile = await TechnicianProfile.findOne({ userId: user._id });
    additionalData = {
      technicianProfile: {
        isApproved: technicianProfile.isApproved,
        approvedAt: technicianProfile.approvedAt,
        experience: technicianProfile.experience,
        specializations: technicianProfile.specializations,
        rating: technicianProfile.rating,
        completedJobs: technicianProfile.completedJobs
      }
    };
  }

  return apiResponse(res, {
    statusCode: 200,
    message: "Login successful",
    data: {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive,
        profileImage: user.profileImage,
        location: user.location,
        lastLogin: user.lastLogin,
        ...additionalData
      },
    },
  });
});

export const fetchMe = catchAsyncError(async (req, res, next) => {
  const user = req.user;
  
  // Get additional data for technicians
  let userData = { ...user.toObject() };
  
  if (user.role === "technician") {
    const technicianProfile = await TechnicianProfile.findOne({ userId: user._id });
    if (technicianProfile) {
      userData.technicianProfile = {
        id: technicianProfile._id,
        isApproved: technicianProfile.isApproved,
        approvedAt: technicianProfile.approvedAt,
        experience: technicianProfile.experience,
        specializations: technicianProfile.specializations,
        workingHours: technicianProfile.workingHours,
        serviceRadius: technicianProfile.serviceRadius,
        rating: technicianProfile.rating,
        totalJobs: technicianProfile.totalJobs,
        completedJobs: technicianProfile.completedJobs,
        biography: technicianProfile.biography,
        priceRange: technicianProfile.priceRange,
        monthlySubscription: technicianProfile.monthlySubscription
      };
    }
  }

  return apiResponse(res, {
    statusCode: 200,
    message: 'User profile fetched successfully',
    data: userData,
  });
});

export const updateProfile = [
  uploadProfileImage.single('profileImage'), 
  catchAsyncError(async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      const updateData = { ...req.body };
      
      // Handle profile image path if file uploaded
      if (req.file) {
        updateData.profileImage = `/uploads/profileImages/${req.file.filename}`;
      }

      // Handle location if provided as nested object
      if (req.body.location) {
        try {
          updateData.location = JSON.parse(req.body.location);
        } catch {
          return apiResponse(res, { 
            statusCode: 400, 
            message: 'Invalid location format' 
          });
        }
      }

      // Don't allow role change or password change here
      delete updateData.role;
      delete updateData.password;
      delete updateData.isVerified;
      delete updateData.isActive;

      // Update user profile
      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
        select: '-password',
      });

      // If technician, also update technician profile if provided
      if (userRole === "technician" && req.body.technicianProfile) {
        try {
          const technicianData = JSON.parse(req.body.technicianProfile);
          
          // Don't allow changing approval status
          delete technicianData.isApproved;
          delete technicianData.approvedBy;
          delete technicianData.approvedAt;
          
          await TechnicianProfile.findOneAndUpdate(
            { userId: userId },
            technicianData,
            { new: true, runValidators: true }
          );
        } catch (error) {
          console.log("Error updating technician profile:", error);
        }
      }

      // Fetch complete updated data
      let completeUserData = updatedUser.toObject();
      if (userRole === "technician") {
        const technicianProfile = await TechnicianProfile.findOne({ userId: userId });
        if (technicianProfile) {
          completeUserData.technicianProfile = technicianProfile;
        }
      }

      return apiResponse(res, {
        statusCode: 200,
        message: 'Profile updated successfully',
        data: completeUserData,
      });
    } catch (error) {
      console.log("Error updating profile:", error);
      return apiResponse(res, {
        statusCode: 500,
        message: 'Error updating profile',
        error: error.message
      });
    }
  }),
];

export const logout = catchAsyncError(async (req, res, next) => {
  // For JWT stateless auth, just respond success and client deletes token
  return apiResponse(res, {
    statusCode: 200,
    message: 'Logout successful',
  });
});

// New function to check user status (useful for frontend)
export const checkUserStatus = catchAsyncError(async (req, res, next) => {
  const user = req.user;
  
  let status = {
    canLogin: false,
    canAccessApp: false,
    message: "",
    requiresAction: false
  };

  if (!user.isActive) {
    status.message = "Account suspended";
    return apiResponse(res, { statusCode: 200, data: status });
  }

  if (user.role === "customer") {
    if (user.isVerified) {
      status.canLogin = true;
      status.canAccessApp = true;
      status.message = "Account active";
    } else {
      status.message = "Account verification pending";
    }
  } else if (user.role === "technician") {
    const technicianProfile = await TechnicianProfile.findOne({ userId: user._id });
    
    if (!technicianProfile) {
      status.message = "Profile setup required";
      status.requiresAction = true;
    } else if (!technicianProfile.isApproved) {
      status.message = "Awaiting admin approval";
    } else {
      status.canLogin = true;
      status.canAccessApp = true;
      status.message = "Account active";
    }
  }

  return apiResponse(res, {
    statusCode: 200,
    message: 'User status checked successfully',
    data: status
  });
});

// New function to resend verification/approval request
export const requestReapproval = catchAsyncError(async (req, res, next) => {
  const user = req.user;
  
  if (user.role !== "technician") {
    return apiResponse(res, {
      statusCode: 400,
      message: "Only technicians can request reapproval"
    });
  }

  const technicianProfile = await TechnicianProfile.findOne({ userId: user._id });
  
  if (!technicianProfile) {
    return apiResponse(res, {
      statusCode: 404,
      message: "Technician profile not found"
    });
  }

  if (technicianProfile.isApproved) {
    return apiResponse(res, {
      statusCode: 400,
      message: "Your profile is already approved"
    });
  }

  // Reset any previous rejection data and mark as pending
  await TechnicianProfile.findByIdAndUpdate(technicianProfile._id, {
    $unset: { 
      rejectedAt: 1, 
      rejectionReason: 1 
    }
  });

  return apiResponse(res, {
    statusCode: 200,
    message: "Reapproval request submitted successfully. You will be notified once reviewed."
  });
});

// Helper function to get user verification status
export const getVerificationStatus = catchAsyncError(async (req, res, next) => {
  const { userId } = req.params;
  
  const user = await User.findById(userId).select('-password');
  if (!user) {
    return apiResponse(res, {
      statusCode: 404,
      message: "User not found"
    });
  }

  let status = {
    isVerified: user.isVerified,
    isActive: user.isActive,
    role: user.role
  };

  if (user.role === "technician") {
    const technicianProfile = await TechnicianProfile.findOne({ userId: user._id });
    status.isApproved = technicianProfile ? technicianProfile.isApproved : false;
    status.approvedAt = technicianProfile ? technicianProfile.approvedAt : null;
    status.hasProfile = !!technicianProfile;
  }

  return apiResponse(res, {
    statusCode: 200,
    message: "Verification status retrieved successfully",
    data: status
  });
});