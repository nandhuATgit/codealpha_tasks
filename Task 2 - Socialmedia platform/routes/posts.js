const express = require("express");
const mongoose = require("mongoose");
const Post = require("../models/Post");
const auth = require("../middleware/auth");

const router = express.Router();

// POST /api/posts - Create post (authenticated)
router.post("/", auth, async (req, res) => {
  try {
    const { content, image } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Post content is required.",
      });
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Post content cannot exceed 1000 characters.",
      });
    }

    const newPost = new Post({
      user: req.user._id,
      content: trimmedContent,
      image: image ? image.trim() : "",
    });

    await newPost.save();

    // Populate user details before returning
    await newPost.populate("user", "name username profileImage");

    return res.status(201).json({
      success: true,
      message: "Post created successfully.",
      post: newPost,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error creating post.",
      error: error.message,
    });
  }
});

// GET /api/posts - Get all posts (newest first, author populated)
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("user", "name username profileImage");

    return res.status(200).json({
      success: true,
      count: posts.length,
      posts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error fetching posts.",
      error: error.message,
    });
  }
});

// GET /api/posts/feed - Get posts from users followed by current user (authenticated)
router.get("/feed", auth, async (req, res) => {
  try {
    const currentUser = req.user;
    const followingIds = currentUser.following || [];

    // Find posts whose user is in followingIds
    const posts = await Post.find({ user: { $in: followingIds } })
      .sort({ createdAt: -1 })
      .populate("user", "name username profileImage");

    return res.status(200).json({
      success: true,
      count: posts.length,
      posts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error fetching feed.",
      error: error.message,
    });
  }
});

// GET /api/posts/:id - Get single post by id
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format.",
      });
    }

    const post = await Post.findById(req.params.id).populate(
      "user",
      "name username profileImage"
    );

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    return res.status(200).json({
      success: true,
      post,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error fetching post.",
      error: error.message,
    });
  }
});

// DELETE /api/posts/:id - Delete post (authenticated, owner only)
router.delete("/:id", auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format.",
      });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    // Check ownership: req.user._id vs post.user
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden. You can only delete your own posts.",
      });
    }

    await Post.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Post deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error deleting post.",
      error: error.message,
    });
  }
});

// POST /api/posts/:id/like - Toggle like/unlike post (authenticated)
router.post("/:id/like", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format.",
      });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    if (!Array.isArray(post.likes)) {
      post.likes = [];
    }

    const userIdStr = req.user._id.toString();
    const existingIndex = post.likes.findIndex(
      (likeId) => likeId.toString() === userIdStr
    );

    let isLiked = false;

    if (existingIndex > -1) {
      // User already liked -> remove like (unlike)
      post.likes.splice(existingIndex, 1);
      isLiked = false;
    } else {
      // User hasn't liked -> add like
      post.likes.push(req.user._id);
      isLiked = true;
    }

    await post.save();

    return res.status(200).json({
      success: true,
      message: isLiked ? "Post liked successfully." : "Post unliked successfully.",
      isLiked,
      likeCount: post.likes.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error toggling like.",
      error: error.message,
    });
  }
});

module.exports = router;

