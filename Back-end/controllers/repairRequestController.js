import RepairRequest from "../models/repairRequestSchema.js";
import { apiResponse } from "../utils/apiResponse.js";
import TechnicianProfile from "../models/technicianSchema.js";
import { uploadRepairImages } from "../utils/uploadRepairImages.js";
import User from "../models/userSchema.js";
import { sendPushNotification } from "../utils/sendPushNotification.js";
import Transaction from "../models/transactionSchema.js";

export const createRepairRequest = [
  uploadRepairImages.array("images", 5),
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

      if (typeof deviceInfo === "string") deviceInfo = JSON.parse(deviceInfo);
      if (typeof preferredBudget === "string")
        preferredBudget = JSON.parse(preferredBudget);
      if (typeof location === "string") location = JSON.parse(location);

      const imageDocs =
        req.files?.map((file) => ({
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
        urgency: urgency || "medium",
        preferredBudget,
        location,
        status: "open",
      });

      await repairRequest.populate("customerId", "name email phone");

      // 🔔 Send Push Notifications to all Technicians
      const technicians = await TechnicianProfile.find({}, "userId");
      const userIds = technicians.map((t) => t.userId);
      const users = await User.find({
        _id: { $in: userIds },
        expoPushToken: { $exists: true, $ne: null },
      });

      for (const tech of users) {
        await sendPushNotification(
          tech.expoPushToken,
          "🛠️ New Repair Request Available",
          `${repairRequest.title} - ${repairRequest.description}`
        );
      }

      return apiResponse(res, {
        statusCode: 201,
        message: "Repair request created and notifications sent successfully",
        data: repairRequest,
      });
    } catch (error) {
      console.error("Create Repair Request Error:", error);
      return apiResponse(res, {
        statusCode: 500,
        message: "Error creating repair request",
        error: error.message,
      });
    }
  },
];

export const getRepairRequests = async (req, res) => {
  try {
    const { status, issueType, page = 1, limit = 10, radius = 10 } = req.query;

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const parsedRadius = parseFloat(radius);
    const skip = (parsedPage - 1) * parsedLimit;

    console.log("[QUERY PARAMS]", {
      status,
      issueType,
      parsedPage,
      parsedLimit,
      parsedRadius,
    });

    const allRequests = await RepairRequest.find();
    console.log(
      "[ALL REPAIR REQUESTS]",
      allRequests.map((r) => ({
        id: r._id,
        title: r.title,
        coordinates: r.location?.coordinates,
      }))
    );

    if (req.user.role === "technician") {
      console.log("[TECHNICIAN] Fetching repair requests");

      const techProfile = await TechnicianProfile.findOne({
        userId: req.user._id,
      });

      console.log("[TECH PROFILE]", techProfile);

      let technicianCoordinates = req.user.location?.coordinates;
      const hasValidCoordinates =
        technicianCoordinates &&
        technicianCoordinates.length === 2 &&
        technicianCoordinates[0] !== 0 &&
        technicianCoordinates[1] !== 0;

      if (!hasValidCoordinates) {
        console.warn(
          "[WARNING] Invalid technician coordinates, skipping geo filtering"
        );
      }

      if (techProfile && hasValidCoordinates) {
        const serviceRadiusInMeters =
          (techProfile.serviceRadius || parsedRadius) * 1000;

        console.log("[TECH LOCATION]", technicianCoordinates);
        console.log("[SERVICE RADIUS METERS]", serviceRadiusInMeters);

        const aggregationPipeline = [
          {
            $geoNear: {
              near: {
                type: "Point",
                coordinates: technicianCoordinates,
              },
              distanceField: "distance",
              maxDistance: serviceRadiusInMeters,
              spherical: true,
            },
          },
        ];

        const matchStage = {};
        if (status) matchStage.status = status;
        if (issueType) matchStage.issueType = issueType;
        aggregationPipeline.push({ $match: matchStage });

        aggregationPipeline.push(
          {
            $lookup: {
              from: "users",
              localField: "customerId",
              foreignField: "_id",
              as: "customerId",
              pipeline: [{ $project: { name: 1, email: 1, phone: 1, _id: 0 } }],
            },
          },
          {
            $unwind: { path: "$customerId", preserveNullAndEmptyArrays: true },
          },
          {
            $lookup: {
              from: "users",
              localField: "assignedTechnician",
              foreignField: "_id",
              as: "assignedTechnician",
              pipeline: [{ $project: { name: 1, email: 1, phone: 1, _id: 0 } }],
            },
          },
          {
            $unwind: {
              path: "$assignedTechnician",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "bids",
              localField: "acceptedBid",
              foreignField: "_id",
              as: "acceptedBid",
            },
          },
          {
            $unwind: { path: "$acceptedBid", preserveNullAndEmptyArrays: true },
          },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: parsedLimit }
        );

        console.log(
          "[AGGREGATION PIPELINE]",
          JSON.stringify(aggregationPipeline, null, 2)
        );

        const requests = await RepairRequest.aggregate(aggregationPipeline);
        const countResult = await RepairRequest.aggregate([
          ...aggregationPipeline.slice(0, -2), // remove skip & limit
          { $count: "total" },
        ]);
        const total = countResult[0]?.total || 0;

        return apiResponse(res, {
          statusCode: 200,
          message: "Nearby repair requests retrieved",
          data: {
            requests,
            pagination: {
              page: parsedPage,
              limit: parsedLimit,
              total,
              pages: Math.ceil(total / parsedLimit),
            },
          },
        });
      }

      // ❌ No valid coordinates or profile — get all matching jobs (no geo filter)
      console.log(
        "[FALLBACK] No valid technician location or profile, fetching all matching jobs"
      );

      const fallbackFilter = {};
      if (status) fallbackFilter.status = status;
      if (issueType) fallbackFilter.issueType = issueType;

      const requests = await RepairRequest.find(fallbackFilter)
        .populate("customerId", "name email phone")
        .populate("assignedTechnician", "name email phone")
        .populate("acceptedBid")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit);

      const total = await RepairRequest.countDocuments(fallbackFilter);

      return apiResponse(res, {
        statusCode: 200,
        message: "Repair requests retrieved successfully (no location filter)",
        data: {
          requests,
          pagination: {
            page: parsedPage,
            limit: parsedLimit,
            total,
            pages: Math.ceil(total / parsedLimit),
          },
        },
      });
    }

    // 🔒 If customer — show only their jobs
    if (req.user.role === "customer") {
      const filter = { customerId: req.user._id };
      if (status) filter.status = status;
      if (issueType) filter.issueType = issueType;

      const requests = await RepairRequest.find(filter)
        .populate("customerId", "name email phone")
        .populate("assignedTechnician", "name email phone")
        .populate("acceptedBid")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit);

      const total = await RepairRequest.countDocuments(filter);

      return apiResponse(res, {
        statusCode: 200,
        message: "Repair requests retrieved successfully (customer)",
        data: {
          requests,
          pagination: {
            page: parsedPage,
            limit: parsedLimit,
            total,
            pages: Math.ceil(total / parsedLimit),
          },
        },
      });
    }

    return apiResponse(res, {
      statusCode: 403,
      message: "Unauthorized to access repair requests",
    });
  } catch (error) {
    console.error("[ERROR FETCHING REQUESTS]", error);
    return apiResponse(res, {
      statusCode: 500,
      message: "Error fetching repair requests",
      error: error.message,
    });
  }
};

