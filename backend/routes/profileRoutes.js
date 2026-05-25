// profileRoutes.js - Defines routes for user profile management, including fetching and updating profiles and skills
const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, profileController.getProfile);
router.put('/', authMiddleware, profileController.updateProfile);
router.put('/skills', authMiddleware, profileController.updateSkills); // <-- ADD

module.exports = router;