const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '1d'
  });
};

// Register new user
const registerUser = async (email, password, firstName, lastName) => {
  try {
    console.log('AuthService: Starting user registration for:', email);
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('AuthService: User already exists');
      throw new Error('User already exists');
    }

    console.log('AuthService: Creating new user...');
    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName
    });
    
    console.log('AuthService: User created successfully, generating token...');
    // Generate token
    const token = generateToken(user._id);
    
    console.log('AuthService: Registration completed successfully');
    return {
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    };
  } catch (error) {
    console.log('AuthService: Registration error:', error.message);
    throw error;
  }
};

// Login user
const loginUser = async (email, password) => {
  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Check password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  // Generate token
  const token = generateToken(user._id);

  return {
    token,
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    }
  };
};

module.exports = {
  registerUser,
  loginUser
};
