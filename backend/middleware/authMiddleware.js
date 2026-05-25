// authMiddleware.js - Middleware to authenticate users using Supabase JWT tokens
const supabase = require('../config/supabaseClient');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Google users have user.id as UUID
    req.user = { id: user.id, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authMiddleware;