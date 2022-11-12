const mongoose = require('mongoose');

// A schema for a reply
const replySchema = new mongoose.Schema({
    content: {
        type: String,
        required: true
    },
    author: {
        type: String,
        required: true
    },
    datePosted: {
        type: Date,
        immutable: true,
        default: Date.now()
    }
});
// A schema for a post
const postSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    author: {
        type: String,
        required: true
    },
    datePosted: {
        type: Date,
        immutable: true,
        default: Date.now()
    },
    votes: {
        type: Number
    },
    replies: [replySchema]
});

// A schema for a user
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    requests: {
        out: [String],
        in: [String]
    },
    friends: [String],
    posts: [postSchema],
});

module.exports = mongoose.model("User", userSchema);
