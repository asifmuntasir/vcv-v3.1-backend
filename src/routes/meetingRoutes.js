import express from 'express';
import { getMeetings, createMeeting, deleteMeeting } from '../controllers/meetingController.js';

const router = express.Router();

router.route('/')
  .get(getMeetings)
  .post(createMeeting);

router.route('/:id')
  .delete(deleteMeeting);

export default router;