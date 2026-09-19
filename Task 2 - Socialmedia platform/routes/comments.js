const express = require("express");
const mongoose = require("mongoose");
const Comment = require("../models/Comment");
const Post = require("../models/Post");
const auth = require("../middleware/auth");

const router = express.Router();

// POST /api/comments - Create a comment (authenticated)
router.post("/", auth, async (req, res) => {
  try {
    const { postId, text } = req.body;

    if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Valid postId is required.",
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment text is required.",
      });
    }

    const trimmedText = text.trim();
    if (trimmedText.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot exceed 500 characters.",
      });
    }

    // Verify target post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    const newComment = new Comment({
      user: req.user._id,
      post: postId,
      text: trimmedText,
    });

    await newComment.save();

    // Optionally update post's comments array if present in schema
    if (Array.isArray(post.comments)) {
      post.comments.push(newComment._id);
      await post.save();
    }

    // Populate user's basic info
    await newComment.populate("user", "name username profileImage");

    return res.status(201).json({
      success: true,
      message: "Comment added successfully.",
      comment: newComment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error creating comment.",
      error: error.message,
    });
  }
});

// GET /api/comments/:postId - Get comments for a post (newest first, author populated)
router.get("/:postId", async (req, res) => {
  try {
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID.",
      });
    }

    const comments = await Comment.find({ post: postId })
      .sort({ createdAt: -1 })
      .populate("user", "name username profileImage");

    return res.status(200).json({
      success: true,
      count: comments.length,
      comments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error fetching comments.",
      error: error.message,
    });
  }
});

// DELETE /api/comments/:id - Delete a comment (authenticated, owner only)
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID.",
      });
    }

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found.",
      });
    }

    // Verify comment ownership
    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden. You can only delete your own comments.",
      });
    }

    // Remove from post's comments array if tracked
    await Post.findByIdAndUpdate(comment.post, {
      $pull: { comments: comment._id },
    });

    await Comment.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error deleting comment.",
      error: error.message,
    });
  }
});

module.exports = router;
