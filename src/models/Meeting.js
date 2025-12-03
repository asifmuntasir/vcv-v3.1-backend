import mongoose from 'mongoose';

const meetingSchema = mongoose.Schema({
  meetingId: { type: String, required: true, unique: true }, // e.g., "cls_8291"
  title: { type: String, required: true },
  hostId: { type: String, required: true }, // Links to the teacher
  date: { type: String, required: true },
  time: { type: String, required: true },
  duration: { type: String, default: '60' },
  status: { 
    type: String, 
    enum: ['upcoming', 'live', 'completed'], 
    default: 'upcoming' 
  },
  participants: { type: Number, default: 0 }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

const Meeting = mongoose.model('Meeting', meetingSchema);
export default Meeting;