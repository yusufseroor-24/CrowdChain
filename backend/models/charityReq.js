import mongoose from "mongoose";

const charitySchema = new mongoose.Schema({
    id: String,
    orgName: String,
    wallet: String,
    description: String,
    image: { type: String, default: ""},
    documents: String,
    status: { type: String, enum:["Pending", "Approved", "Rejected"], default:"Pending"},
    createdAt: { type: Date, default: Date.now}
});
export default mongoose.model("CharityReq", charitySchema);
