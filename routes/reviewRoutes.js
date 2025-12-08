// // backend/routes/reviews.js
// const express = require("express");
// const router = express.Router();
// const Review = require("../models/Review");

// // Create a review
// router.post("/", async (req, res) => {
//   try {
//     // Minimal validation: rating required and must be between 1 and 5
//     const { rating } = req.body;
//     if (rating === undefined || rating === null) {
//       return res.status(400).json({ message: "Rating is required" });
//     }
//     const r = Number(rating);
//     if (!Number.isFinite(r) || r < 1 || r > 5) {
//       return res.status(400).json({ message: "Rating must be a number between 1 and 5" });
//     }

//     const review = new Review(req.body);
//     await review.save();
//     res.status(201).json(review);
//   } catch (err) {
//     console.error("Failed to create review:", err);
//     res.status(500).json({ message: "Failed to create review" });
//   }
// });

// // Get all reviews for a specific user (most recent first)
// router.get("/users/:userId/reviews", async (req, res) => {
//   try {
//     const reviews = await Review.find({ userId: req.params.userId }).sort({ createdAt: -1 });
//     res.json(reviews);
//   } catch (err) {
//     console.error("Failed to get user reviews:", err);
//     res.status(500).json({ message: "Failed to get reviews" });
//   }
// });

// // Update a review (partial update) for a specific user
// router.patch("/users/:userId/reviews/:reviewId", async (req, res) => {
//   try {
//     const updated = await Review.findOneAndUpdate(
//       { _id: req.params.reviewId, userId: req.params.userId },
//       { $set: req.body },
//       { new: true, runValidators: true }
//     );
//     res.json(updated);
//   } catch (err) {
//     console.error("Failed to update review:", err);
//     res.status(500).json({ message: "Failed to update review" });
//   }
// });

// // Delete all reviews for a user
// router.delete("/users/:userId/reviews", async (req, res) => {
//   try {
//     await Review.deleteMany({ userId: req.params.userId });
//     res.json({ message: "All reviews cleared for user" });
//   } catch (err) {
//     console.error("Failed to clear user reviews:", err);
//     res.status(500).json({ message: "Failed to clear reviews" });
//   }
// });

// // Get a single review by id
// router.get("/:id", async (req, res) => {
//   try {
//     const review = await Review.findById(req.params.id);
//     if (!review) return res.status(404).json({ message: "Review not found" });
//     res.json(review);
//   } catch (err) {
//     console.error("Failed to get review:", err);
//     res.status(500).json({ message: "Failed to get review" });
//   }
// });

// // ✅ Get all reviews (for admin dashboard)
// router.get("/", async (req, res) => {
//   try {
//     const reviews = await Review.find().sort({ createdAt: -1 });
//     res.json(reviews);
//   } catch (err) {
//     console.error("Error fetching reviews:", err);
//     res.status(500).json({ message: "Failed to fetch reviews" });
//   }
// });

// module.exports = router;


// // backend/routes/reviews.js
// const express = require("express");
// const router = express.Router();
// const Review = require("../models/Review");
// const Notification = require("../models/Notification"); // <-- used to save a notification when a review is created

// // Create a review
// router.post("/", async (req, res) => {
//   try {
//     // Minimal validation: rating required and must be between 1 and 5
//     const { rating, userId } = req.body;
//     if (rating === undefined || rating === null) {
//       return res.status(400).json({ message: "Rating is required" });
//     }
//     const r = Number(rating);
//     if (!Number.isFinite(r) || r < 1 || r > 5) {
//       return res.status(400).json({ message: "Rating must be a number between 1 and 5" });
//     }

//     // create review
//     const review = new Review(req.body);
//     await review.save();

//     // Create corresponding notification so admin (or system) can be aware of new reviews.
//     (async () => {
//       try {
//         const notifPayload = {
//           userId: review.userId ? String(review.userId) : undefined,
//           status: "New Review",
//           role: "admin",
//           for: "sell",
//           message: `New review submitted (${review.rating}/5)${review.feedback ? ` — "${String(review.feedback).slice(0, 200)}"` : ""}`,
//         };

//         if (notifPayload.userId) {
//           const n = new Notification(notifPayload);
//           await n.save();
//         }
//       } catch (notifErr) {
//         console.error("Failed to create notification for new review:", notifErr);
//       }
//     })();

//     res.status(201).json(review);
//   } catch (err) {
//     console.error("Failed to create review:", err);
//     res.status(500).json({ message: "Failed to create review" });
//   }
// });

