import mongoose from "mongoose";

const bidSchema = new mongoose.Schema({
    repairRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RepairRequest',
      required: true
    },
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: [true, 'Bid amount is required'],
      min: [1, 'Bid amount must be greater than 0']
    },
    estimatedTime: {
      value: {
        type: Number,
        required: true
      },
      unit: {
        type: String,
        enum: ['hours', 'days'],
        default: 'hours'
      }
    },
    description: {
      type: String,
      required: [true, 'Bid description is required'],
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    partsIncluded: [{
      name: String,
      cost: Number,
      warranty: String
    }],
    warranty: {
      duration: Number, // in months
      terms: String
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending'
    },
    validUntil: {
      type: Date,
      default: function() {
        return new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now
      }
    },
    message: String, // Optional message from technician
    acceptedAt: Date,
    rejectedAt: Date
  }, {
    timestamps: true
  });
  
  
  // Ensure one bid per technician per repair request
  bidSchema.index({ repairRequestId: 1, technicianId: 1 }, { unique: true });
  
  const Bid = mongoose.model('Bid', bidSchema);

  export default Bid
  