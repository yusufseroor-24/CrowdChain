import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';
import fetch from 'node-fetch';
import mongoose from 'mongoose';
import User from "./models/User.js";
import CharityReq from "./models/charityReq.js";
import { ethers } from "ethers";
import crypto from "crypto";
import bodyParser from 'body-parser';
import fs from "fs";

const contractABI = JSON.parse(
  fs.readFileSync(path.resolve("./Crowdfunding.json"), "utf8")
);

dotenv.config({ path: path.resolve('./.env') }); 
const connection = process.env.MONGO_URI;
console.log("MONGO_URI:", process.env.MONGO_URI);

const app = express();
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", /\.ngrok-free\.dev$/],
    credentials: true
}));

const provider = new ethers.providers.JsonRpcProvider(process.env.GANACHE_URL);
const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI.abi, wallet);

const start = async() => {
    try{
        await mongoose.connect(connection)
        app.listen(3000, () => {
        console.log('Server running on http://localhost:3000')
            });
    } catch(err){
        console.log(err.message)
    }
};
start();

//-----------------------------------Create User---------------------------------------------
app.post('/register-user', async (req, res) =>{
    const { walletAdd } = req.body;
    if(!walletAdd){ return res.status(400).json({ error: 'Missing Wallet Address' }); }

    try {
    let user = await User.findOne({ wallet: walletAdd});
    if(user){
        console.log("User Exists:", user.id);
        return res.json({ message: "User Found", user:{
            id: user.id,
            wallet: user.wallet,
            kycStatus: user.kycStatus,
            role: user.role
        }});
    }
    const newUser = new User({
        id: nanoid(), 
        wallet: walletAdd,
        kycStatus: "Not Started",
        role: "USER"
    });

    await newUser.save();
    console.log("User Created", newUser.id);

    res.json({
        message: "User Created", user: newUser });
    } catch (err){
        console.error ("User Registeration save error", err);
        return res.status(500).json({ error: 'Failed registration due to server error'});
    }
});

//-------------------------Didit KYC session---------------------------------
app.post('/create-session', async(req, res) => {
    try{
        const { userId } = req.body;
        console.log("Received userId:", userId);

        const user = await User.findOne({ id: userId });

        if (!user) {
            return res.status(400).json({ error: 'User Not Found'});
        }
        console.log("User from DB:", user);

        const response = await fetch("https://verification.didit.me/v2/session/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": process.env.DIDIT_API_KEY,
                "User-Agent": "Mozilla/5.0 (Node.js Test Client)"
            },
            body: JSON.stringify({
            workflow_id: '57d8b98e-94c7-4311-bcdb-2fe011daa3dd',
            vendor_data: user.id,
            callback: 'https://unsputtering-shayne-disquisitional.ngrok-free.dev/kyc-callback',
            language: 'en',
            metadata: { 
                wallet: user.wallet, 
                platform: "CrowdChain"
            }
        })
    });
        if(!response.ok){
            throw new Error(`Didit API Error: ${response.status}`)
        }

        const data = await response.json();
        console.log("DIDIT API RESPONSE:", data);

        if(!data.url){
            return res.status(500).json({ error: "Didit API didn't return URL", data});
        }
        res.json({ url: data.url });
    } catch(err){
        console.error("KYC SESSION ERROR:", err);
        res.status(500).json({ error: 'KYC session failed'});
    }
});

