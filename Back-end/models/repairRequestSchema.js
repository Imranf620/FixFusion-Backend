import mongoose from "mongoose";

const repairRequestSchema = new mongoose.Schema({
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: [true, 'Repair title is required'],
      maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    deviceInfo: {
      brand: {
        type: String,
        required: true
      },
      model: {
        type: String,
        required: true
      },
      color: String,
      purchaseYear: Number
    },
    issueType: {
      type: String,
      required: true,
      enum: ['screen', 'battery', 'charging', 'camera', 
             'speaker', 'software', 'other']
    },
    images: [{
      url: String,
      description: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    preferredBudget: {
      min: Number,
      max: Number
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      },
      address: {
        type: String,
        required: true
      }
    },
    status: {
      type: String,
      enum: ['open', 'bidding', 'assigned', 'in_progress', 'completed', 'cancelled'],
      default: 'open'
    },
    acceptedBid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bid'
    },
    assignedTechnician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    completedAt: Date,
    expiresAt: {
      type: Date,
      default: function() {
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      }
    }
  }, {
    timestamps: true
  });
  
  repairRequestSchema.index({ location: '2dsphere' });
  repairRequestSchema.index({ customerId: 1 });
  repairRequestSchema.index({ status: 1 });
  repairRequestSchema.index({ issueType: 1 });
  repairRequestSchema.index({ createdAt: -1 });
  
  const RepairRequest = mongoose.model('RepairRequest', repairRequestSchema);
  

  export default RepairRequest