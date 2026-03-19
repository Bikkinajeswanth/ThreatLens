const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String, required: true, unique: true, lowercase: true, trim: true
  },
  password: { type: String, required: true },
  firstName: { type: String, required: true, trim: true },
  lastName:  { type: String, required: true, trim: true },
  role: {
    type: String,
    enum: ['user', 'admin', 'analyst', 'viewer'],
    default: 'user'
  },
  // Alert preferences
  notifications: {
    email:        { type: Boolean, default: true },
    slack:        { type: Boolean, default: false },
    slackWebhook: { type: String, default: null }
  },
  theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const bcrypt = require('bcrypt');

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await require('bcrypt').compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
