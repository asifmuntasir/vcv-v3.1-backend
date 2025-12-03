import Meeting from '../models/Meeting.js';
import { v4 as uuidv4 } from 'uuid';

// @desc    Get all meetings for a host
// @route   GET /api/meetings
export const getMeetings = async (req, res) => {
  try {
    // In a real app, you'd filter by req.user.id. 
    // For now, we return all for the prototype flow.
    const meetings = await Meeting.find({}).sort({ createdAt: -1 });
    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new meeting
// @route   POST /api/meetings
export const createMeeting = async (req, res) => {
  const { title, date, time, duration, hostId } = req.body;

  try {
    const meeting = new Meeting({
      meetingId: `cls_${Math.floor(Math.random() * 10000)}`, // Simple readable ID
      title,
      date,
      time,
      duration,
      hostId: hostId || 'admin_1', // Fallback for prototype
      status: 'upcoming'
    });

    const createdMeeting = await meeting.save();
    res.status(201).json(createdMeeting);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a meeting
// @route   DELETE /api/meetings/:id
export const deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.id });

    if (meeting) {
      await meeting.deleteOne();
      res.json({ message: 'Meeting removed' });
    } else {
      res.status(404).json({ message: 'Meeting not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};