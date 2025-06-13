import mongoose from "mongoose";

const technicianProfileSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    experience: {
      type: Number,
      required: [true, 'Experience years is required'],
      min: [0, 'Experience cannot be negative']
    },
    specializations: [{
      type: String,
      enum: ['screen_repair', 'battery_replacement', 'water_damage', 'software_issues', 
             'charging_port', 'speaker_repair', 'camera_repair', 'motherboard_repair', 'other']
    }],
    certifications: [{
      name: String,
      issuer: String,
      dateIssued: Date,
      certificateUrl: String
    }],
    workingHours: {
      monday: { start: String, end: String, available: Boolean },
      tuesday: { start: String, end: String, available: Boolean },
      wednesday: { start: String, end: String, available: Boolean },
      thursday: { start: String, end: String, available: Boolean },
      friday: { start: String, end: String, available: Boolean },
      saturday: { start: String, end: String, available: Boolean },
      sunday: { start: String, end: String, available: Boolean }
    },
    serviceRadius: {
      type: Number,
      default: 10, // kilometers
      min: [1, 'Service radius must be at least 1km'],
      max: [50, 'Service radius cannot exceed 50km']
    },
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      },
      count: {
        type: Number,
        default: 0
      }
    },
    totalJobs: {
      type: Number,
      default: 0
    },
    completedJobs: {
      type: Number,
      default: 0
    },
    biography: {
      type: String,
      maxlength: [500, 'Biography cannot exceed 500 characters']
    },
    priceRange: {
      min: {
        type: Number,
        default: 0
      },
      max: {
        type: Number,
        default: 10000
      }
    },
    isApproved: {
      type: Boolean,
      default: false
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    monthlySubscription: {
      isActive: {
        type: Boolean,
        default: false
      },
      startDate: Date,
      endDate: Date,
      amount: Number
    }
  }, {
    timestamps: true
  });

  const TechnicianProfile = mongoose.model('TechnicianProfile', technicianProfileSchema);
  export default TechnicianProfile