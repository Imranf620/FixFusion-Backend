import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    repairRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RepairRequest',
      required: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5']
    },
    comment: {
      type: String,
      maxlength: [500, 'Comment cannot exceed 500 characters']
    },
    aspects: {
      quality: {
        type: Number,
        min: 1,
        max: 5
      },
      timeliness: {
        type: Number,
        min: 1,
        max: 5
      },
      communication: {
        type: Number,
        min: 1,
        max: 5
      },
      value: {
        type: Number,
        min: 1,
        max: 5
      }
    },
    isRecommended: {
      type: Boolean,
      default: true
    },
    response: {
      content: String,
      respondedAt: Date
    }
  }, {
    timestamps: true
  });
  

  const Review = mongoose.model('Review', reviewSchema);
  
  export default Review