export const getRepairRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const repairRequest = await RepairRequest.findById(id)
      .populate("customerId", "name email phone location")
      .populate("assignedTechnician", "name email phone")
      .populate("acceptedBid");

    if (!repairRequest) {
      return apiResponse(res, {
        statusCode: 404,
        message: "Repair request not found",
      });
    }

    // Check authorization
    if (
      req.user.role === "customer" &&
      repairRequest.customerId._id.toString() !== req.user._id.toString()
    ) {
      return apiResponse(res, {
        statusCode: 403,
        message: "Not authorized to view this repair request",
      });
    }

    return apiResponse(res, {
      statusCode: 200,
      message: "Repair request retrieved successfully",
      data: repairRequest,
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: "Error fetching repair request",
      error: error.message,
    });
  }
};

export const updateRepairRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const repairRequest = await RepairRequest.findById(id)
      .populate("customerId", "name email phone")
      .populate("assignedTechnician", "name email phone");

    if (!repairRequest) {
      return apiResponse(res, {
        statusCode: 404,
        message: "Repair request not found",
      });
    }

    // Only customer can update their own request
    if (
      repairRequest.customerId._id.toString() !== req.user._id.toString() &&
      repairRequest.assignedTechnician.id.toString() !== req.user._id.toString()
    ) {
      return apiResponse(res, {
        statusCode: 403,
        message: "Not authorized to update this repair request",
      });
    }

    // // Prevent updates if already assigned or in progress
    // if (
    //   repairRequest.status === "assigned" ||
    //   repairRequest.status === "in_progress"
    // ) {
    //   return apiResponse(res, {
    //     statusCode: 400,
    //     message: "Cannot update repair request after it has been assigned",
    //   });
    // }

    // Check if status is changing to 'completed'
    const isCompleting =
      updates.status === "completed" && repairRequest.status !== "completed";

    // Update the repair request
    const updatedRequest = await RepairRequest.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
      .populate("customerId", "name email phone")
      .populate("assignedTechnician", "name email phone");

    // If status is set to completed, create a transaction automatically
    if (isCompleting) {
      const existingTransaction = await Transaction.findOne({
        repairRequestId: id,
      });

      if (!existingTransaction) {
        await Transaction.create({
          repairRequestId: id,
          customerId: repairRequest.customerId._id,
          technicianId: repairRequest.assignedTechnician._id,
          amount: updates.amount || 0, // You must pass `amount` in the update request
          paymentMethod: "cash", // Default or extracted from `updates.paymentMethod`
          status: "completed",
          completedAt: new Date(),
        });

        // Optionally update status to "paid"
        await RepairRequest.findByIdAndUpdate(id, {
          status: "paid",
        });
      }
    }

    return apiResponse(res, {
      statusCode: 200,
      message: "Repair request updated successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Update Repair Request Error:", error);
    return apiResponse(res, {
      statusCode: 500,
      message: "Error updating repair request",
      error: error.message,
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
        message: "Repair request not found",
      });
    }

    // Only customer can delete their own request
    if (repairRequest.customerId.toString() !== req.user._id.toString()) {
      return apiResponse(res, {
        statusCode: 403,
        message: "Not authorized to delete this repair request",
      });
    }

    // Cannot delete if already assigned
    if (
      repairRequest.status === "assigned" ||
      repairRequest.status === "in_progress"
    ) {
      return apiResponse(res, {
        statusCode: 400,
        message: "Cannot delete repair request after it has been assigned",
      });
    }

    await RepairRequest.findByIdAndDelete(id);

    return apiResponse(res, {
      statusCode: 200,
      message: "Repair request deleted successfully",
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: "Error deleting repair request",
      error: error.message,
    });
  }
};
