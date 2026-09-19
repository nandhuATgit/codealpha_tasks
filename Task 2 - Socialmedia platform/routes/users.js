const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

// Helper to count posts safely whether Post model exists yet or not
async function getPostsCount(userId) {
  try {
    if (mongoose.models.Post) {
      return await mongoose.models.Post.countDocuments({ user: userId });
    }
    const collections = await mongoose.connection.db.listCollections({ name: "posts" }).toArray();
    if (collections.length > 0) {
      return await mongoose.connection.db.collection("posts").countDocuments({
        $or: [{ user: userId }, { author: userId }],
      });
    }
  } catch (err) {
    // If posts collection doesn't exist yet, return 0
  }
  return 0;
}

// PUT /api/users/profile - Update logged in user's profile
// Note: Must be declared before /:username to avoid route collision
router.put("/profile", auth, async (req, res) => {
  try {
    const { name, bio, profileImage } = req.body;

    const updates = {};

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Name must be between 2 and 50 characters.",
        });
      }
      updates.name = trimmedName;
    }

    if (bio !== undefined) {
      const trimmedBio = bio.trim();
      if (trimmedBio.length > 160) {
        return res.status(400).json({
          success: false,
          message: "Bio cannot exceed 160 characters.",
        });
      }
      updates.bio = trimmedBio;
    }

    if (profileImage !== undefined) {
      updates.profileImage = profileImage.trim();
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { returnDocument: "after", runValidators: true }
    ).select("-password");

    const postsCount = await getPostsCount(updatedUser._id);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        username: updatedUser.username,
        email: updatedUser.email,
        bio: updatedUser.bio,
        profileImage: updatedUser.profileImage,
        followersCount: updatedUser.followers ? updatedUser.followers.length : 0,
        followingCount: updatedUser.following ? updatedUser.following.length : 0,
        postsCount,
        createdAt: updatedUser.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while updating profile.",
      error: error.message,
    });
  }
});

// GET /api/users/:username - Get user profile by username
router.get("/:username", async (req, res) => {
  try {
    const targetUsername = req.params.username.trim().toLowerCase();

    const user = await User.findOne({ username: targetUsername }).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const postsCount = await getPostsCount(user._id);

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        bio: user.bio,
        profileImage: user.profileImage,
        followersCount: user.followers ? user.followers.length : 0,
        followingCount: user.following ? user.following.length : 0,
        followers: user.followers || [],
        following: user.following || [],
        postsCount,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while fetching profile.",
      error: error.message,
    });
  }
});

// POST /api/users/:id/follow - Follow target user (authenticated)
router.post("/:id/follow", auth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid target user ID.",
      });
    }

    // A user cannot follow themselves
    if (targetUserId.toString() === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow yourself.",
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Check if already following
    const isAlreadyFollowing = targetUser.followers.some(
      (followerId) => followerId.toString() === currentUserId.toString()
    );

    if (isAlreadyFollowing) {
      return res.status(400).json({
        success: false,
        message: "You are already following this user.",
        isFollowing: true,
        followersCount: targetUser.followers.length,
        followingCount: targetUser.following.length,
      });
    }

    // Add current user to target user's followers
    const updatedTargetUser = await User.findByIdAndUpdate(
      targetUserId,
      { $addToSet: { followers: currentUserId } },
      { returnDocument: "after" }
    );

    // Add target user to current user's following
    const updatedCurrentUser = await User.findByIdAndUpdate(
      currentUserId,
      { $addToSet: { following: targetUserId } },
      { returnDocument: "after" }
    );

    return res.status(200).json({
      success: true,
      message: `You are now following ${targetUser.username}.`,
      isFollowing: true,
      followersCount: updatedTargetUser.followers.length,
      followingCount: updatedTargetUser.following.length,
      currentUserFollowingCount: updatedCurrentUser.following.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while following user.",
      error: error.message,
    });
  }
});

// POST /api/users/:id/unfollow - Unfollow target user (authenticated)
router.post("/:id/unfollow", auth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid target user ID.",
      });
    }

    if (targetUserId.toString() === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot unfollow yourself.",
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Remove current user from target user's followers
    const updatedTargetUser = await User.findByIdAndUpdate(
      targetUserId,
      { $pull: { followers: currentUserId } },
      { returnDocument: "after" }
    );

    // Remove target user from current user's following
    const updatedCurrentUser = await User.findByIdAndUpdate(
      currentUserId,
      { $pull: { following: targetUserId } },
      { returnDocument: "after" }
    );

    return res.status(200).json({
      success: true,
      message: `You have unfollowed ${targetUser.username}.`,
      isFollowing: false,
      followersCount: updatedTargetUser.followers.length,
      followingCount: updatedTargetUser.following.length,
      currentUserFollowingCount: updatedCurrentUser.following.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while unfollowing user.",
      error: error.message,
    });
  }
});

module.exports = router;