//------------------------------------Callback and webhook--------------------------------------
app.all('/kyc-callback', async (req, res) => {
    try{
        let vendor_data, status;

        if(req.method === "POST"){
            console.log("Webhook Recieved:", req.body);
            vendor_data = req.body.vendor_data;
            status = req.body.status;
        } else if(req.method === "GET"){
            //redirect
            console.log("Browser Redirect Received:", req.query);
            status = req.query.status
            vendor_data = null;

            //fetch vendor_data from didit 
            if(req.query.verificationSessionId) {
                const sessionId = req.query.verificationSessionId;
                const response = await fetch(`https://verification.didit.me/v2/session/${sessionId}/decision/`, {
                    headers: {"x-api-key": process.env.DIDIT_API_KEY }
                });
                const data = await response.json();
                vendor_data = data.vendor_data;
                status = data.status;
                console.log("Retrieve Session Result:", data);
            }
        }
        if(vendor_data){
            const user = await User.findOne({ id: vendor_data });
            if(user){
                user.kycStatus = status;
                await user.save();
                console.log(`User ${user.id} KYC status updated to ${status}`);
                if(status.toLowerCase() === "approved"){
                    try {
                        await handleKycApproved(user.wallet);
                        console.log(`Permissions granted for ${user.wallet}`);
                    } catch(err){
                        console.error("Failed to update permissions", err);
                    }
                }
            } else {
                console.warn("User not founf for vendor_data:", vendor_data);
            }
        }

        //redirect user after GET
        if(req.method === "GET"){
            const verificationSessionId = req.query.verificationSessionId;
            return res.redirect(`http://localhost:5173/profile?verificationSessionId=${verificationSessionId}&status=${status}`);
        }
        return res.sendStatus(200);
    } catch(err){
        console.error("KYC Callback Error:", err);
        return res.sendStatus(500);
    }
});

const DIDIT_WEBHOOK_SECRET = process.env.DIDIIT_WEBHOOK_SECRET;

app.use(bodyParser.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));

//webhook endpoint 
app.post("/didit-webhook", async (req, res) => {
    try{
        const signature = req.get("X-Signature"); 
        const rawBody = req.rawBody;

        //verify HMAC signature
        const hmac = crypto.createHmac("sha256", DIDIT_WEBHOOK_SECRET);
        hmac.update(rawBody);
        const digest = hmac.digest("hex");

        if(digest !== signature){
            console.warn("Invalid webhook signature:", digest, signature);
            return res.status(401).send("Unauthorized");
        }
        const playload = req.body;
        const { vendor_data, status, webhook_type, session_id } = playload;
        console.log("Webhook verified:", webhook_type, session_id, vendor_data, status);

        if(vendor_data){
            const user = await User.findOne({ id: vendor_data });
            if(user){
                user.kycStatus = status;
                await user.save();
                console.log(`User ${user.id} KYC status updated to ${status}`); 
                if(status.toLowerCase() === "approved"){
                    try{
                        await handleKycApproved(user.wallet);
                        console.log(`Permission granted for ${user.wallet}`);
                    } catch(err){
                        console.error("Failed to update permission", err);
                    }
                }
            } else {
                console.warn("User not found for vendor_data:", vendor_data);
            }
        }
        res.sendStatus(200);
    } catch(err){
        console.error("Webhook processing error:", err);
        res.sendStatus(500);
    }
});
//-----------------------------KYC Permission-----------------------
async function handleKycApproved(userWallet) {
    let tx1 = await contract.setCampaignPermission(userWallet, true);
    await tx1.wait();
    console.log(`Campaign creation allowed for ${userWallet}`);

    let tx2 = await contract.setDonorPermission(userWallet, true);
    await tx2.wait();
    console.log(`Donating allowed for ${userWallet}`);
}


