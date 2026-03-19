const authService = require('../services/authService');

// Register new user
const register = async (req, res, next) => {
  console.log('Backend: Register endpoint hit');
  console.log('Backend: Request body:', req.body);
  
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      console.log('Backend: Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Please provide all required fields'
      });
    }

    const result = await authService.registerUser(email, password, firstName, lastName);
    
    console.log('Backend: Registration successful, sending response');
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.log('Backend: Registration error:', error.message);
    next(error);
  }
};

// Login user
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    const result = await authService.loginUser(email, password);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login
};
