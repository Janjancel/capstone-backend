// // backfillPersonalInfo.js
// const mongoose = require("mongoose");
// const User = require("../models/User"); // adjust path if needed

// (async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });

//     console.log("Connected to MongoDB.");

//     const users = await User.find({});
//     console.log(`Found ${users.length} users. Starting backfill...`);

//     let updatedCount = 0;

//     for (const user of users) {
//       const info = user.personalInfo || {};

//       const updatedInfo = {
//         lastName: info.lastName || "",
//         firstName: info.firstName || "",
//         middleInitial: info.middleInitial || "",
//         phoneNumber: info.phoneNumber || "",
//       };

//       // Only update if something changed
//       const needsUpdate =
//         !info ||
//         info.lastName !== updatedInfo.lastName ||
//         info.firstName !== updatedInfo.firstName ||
//         info.middleInitial !== updatedInfo.middleInitial ||
//         info.phoneNumber !== updatedInfo.phoneNumber;

//       if (needsUpdate) {
//         user.personalInfo = updatedInfo;
//         await user.save();
//         updatedCount++;
//       }
//     }

//     console.log(`Backfill complete. Updated ${updatedCount} users.`);
//     process.exit(0);
//   } catch (err) {
//     console.error("Backfill error:", err);
//     process.exit(1);
//   }
// })();


// scripts/backfillPersonalInfo.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User"); // adjust path if needed

(async () => {
  try {
    console.log("Connecting to MongoDB...");
    
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected.");

    const users = await User.find({});
    console.log(`Found ${users.length} users. Starting backfill...`);

    let updated = 0;

    for (const user of users) {
      const p = user.personalInfo || {};

      // Normalize all fields based on your schema defaults
      const updatedInfo = {
        lastName: p.lastName ?? "",
        firstName: p.firstName ?? "",
        middleInitial: p.middleInitial ?? "",
        phoneNumber:
          p.phoneNumber === null ||
          p.phoneNumber === undefined ||
          p.phoneNumber === "" ||
          isNaN(p.phoneNumber)
            ? 0
            : Number(p.phoneNumber),
      };

      const needsUpdate =
        (p.lastName ?? "") !== updatedInfo.lastName ||
        (p.firstName ?? "") !== updatedInfo.firstName ||
        (p.middleInitial ?? "") !== updatedInfo.middleInitial ||
        Number(p.phoneNumber ?? 0) !== updatedInfo.phoneNumber;

      if (needsUpdate) {
        user.personalInfo = updatedInfo;
        await user.save();
        updated++;
      }
    }

    console.log(`Backfill complete. Updated ${updated} users.`);
    process.exit(0);
  } catch (err) {
    console.error("Backfill error:", err);
    process.exit(1);
  }
})();
