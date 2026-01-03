const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/inventree');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    businessName: { type: String },
    role: { type: String, default: 'user' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);