// backfillPersonalInfo.js
const mongoose = require("mongoose");
const User = require("../models/User"); // adjust path if needed

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB.");

    const users = await User.find({});
    console.log(`Found ${users.length} users. Starting backfill...`);

    let updatedCount = 0;

    for (const user of users) {
      const info = user.personalInfo || {};

      const updatedInfo = {
        lastName: info.lastName || "",
        firstName: info.firstName || "",
        middleInitial: info.middleInitial || "",
        phoneNumber: info.phoneNumber || "",
      };

      // Only update if something changed
      const needsUpdate =
        !info ||
        info.lastName !== updatedInfo.lastName ||
        info.firstName !== updatedInfo.firstName ||
        info.middleInitial !== updatedInfo.middleInitial ||
        info.phoneNumber !== updatedInfo.phoneNumber;

      if (needsUpdate) {
        user.personalInfo = updatedInfo;
        await user.save();
        updatedCount++;
      }
    }

    console.log(`Backfill complete. Updated ${updatedCount} users.`);
    process.exit(0);
  } catch (err) {
    console.error("Backfill error:", err);
    process.exit(1);
  }
})();