//---------------------------get user roles from DB--------------------
app.post("/get-user-role", async (req,res) => {
    const { userId } = req.body;
    if(!userId) return res.status(400).json({ error: "Missing userId"});
    try{
        const user = await User.findOne({ id: userId });
        if(!user) return res.status(400).json({ error: "User not found"});

        res.json({ 
            role: user.role,
            user: { kycStatus: user.kycStatus }
        });
    } catch(err){
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});


//-------------------------Charity req route---------------------------
app.post("/submit-charity", async (req, res) => {
    const {orgName, wallet, description, documents} = req.body;
    if(!orgName || !wallet || !description || !documents){
        return res.status(400).json({ error: "Missing required fields"});
    }
    const newReq = new CharityReq({
        id: nanoid(),
        orgName,
        wallet,
        description,
        documents
    });
    await newReq.save();
    res.json({ message: "Charity request submitted", request: newReq });
});

//-----------------------------admin views charity req-------------------------
app.post("/admin-charity-req", async (req, res) => {
    const { userId } = req.body;
    const user = await User.findOne({ id: userId });
    if(!user || user.role !== "ADMIN"){
        return res.status(403).json({error: "Access denied"});
    } 
    const requests = await CharityReq.find()
        res.json({ requests });
});


//-------------------------------Approve/Reject Charity request---------------------
app.post("/update-charity-status", async (req, res) => {
    const { requestId, status } = req.body;

    const request = await CharityReq.findOne({ id: requestId });
    if(!request) return res.status(404).json({ error: "Request not found"});

    if(status === "Approved"){
        try{
            console.log("Registering organization on-chain...");

            const tx = await contract.registerOrganization(
                request.wallet,
                request.orgName,
                request.description,
                request.image || ""
            );
            await tx.wait();
            console.log("Organization registered on-chain", tx.hash);

            const orgs = await contract.getOrganizations();
            const orgIndex = orgs.length - 1;

            const approveTx = await contract.connect(adminSigner).approveOrganization(orgIndex);
            await approveTx.wait();
    
            request.status = "Approved";
            await request.save();

        } catch(err){
            console.error("Blockchain registration failed", err);
            return res.status(500).json({ error: "Failed to register organization on-chain"});
        }
    } else {
        request.status = status;
        await request.save();
    }
    res.json({message: `Charity ${status}`, request});
});

//------------------------------------Admin Analytics-------------------------
app.post("/admin-analytics", async (req, res) => {
     const { userId } = req.body;
    if(!userId) return res.status(400).json({ error: "Missing userId"});
    try{
        const user = await User.findOne({ id: userId });
        if(!user) return res.status(400).json({ error: "User not found"});
        if(user.role !== "ADMIN"){
            return res.status(400).json({ error: "Access Denied"});
        }

        const totalUsers = await User.countDocuments();
        const approvedCharities = await CharityReq.countDocuments({ status: "Approved"});
        const pendingCharities = await CharityReq.countDocuments({ status: "Pending"});
        const rejectedCharities = await CharityReq.countDocuments({ status: "Rejected"});

        //KYC status Dis
        const kycApproved = await User.countDocuments({ kycStatus: "Approved" });
        const kycRejected = await User.countDocuments({ kycStatus: "Rejected" });
        const kycPending = await User.countDocuments({ kycStatus: "Pending" });
        const kycNotStarted = await User.countDocuments({ kycStatus: { $in: [null, "", "Not Started"] } });

        const campaigns = await contract.getCampaigns();

       let totalRaisedBigInt = ethers.BigNumber.from(0);
        for(let c of campaigns){
           try {
                const amount = ethers.BigNumber.from(c.amountCollected);
                totalRaisedBigInt = totalRaisedBigInt.add(amount);
            } catch (e) {
                console.error("Error processing campaign amount:", e, c);
            }
        }
        
        // Convert the safe BigInt sum to the final ETH string
        const totalRaisedETH = ethers.utils.formatEther(totalRaisedBigInt);
        console.log({
    totalUsers,
    approvedCharities,
    pendingCharities,
    rejectedCharities,
    kycDistribution: {
        approved: kycApproved,
        rejected: kycRejected,
        pending: kycPending,
        notStarted: kycNotStarted
    }
});

        res.json({
            totalUsers,
            approvedCharities,
            pendingCharities,
            rejectedCharities,
            totalCampaigns: campaigns.length,
            totalRaisedETH: totalRaisedETH,
             kycDistribution: {
                approved: kycApproved,
                rejected: kycRejected,
                pending: kycPending,
                notStarted: kycNotStarted
            } 
        });
    } catch(err){
        console.error(err);
        res.status(500).json({ error: "Failed analytics"});
    }
});