// // Get all reviews for a specific user (most recent first)
// router.get("/users/:userId/reviews", async (req, res) => {
//   try {
//     const reviews = await Review.find({ userId: req.params.userId }).sort({ createdAt: -1 });
//     res.json(reviews);
//   } catch (err) {
//     console.error("Failed to get user reviews:", err);
//     res.status(500).json({ message: "Failed to get reviews" });
//   }
// });

// // Delete a single review for a specific user (only deletes when review.userId matches)
// router.delete("/users/:userId/reviews/:reviewId", async (req, res) => {
//   try {
//     const { userId, reviewId } = req.params;
//     const deleted = await Review.findOneAndDelete({ _id: reviewId, userId: userId });
//     if (!deleted) return res.status(404).json({ message: "Review not found for this user" });
//     res.json({ message: "Review deleted for user" });
//   } catch (err) {
//     console.error("Failed to delete user review:", err);
//     res.status(500).json({ message: "Failed to delete review" });
//   }
// });

// // ADMIN / generic: Delete a single review by id
// router.delete("/:id", async (req, res) => {
//   try {
//     const deleted = await Review.findByIdAndDelete(req.params.id);
//     if (!deleted) return res.status(404).json({ message: "Review not found" });
//     res.json({ message: "Review deleted" });
//   } catch (err) {
//     console.error("Failed to delete review by id:", err);
//     res.status(500).json({ message: "Failed to delete review" });
//   }
// });

// // Update a review (partial update) for a specific user
// router.patch("/users/:userId/reviews/:reviewId", async (req, res) => {
//   try {
//     const updated = await Review.findOneAndUpdate(
//       { _id: req.params.reviewId, userId: req.params.userId },
//       { $set: req.body },
//       { new: true, runValidators: true }
//     );
//     res.json(updated);
//   } catch (err) {
//     console.error("Failed to update review:", err);
//     res.status(500).json({ message: "Failed to update review" });
//   }
// });

// // Delete all reviews for a user
// router.delete("/users/:userId/reviews", async (req, res) => {
//   try {
//     await Review.deleteMany({ userId: req.params.userId });
//     res.json({ message: "All reviews cleared for user" });
//   } catch (err) {
//     console.error("Failed to clear user reviews:", err);
//     res.status(500).json({ message: "Failed to clear reviews" });
//   }
// });

// // Get a single review by id
// router.get("/:id", async (req, res) => {
//   try {
//     const review = await Review.findById(req.params.id);
//     if (!review) return res.status(404).json({ message: "Review not found" });
//     res.json(review);
//   } catch (err) {
//     console.error("Failed to get review:", err);
//     res.status(500).json({ message: "Failed to get review" });
//   }
// });

// // ✅ Get all reviews (for admin dashboard)
// router.get("/", async (req, res) => {
//   try {
//     const reviews = await Review.find().sort({ createdAt: -1 });
//     res.json(reviews);
//   } catch (err) {
//     console.error("Error fetching reviews:", err);
//     res.status(500).json({ message: "Failed to fetch reviews" });
//   }
// });

// module.exports = router;


// backend/routes/reviews.js
const express = require("express");
const router = express.Router();
const Review = require("../models/Review");
const Notification = require("../models/Notification"); // used to save a notification when a review is created

/**
 * Helper: delete a review by id.
 * - If isAdmin === true: allow deletion by id (admin privileges).
 * - If requesterId provided and not admin: delete only if review.userId matches requesterId.
 * Returns the deleted document or null.
 */
async function deleteReview({ reviewId, requesterId, isAdmin = false }) {
  if (isAdmin) {
    return await Review.findByIdAndDelete(reviewId);
  }
  if (requesterId) {
    return await Review.findOneAndDelete({ _id: reviewId, userId: requesterId });
  }
  // no requester info and not admin: do not delete
  return null;
}

// Create a review
router.post("/", async (req, res) => {
  try {
    // Minimal validation: rating required and must be between 1 and 5
    const { rating, userId } = req.body;
    if (rating === undefined || rating === null) {
      return res.status(400).json({ message: "Rating is required" });
    }
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return res.status(400).json({ message: "Rating must be a number between 1 and 5" });
    }

    // create review
    const review = new Review(req.body);
    await review.save();

    // Create corresponding notification so admin (or system) can be aware of new reviews.
    (async () => {
      try {
        const notifPayload = {
          userId: review.userId ? String(review.userId) : undefined,
          status: "New Review",
          role: "admin",
          for: "sell",
          message: `New review submitted (${review.rating}/5)${review.feedback ? ` — "${String(review.feedback).slice(0, 200)}"` : ""}`,
        };

        if (notifPayload.userId) {
          const n = new Notification(notifPayload);
          await n.save();
        }
      } catch (notifErr) {
        console.error("Failed to create notification for new review:", notifErr);
      }
    })();

    res.status(201).json(review);
  } catch (err) {
    console.error("Failed to create review:", err);
    res.status(500).json({ message: "Failed to create review" });
  }
});

