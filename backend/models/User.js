import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    id: String, 
    wallet: { type: String, unique: true},
    kycStatus: { type: String, default: "Not Started"},
    role:{
        type: String,
        enum: ["USER", "CHARITY", "ADMIN"],
        default: "USER"
    },
    charityApprovalStatus:{
        type: String,
        enum:["NotSubmitted", "Pending", "Approved", "Rejected"],
        default:"NotSubmitted"
    }
});

export default mongoose.model("User", userSchema);