// Get all reviews (for admin dashboard) — keep this near top to avoid route conflicts
router.get("/", async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    console.error("Error fetching reviews:", err);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

// Get all reviews for a specific user (most recent first)
router.get("/users/:userId/reviews", async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    console.error("Failed to get user reviews:", err);
    res.status(500).json({ message: "Failed to get reviews" });
  }
});

// Delete a single review for a specific user (only deletes when review.userId matches)
// (keeps old route for backward compatibility)
router.delete("/users/:userId/reviews/:reviewId", async (req, res) => {
  try {
    const { userId, reviewId } = req.params;
    const deleted = await deleteReview({ reviewId, requesterId: userId, isAdmin: false });
    if (!deleted) return res.status(404).json({ message: "Review not found for this user or not authorized" });
    return res.json({ message: "Review deleted for user", review: deleted });
  } catch (err) {
    console.error("Failed to delete user review:", err);
    res.status(500).json({ message: "Failed to delete review" });
  }
});

/**
 * ADMIN / generic: Delete a single review by id
 *
 * Behavior:
 * - If request has query param ?userId=... (or body.userId or header x-user-id), it will attempt to delete that user's review (owner delete).
 * - If request has header x-admin: "true" (string) it will perform admin delete by id regardless of userId.
 *
 * Note: This allows frontend to call DELETE /api/reviews/:id?userId=<id> for owner deletion,
 * or include header x-admin: "true" (or use your existing auth mechanism) for admin deletion.
 */
router.delete("/:id", async (req, res) => {
  try {
    const reviewId = req.params.id;

    // Detect requester info: prefer query -> body -> header
    const requesterId = req.query.userId || (req.body && req.body.userId) || req.get("x-user-id");
    const isAdminHeader = String(req.get("x-admin") || "").toLowerCase() === "true";

    // IMPORTANT: Replace this simple header-based admin detection with your real auth check:
    // e.g. decode JWT and check req.user.role === 'admin'
    const isAdmin = isAdminHeader; // placeholder, change to real auth later

    const deleted = await deleteReview({ reviewId, requesterId, isAdmin });

    if (!deleted) {
      // Provide helpful message whether it's not found or not authorized
      // Check if review exists at all
      const exists = await Review.findById(reviewId);
      if (!exists) {
        return res.status(404).json({ message: "Review not found" });
      } else {
        return res.status(403).json({ message: "Not authorized to delete this review" });
      }
    }

    // Optionally create a notification about deletion (admin or user-initiated)
    (async () => {
      try {
        const notifPayload = {
          userId: deleted.userId ? String(deleted.userId) : undefined,
          status: "Review Deleted",
          role: "admin",
          for: "sell",
          message: `A review (${deleted.rating}/5) was deleted${isAdmin ? " by admin" : ""}${requesterId ? ` by user ${requesterId}` : ""}.`,
        };
        const n = new Notification(notifPayload);
        await n.save();
      } catch (nErr) {
        console.error("Failed to save deletion notification:", nErr);
      }
    })();

    res.json({ message: "Review deleted", review: deleted });
  } catch (err) {
    console.error("Failed to delete review by id:", err);
    res.status(500).json({ message: "Failed to delete review" });
  }
});

// Update a review (partial update) for a specific user
router.patch("/users/:userId/reviews/:reviewId", async (req, res) => {
  try {
    const updated = await Review.findOneAndUpdate(
      { _id: req.params.reviewId, userId: req.params.userId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: "Review not found for this user or not authorized" });
    res.json(updated);
  } catch (err) {
    console.error("Failed to update review:", err);
    res.status(500).json({ message: "Failed to update review" });
  }
});

// Delete all reviews for a user
router.delete("/users/:userId/reviews", async (req, res) => {
  try {
    await Review.deleteMany({ userId: req.params.userId });
    res.json({ message: "All reviews cleared for user" });
  } catch (err) {
    console.error("Failed to clear user reviews:", err);
    res.status(500).json({ message: "Failed to clear reviews" });
  }
});

// Get a single review by id
router.get("/:id", async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    res.json(review);
  } catch (err) {
    console.error("Failed to get review:", err);
    res.status(500).json({ message: "Failed to get review" });
  }
});

module.exports = router;
