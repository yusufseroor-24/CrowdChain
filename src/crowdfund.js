import { initWeb3, getContract, getWeb3 } from "./web3.js";
import Web3, { ERR_CONTRACT_RESOLVER_MISSING } from "web3";

//create campaign.js
//--------------------------------------Create Campaign-----------------------------------------------
async function createCampaign(event){
    event.preventDefault(); //prevents the form from reloading 
    const kycStatus = await fetchKYCStatus();
        if(kycStatus !== "Approved"){
            alert("You cannot create a campaign until your KYC has been Approved.");
            return;
        }

    const title = document.getElementById("title")?.value;
    const description = document.getElementById("description")?.value;
    const goal = document.getElementById("goal")?.value;
    const endDate = document.getElementById("endingDate")?.value;
    const image = document.getElementById("image")?.value || ""; //if image is empty; empty string so function doesnt break

    if(!title || !description || !goal || !endDate) {
        alert("Please fill in all the required fields");
        return;
    }
        const web3 = getWeb3();
        const contract = getContract();
        const accounts = await web3.eth.getAccounts();
        const owner = accounts[0];

        if(!owner){
            alert("Please connect to your walllet first.");
            return;
        }

    const currentTimeStamp = Math.floor(Date.now() / 1000);
    const deadlineUnix = Math.floor(new Date(endDate).getTime() / 1000);

    if(deadlineUnix < currentTimeStamp){
        alert ("You can't set a deadline in the past! ");
        return;
    }
    //saftey try block so that if campaign has an error it catches it 
    try {
        //conversion
        const targetWei = web3.utils.toWei(goal, "ether");
        await contract.methods.createCampaign(
            owner, title, description, targetWei, deadlineUnix, image).send({ from: owner});
        alert("Your Campaign has successfully been created!");
    } catch (err) {
        console.error(err);
        alert("Error while creating campaign. Check Console.");
    }
}


//donate page js
//----------------------function to get campaigns from blockchain---------------------
async function loadingCampaigns(){
    const contract = getContract();
    const campaigns = await contract.methods.getCampaigns().call();
    const campaignsContainer = document.getElementById("campaigns");

    if(!campaignsContainer) return;
    
    campaignsContainer.innerHTML = ""; //clears before addition to avoid duplication
    window.campaigns = campaigns //store globally 
    //loopings through each campaign inside the array 
    campaigns.forEach((c, index) => {
        if (hidden(index)) return; //skip hidden
    
        const card = document.createElement("div");
        card.classList.add("campaign-card"); //creates a new div in memory 

        //end date formatting
        const endDate = new Date(Number(c.deadline) * 1000).toLocaleDateString("en-US", {
            year: 'numeric', month: 'long', day:'numeric', hour: '2-digit', minute: '2-digit'
        });

        card.innerHTML = `
        <img src="${c.image}">
        <h4>${c.title}</h4>
        <p>Campaign ID: ${index}</p>
        <p>${c.description}</p>
        <p><b>Goal:</b> ${Web3.utils.fromWei(c.target, "ether")} ETH</p> 
        <p><b>Raised:</b> ${Web3.utils.fromWei(c.amountCollected, "ether")} ETH</p> 
        <p><b>End Date:</b> ${endDate}</p>
        `;

        //when a card campaign from the list is clicked, the full campaign detail function is displayed
        card.addEventListener("click", () => showCampaignDetail(index));
        campaignsContainer.appendChild(card);
    });
}

//--------------------------------------connect wallet----------------------------------------------
let userAcc = null;

async function connectWallet(){
    if(typeof window.ethereum == "undefined"){
        alert("MetaMask is not installed, Please install it.");
        return;
    }
    try{
        //request access to account
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        userAcc = accounts[0];

        //update frontend UI
        const connectBtn = document.getElementById("walletAdd");
        if(connectBtn){
            connectBtn.innerText = `Connected: ${userAcc.slice(0,6)}...${userAcc.slice(-4)}`;
        }
        // sessionStorage.setItem("userAcc", userAcc);
        //-------------------------------register user in backend------------------------------
        const res = await fetch("https://unsputtering-shayne-disquisitional.ngrok-free.dev/register-user", {
            method: "POST",
            headers: { "Content-Type": "application/json"},
            body: JSON.stringify({ walletAdd: userAcc})
        });

        const data = await res.json();
        if (data.user) {
            localStorage.setItem("userId", data.user.id);
            localStorage.setItem("userRole", data.user.role || "USER");
            console.log("User Registered:", data.user);
        }

        await updateKYCStatus();
        await userProfile();
    } catch (err){
        console.error("Wallet connection failed", err);
        alert("Failed to connect to your wallet. Check MetaMask.");
    }
}

    window.addEventListener("load", async () => {
        if(typeof window.ethereum !=="undefined"){
            const savedAccount = sessionStorage.getItem("userAcc");
            const accounts = await window.ethereum.request({method: "eth_accounts"});

            if(savedAccount && accounts.length > 0){
                userAcc = accounts[0];
                const connectBtn = document.getElementById("walletAdd");
                 if(connectBtn){
                    connectBtn.innerText = `Connected: ${userAcc.slice(0,6)}...${userAcc.slice(-4)}`;
                }
            } else {
                sessionStorage.removeItem("userAcc");
                const connectBtn = document.getElementById("walletAdd");
                if(connectBtn){
                    connectBtn.innerText = "Not Connected";
                }
            }
        }
    });

    //attach to the button in HTML
    const connectBtn = document.getElementById("connectWallet");
    if (connectBtn){
    connectBtn.addEventListener("click",(e) => {
        e.preventDefault();
        connectWallet();
    });
}


//-----------------------------function to show campaign details-------------------------------------
function showCampaignDetail(index){
    //window.campaigns = campaigns; //store campaigns globally to avoid referring to blockchain everytime
    const c = window.campaigns[index]; //the specific campaign a user clicked
    const detail = document.getElementById("campaign-detail"); //div from HTML

    //calculate the % completion
    const raised = Number(Web3.utils.fromWei(c.amountCollected, "ether"));
    const goal = Number(Web3.utils.fromWei(c.target, "ether"));
    const completion = Math.min((raised / goal) * 100, 100).toFixed(2);

    //calculate Days left until deadline
    const current = new Date();
    const deadline = new Date(Number(c.deadline) * 1000) //UNIX timestamp
    const daysLeft = Math.max(Math.ceil((deadline - current) / (1000*60*60*24)), 0); //convert milliseconds to days

    //detail view in HTML
    detail.innerHTML = `
    <button onclick="closeDetail()" class="closeBtn">X</button>
    <div class="campaign-pic">
        <img src="${c.image}">
        <h4>${c.title}</h4>
        <p>${c.description}</p>
    </div>
    <div class="campaign-stat">
        <p><b>Goal:</b> ${goal} ETH</p>
        <p><b>Raised:</b> ${raised} ETH</p>
        <p><b>Days Left:</b> ${daysLeft}</p>
    </div>
    <div class="progress-bar">
        <div class="progress" style="width:${completion}%">${completion}%</div>
    </div>
    <div class="donation-part">
    <input type="number" id="donationAmount" placeholder="Enter amount of donation in ETH" min="0" step="0.01">
    <button class="donatebutton" data-index="${index}">Donate</button>
    </div>
    <div class="creator-wallet">
        <p><b>Campaign Creator:</b> ${c.owner}</p>
    </div>
    <div id="donorBox" class="donor-box">
        <p><b>Donors: </b></p>
        <div id="donorList" class="donor-list">
            <p>Loading Donors...</p>
        </div>
    </div>
    `;
    detail.style.display = "block"; //shows the view by making the div visible
    loadDonors(index);
    //donation button listener 
    const donatebutton = detail.querySelector(".donatebutton");
    donatebutton.addEventListener("click", () => { 
        const idx = donatebutton.dataset.index;
        donate(Number(idx));
    });
    //function to close the detail view of the campaign
    window.closeDetail = function(){
        const detail = document.getElementById("campaign-detail"); //div from HTML 
        detail.style.display = "none";
    }
}

//------------------------------------Loading Donors----------------------------------
async function loadDonors(index){
    const contract = getContract();
    try{
        const result = await contract.methods.getDonators(index).call();
        const donators = result[0];
        const donations = result[1];

        const donorList = document.getElementById("donorList");
        donorList.innerHTML = "";

        if(donators.length === 0){
            donorList.innerHTML = "<p>No Donors Yet</p>";
            return;
        }
        for(let i=0; i<donators.length; i++){
            const donorDiv = document.createElement("div");
            donorDiv.classList.add("Donor-entry");
            donorDiv.innerHTML = `
            <p>${donators[i]} - <b>${Web3.utils.fromWei(donations[i], "ether")} ETH </b></p>`;
            donorList.appendChild(donorDiv);
        }
    } catch(err){
        console.error("Eroor Loading Donors:", err);
        document.getElementById("donorList").innerHTML = "<p>Error Loading Donors";
    }
}

//---------------------------------------------Donate----------------------------------------------
async function donate(index){
    await initWeb3(); //ensure wallet connected 
     const accounts = await getWeb3().eth.getAccounts();

    if(!accounts[0]){
        alert("Connect your wallet first.");
        return;
    }
    const amountEther = document.getElementById("donationAmount").value;
    if (!amountEther || amountEther <= 0) {
        alert("Enter a valid donation amount.");
        return;
    }
     //conver ETH to WEI 
    const amountWei = getWeb3().utils.toWei(amountEther, "ether");
    try {
        await getContract().methods.donate(index).send({
            from: accounts[0], 
            value: amountWei,
        });
        alert("Donation Sucessful!");
        closeDetail();
        await loadingCampaigns();
    } catch(error){
        console.error(error);
        alert("Your Donation Failed.");
    }
}

//-----------------------------------profile page javascript--------------------------
async function userProfile(){
    const userId = localStorage.getItem("userId");
    if(!userId) return;
    if(!document.querySelector(".profile-section")) return;

    const res = await fetch("https://unsputtering-shayne-disquisitional.ngrok-free.dev/get-user-role", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ userId })
    });
    const data = await res.json();
    const role = data.role || "USER";

    localStorage.setItem("userRole", role);
    //include wallet hash in profile
    const profileWallet = document.getElementById("wallet-profile");
    if(profileWallet) profileWallet.innerText = `Wallet: ${userAcc.slice(0,6)}...${userAcc.slice(-4)}`;

    //load user campaigns
    const contract = getContract();
    const campaigns = await contract.methods.getCampaigns().call();
    window.campaigns = campaigns;

    const userCampaigns = campaigns
    .map((c, i) => ({...c, realIndex:i}))
    .filter (c => c.owner.toLowerCase() === userAcc.toLowerCase());
    
    renderUserCards(userCampaigns);
    renderUserChart(userCampaigns);

    const campaignContainer = document.getElementById("myCampaignsContainer");
    campaignContainer.innerHTML = "";

userCampaigns.forEach((c) => {
   const raised = Number(Web3.utils.fromWei(c.amountCollected, "ether"));
   const goal = Number(Web3.utils.fromWei(c.target, "ether"));
   const completion = Math.min((raised/goal) * 100, 100).toFixed(2);
   const deadline = new Date(Number(c.deadline) * 1000);
   const daysLeft = Math.max(Math.ceil((deadline - new Date()) / (1000*60*60*24)), 0);
   const status = daysLeft > 0 ? "Active" : "Completed";

   const div = document.createElement("div");
   div.classList.add("campaign-card");
   div.innerHTML = `
        <h4>${c.title}</h4>
        <p>${c.description}</p>
        <p><b>Raised:</b> ${raised} / ${goal} ETH</p>
        <div class="progress-bar">
        <div class="progress" style="width:${completion}%">${completion}%</div>
        </div>
        <p>Status: ${status}</p>
        <button class="withdrawBtn">Withdraw</button>
        <button class="hideCampaignBtn" data-index="${c.realIndex}"></button>
   `;

   //attach click listner to withdraw button 
   const withdrawBtn = div.querySelector(".withdrawBtn");
   withdrawBtn.addEventListener("click", () => withdrawFunds(c.realIndex));

   const hideBtn = div.querySelector(".hideCampaignBtn");
   function updateHideBtn(){
    if(hidden(c.realIndex)){
        hideBtn.innerText = "Hidden";
        hideBtn.style.backgroundColor = "red";
    } else {
        hideBtn.innerText = "Hide Campaign";
        hideBtn.style.backgroundColor = "grey";
    }
   }

   hideBtn.addEventListener("click", () => {
    if(hidden(c.realIndex)){
        unhideCampaign(c.realIndex);
    } else {
        hideCampaign(c.realIndex);
    }
    updateHideBtn();
    });

   updateHideBtn();
   campaignContainer.appendChild(div);
});

   //RBAC views
    if(role === "ADMIN"){
        showAdminView();
        //fetch admin analytics 
        try{
        const userId = localStorage.getItem("userId");
         const res = await fetch("https://unsputtering-shayne-disquisitional.ngrok-free.dev/admin-analytics", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true" }, body: JSON.stringify({ userId })
        });
        if (!res.ok) {
            throw new Error(`HTTP Error: ${res.status}`);
        }

        const data = await res.json();
        console.log("admin analytics response:", data);

        renderAdminCards(data);
        renderAdminChart(campaigns);

        } catch (err) {
        console.error("Admin data fetch failed in userProfile:", err);
        const adminAnalytics = document.getElementById("adminAnalytics");
        if (adminAnalytics) {
            adminAnalytics.innerHTML = `<p>Failed to load admin data due to network error or JSON parse failure.</p><p>Check the browser console for details.</p>`;
        }
    }
    }else{
        showUserView();
    }

      function showUserView(){
    const campaignBox = document.querySelector(".campaign-box");
    const analyticsRow = document.querySelector(".analytics-row");
    const transactionBox = document.querySelector("#transaction");
    const adminDashboard = document.getElementById("adminDashboard");

    if(campaignBox) campaignBox.style.display = "block";
    if(analyticsRow) analyticsRow.style.display = "block";
    if(transactionBox) transactionBox.style.display = "block";
    if(adminDashboard) adminDashboard.style.display = "none"; // hide admin view
}

function showAdminView(){
    const campaignBox = document.querySelector(".campaign-box");
    const analyticsRow = document.querySelector(".analytics-row");
    const transactionBox = document.querySelector("#transaction");
    const adminDashboard = document.getElementById("adminDashboard");
    const profileBox = document.getElementById("profileBox");

    if(profileBox) profileBox.style.display = "none";
    if(campaignBox) campaignBox.style.display = "none";
    if(analyticsRow) analyticsRow.style.display = "none";
    if(transactionBox) transactionBox.style.display = "none";
    if(adminDashboard) adminDashboard.style.display = "block"; // show admin view

    loadAdminData();
}
if(userAcc) {
    await loadTransactions();
}

}

async function fetchKYCStatus() {
    const userId = localStorage.getItem("userId");
    if (!userId) return "Not Started";

    try {
        const res = await fetch("https://unsputtering-shayne-disquisitional.ngrok-free.dev/get-user-role", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        // KYC status is stored in backend as user.kycStatus
        return data.user?.kycStatus || "Not Started";
    } catch (err) {
        console.error("Failed to fetch KYC status", err);
        return "Not Started";
    }
}

async function updateKYCStatus(){
    const kycStatus = await fetchKYCStatus();
    const kycBadge = document.getElementById("kycStatusBadge");
    if(!kycBadge) return;

    kycBadge.textContent = kycStatus 

     switch (kycStatus) {
        case "Approved":
            kycBadge.style.color = "green";
            break;
        case "Declined":
            kycBadge.style.color = "red";
            break;
        default:
            kycBadge.style.color = "orange";
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    await initWeb3();

    const accounts = await getWeb3().eth.getAccounts();
    if(accounts.length > 0) userAcc = accounts[0];

  // Ensure userId exists before updating KYC status
    const userId = localStorage.getItem("userId");
    if(userId){
        await updateKYCStatus();
    }

    // If returning from Didit KYC with status query param
    const params = new URLSearchParams(window.location.search);
    if(params.has("status") && userId){
        await updateKYCStatus();
        // Clean the URL to prevent repeated update
        const url = new URL(window.location);
        url.search = "";
        window.history.replaceState({}, document.title, url);
    }

    if(document.getElementById("campaigns")){
        await loadingCampaigns();
    }

    if(document.getElementById("organizations")){
        await loadingOrganizations();
    }

    if(document.querySelector(".profile-section")){
        await userProfile();
    }

     const connectBtn = document.getElementById("connectWallet");
    if(connectBtn){
        connectBtn.addEventListener("click", connectWallet);
    }
    //Start KycBtn
    const kycBtn = document.getElementById("kycBtn");
    if(kycBtn){
        kycBtn.addEventListener("click", startKYC);
    }

    const charityForm = document.getElementById("formCharityReq");
if(charityForm){
    charityForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const orgName = document.getElementById("orgName").value;
        const description = document.getElementById("description").value;
        const documents = document.getElementById("document").value;
        const wallet = userAcc;
        
    try{
        const res = await fetch("https://unsputtering-shayne-disquisitional.ngrok-free.dev/submit-charity", {
            method: "POST",
            headers: { "Content-Type": "application/json"},
            body: JSON.stringify({ orgName, wallet, description, documents })
        });
        const data = await res.json();
        if(!res.ok){
            alert("Error: " + (data.error || "Uknown error"));
        }else{
        alert(data.message);
        }
    } catch(err){
        console.error("Submit charity failed:", err);
        alert("Failed to submit charity request");
    }
    });
}
if (typeof window.ethereum !== "undefined") {
    window.ethereum.on("accountsChanged", async (accounts) => {
        if (accounts.length === 0) {
            userAcc = null;
            sessionStorage.removeItem("userAcc");
            localStorage.removeItem("userRole");
            localStorage.removeItem("userId");

            const connectBtn = document.getElementById("walletAdd");
            if (connectBtn) connectBtn.innerText = "Not Connected";

        } else {
            userAcc = accounts[0];
            sessionStorage.setItem("userAcc", userAcc);

            const connectBtn = document.getElementById("walletAdd");
            if (connectBtn) connectBtn.innerText = `Connected: ${userAcc.slice(0,6)}...${userAcc.slice(-4)}`;

            // register/fetch new wallet
            const res = await fetch("https://unsputtering-shayne-disquisitional.ngrok-free.dev/register-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletAdd: userAcc })
            });

            const data = await res.json();
            if (data.user) {
                localStorage.setItem("userId", data.user.id);
                localStorage.setItem("userRole", data.user.role || "USER");
            }

            // ⭐ NEW PART (VERY minimal)
            const role = localStorage.getItem("userRole");
            if (role !== "ADMIN") {
                // switched to user → deny admin analytics
                const msg = document.getElementById("adminAccessDenied");
                if (msg) msg.style.display = "block";

                const adminPanel = document.getElementById("adminDashboard");
                if (adminPanel) adminPanel.style.display = "none";
            } else {
                // switched to admin → show analytics
                const msg = document.getElementById("adminAccessDenied");
                if (msg) msg.style.display = "none";

                const adminPanel = document.getElementById("adminDashboard");
                if (adminPanel) adminPanel.style.display = "block";
            }

            // update KYC for this wallet
            await updateKYCStatus();
            await userProfile();
        }
    });
}


        //ensures the above function works when submit button is done 
        const form = document.getElementById("formCreateCampaign");
        if (form){ form.addEventListener("submit", createCampaign); }

});

//-----------------------------loadTransactions()--------------------------
async function loadTransactions(){
    if(!userAcc) return;

    const web3 = getWeb3();
    const contract = getContract();

    try{
        const transactions = await contract.methods.transactionView(userAcc).call();
        const txContainer = document.getElementById("transactionList");
        txContainer.innerHTML = "";

        if(transactions.length === 0){
            txContainer.innerHTML = "<p>You haven't made any donations yet.</p>";
            return;
        }
        for(let i=0; i<transactions.length; i++){
            const t = transactions[i];
            const timestampNum = Number(t.timestamp); //conver to a JS number
            const amountStr = t.amount.toString(); //string not BigInt

            const date = new Date(timestampNum * 1000).toLocaleString();
            const valueEth = web3.utils.fromWei(amountStr, "ether");

            const div = document.createElement("div");
            div.classList.add("transaction-entry");

            div.innerHTML = `
                <p>
                <b>Campaign ID:</b> ${t.campaignId} 
                - <b>${valueEth} ETH </b>
                on <b>${date}</b>
                </p> `;
            txContainer.appendChild(div);
        }
    } catch(err){
        console.error("Error Loading Transactions", err);
        document.getElementById("transactionList").innerHTML = "<p>Error Loading Transactions</p>";
    }
}


//------------------------------------------Withdraw-----------------------------------------------
async function withdrawFunds(index) {
    if(!userAcc) {
        alert("Wallet not connected. Connect your wallet first!");
        return;
    }
    try {
        const web3 = getWeb3();
        const contract = getContract();
        const accounts = await web3.eth.getAccounts();
        const account = accounts[0];

        await contract.methods.withdraw(index).send({ from: account, gas: 3000000 });
        
        alert("Successful Withdrawal");
        userProfile();  //reload profile page
    } catch (err){
        console.error(err);
        alert("Withdrawal failed. Make sure the campaign deadline has passed, and the campaign is yours.");
    }
}

//----------------------------------------Hide Campaign---------------------------------------------
function hiddenCampaigns(){
    return JSON.parse(localStorage.getItem("hiddenCampaigns") || "[]");
}

function hideCampaign(index){
    const hidden = hiddenCampaigns();
    if(!hidden.includes(index.toString())){
        hidden.push(index.toString());
        localStorage.setItem("hiddenCampaigns", JSON.stringify(hidden));
    }
}

function unhideCampaign(index){
    const hidden = hiddenCampaigns();
    const updatedHide = hidden.filter(i => i !== index.toString());
    localStorage.setItem("hiddenCampaigns", JSON.stringify(updatedHide));
}

function hidden(index){
    return hiddenCampaigns().includes(index.toString());
}

//----------------------------------------Start KYC--------------------------------------------------
async function startKYC(){
    const userId = localStorage.getItem("userId");
    console.log("Starting KYC for userId:", userId); 
    if(!userId){
        alert("No User Registed. Please Connect Wallet First.");
        return;
    }
    const res = await fetch("https://unsputtering-shayne-disquisitional.ngrok-free.dev/create-session", {
        method: "POST",
        headers: { "Content-Type":"application/json"},
        body: JSON.stringify({ userId })
    });
    const data = await res.json();
    if(data.url){
        window.location.href = data.url; 
    }
}   

//----------------------------Organization loading---------------------------
async function loadingOrganizations(){
    const contract = getContract();
    const orgs = await contract.methods.getOrganizations().call();

    console.log("Organizations from contract:", orgs);

    const orgsContainer = document.getElementById("organizations");
    if(!orgsContainer) return;

    orgsContainer.innerHTML = "";
    window.orgs = orgs

    orgs.forEach((o, index) => {
        const card = document.createElement("div");
        card.classList.add("organization-card");

        const orgName = o.name || "Unnamed";
        const orgDesc = o.description || "";
        const orgWallet = o.wallet || "";
        const orgImage = "https://via.placeholder.com/150";

        card.innerHTML = `
        <h4>${orgName}</h4>
        <p><b>Wallet:</b>${orgWallet}</p>
        <p>${orgDesc}</p>
        <img src="${orgImage}" alt="${orgName}">
        `;

        if(o.approved){
            card.innerHTML += `
                    <input type="number" id="orgDonation${index}" placeholder="Amount in ETH">
                    <button onclick="donateToOrg(${index})" class="orgDonateBtn">Donate</button>
            `;
        } else{
            card.innerHTML += `<p><i>Pending approval by admin</i></p>`;
        }
        orgsContainer.appendChild(card);
    });
}
window.loadingOrganizations = loadingOrganizations;

async function donateToOrg(index){
    const amountEther = document.getElementById(`orgDonation${index}`).value;
    if(!amountEther || amountEther <= 0){
        alert("Enter a valid donation amount");
        return;
    }
    const amountWei = getWeb3().utils.toWei(amountEther, "ether");
    const accounts = await getWeb3().eth.getAccounts();
    try{
    await getContract().methods.donateToOrganization(index).send({
        from: accounts[0],
        value: amountWei
    });
    alert("Donation successful!");
    await loadingOrganizations();
} catch(err){
    console.error("Organization Donation failed", err);
    alert("Donation failed");
}
}
window.donateToOrg = donateToOrg;


//---------------------------user analytics----------------------------------
function renderUserCards(campaigns){
    const container = document.getElementById("userCards");
    container.innerHTML = "";
    const totalCampaigns = campaigns.length;
    const totalRaised = campaigns.reduce((sum, c) => sum + Number(Web3.utils.fromWei(c.amountCollected, "ether")), 0);

    const cards = [
        {title: "Total Campaigns", value: totalCampaigns},
        {title: "Total Raised (ETH)", value: totalRaised.toFixed(2 )},
    ];
    cards.forEach(c => {
        const div = document.createElement("div");
        div.classList.add("analytics-card");
        div.innerHTML = `<h4>${c.title}</h4><p>${c.value}</p>`;
        container.appendChild(div);
    });
}

function renderUserChart(campaigns){
    const ctx = document.getElementById("userChart").getContext("2d");
    const labels = campaigns.map(c => c.title);
    const data = campaigns.map(c => Number(Web3.utils.fromWei(c.amountCollected, "ether")));
    new Chart(ctx, {
        type: "bar",
        data: { labels, datasets: [{ label: "ETH Raised", data, backgroundColor: "rgba(54, 162, 235, 0.6)" }] },
        options: { responsive:true, plugins: { legend:{display:false} }, scales:{ y:{ beginAtZero:true } } }
    });
}


//-----------------------------------------Admin anlaytics-------------------------------------
function renderAdminCards(data){
    const container = document.getElementById("adminCards");
    if(!container) return;

    const stats = data?.analytics || data;
    if(!stats){
        container.innerHTML = "<p>No analytics data available</p>";
        return;
    }

    container.innerHTML = "";
    const cards = [
        { title: "Total Users", value: stats.totalUsers || 0 }, 
        { title: "Approved Charities", value: stats.approvedCharities || 0 },
        { title: "Total Campaigns", value: stats.totalCampaigns || 0 },
        { title: "Total Raised (ETH)", value: stats.totalRaisedETH || 0 },
    ];
    cards.forEach(c => {
        const div = document.createElement("div");
        div.classList.add("adminCards");
        div.innerHTML = `<h4>${c.title}</h4><p>${c.value}</p>`;
        container.appendChild(div);
    });

    // KYC distribution cards
    const kyc = stats.kycDistribution || {};
    const kycCards = [
        { title: "KYC Approved", value: kyc.approved || 0 },
        { title: "KYC Declined", value: kyc.declined || 0 },
        { title: "KYC Pending", value: kyc.pending || 0 },
        { title: "KYC Not Started", value: kyc.notStarted || 0 },
    ];

    kycCards.forEach(c => {
        const div = document.createElement("div");
        div.classList.add("adminCard");
        div.innerHTML = `<h4>${c.title}</h4><p>${c.value}</p>`;
        container.appendChild(div);
    });
}


function renderAdminChart(campaigns){
    const canvas = document.getElementById("adminChart");
    if(!canvas){
        console.warn("adminChart canvas not found yet");
        return;
    }
    const ctx = canvas.getContext("2d");
    const labels = campaigns.map(c => c.title);
    const data = campaigns.map(c => Number(Web3.utils.fromWei(c.amountCollected, "ether")));
    new Chart(ctx, {
        type: "pie",
        data: {labels, datasets: [{ label: "ETH Raised", data, backgroundColor: labels.map(() => `hsl(${Math.random()*360},70%,60%)`) }] },
        options: { responsive:true }
    });
}

   window.updateCharity = async(requestId, status) => {
        try{
        const res = await fetch("https://unsputtering-shayne-disquisitional.ngrok-free.dev/update-charity-status", {
            method: "POST",
            headers: { "Content-Type":"application/json"},
            body: JSON.stringify({ requestId, status})
        });
        
        const data = await res.json();
        if(!res.ok){
            alert("Error: " + (data.error || data.message || "Uknown error"));
            console.error("Update charity failed:", data);
             return;
        }

        alert(data.message|| `Charity ${status} sucessfully updated`);
        await loadAdminData();

    if(typeof loadingOrganizations === "function") {
        try{
            await loadingOrganizations();
        } catch(err){
            console.error("Failed to reload organizations after approval:", err);
        }
    } else {
        console.warn("loadingOrganizations() is not defined in the scope");
    }
}
     catch(err){
        console.error("updateChaity error:", err);
        alert("Failed to update chairty status");
    }
};

    async function loadAdminData(){
        const userId = localStorage.getItem("userId");
        if(!userId) return;
        const res = await fetch("https://unsputtering-shayne-disquisitional.ngrok-free.dev/admin-charity-req", {
            method: "POST",
            headers: { "Content-Type": "application/json"},
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        // const adminAnalytics = document.getElementById("adminAnalytics");
        // adminAnalytics.innerHTML = "";

        data.requests.forEach(req => {
            const div = document.createElement("div");
            div.classList.add("charity-request");
            div.innerHTML = `
            <h4> ${req.orgName}</h4>
            <p>${req.description}<p>
            <p>Wallet: ${req.wallet}</p>
            <p>Status: ${req.status}</p>
            <button onclick="updateCharity('${req.id}','Approved')">Approve</button>
            <button onclick="updateCharity('${req.id}','Rejected')">Reject</button>
            `;
            adminAnalytics.appendChild(div);
        });
    }


// function to handle BigInt and Web3 objects
function serializeBigInt(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "bigint") return obj.toString();

    // Handle Web3 BN objects (_hex property)
    if (typeof obj === "object" && obj._hex && typeof obj.toString === "function") {
        return obj.toString(); }
    if (Array.isArray(obj)) return obj.map(serializeBigInt);
    if (typeof obj === "object") {
        const result = {};
        for (const key in obj) {
            if (Object.hasOwn(obj, key)) {
                result[key] = serializeBigInt(obj[key]);
            }
        } return result;
    } return obj;
}

async function downloadAllData() {
    try {
        const userId = localStorage.getItem("userId");

        // get MongoDB data
        const [usersRes, charityRes] = await Promise.all([
            fetch("https://unsputtering-shayne-disquisitional.ngrok-free.dev/admin-analytics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId })
            }),
            fetch("https://unsputtering-shayne-disquisitional.ngrok-free.dev/admin-charity-req", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId })
            })
        ]);

        const usersData = await usersRes.json();
        const charityData = await charityRes.json();

        //  get smart contract data 
        const contract = getContract();
        const campaigns = await contract.methods.getCampaigns().call();
        const organizations = await contract.methods.getOrganizations().call();

        const campaignsWithDonors = await Promise.all(
            campaigns.map(async (c, index) => {
                const result = await contract.methods.getDonators(index).call();
                const donors = result[0].map((wallet, i) => ({
                    wallet,
                    amount: Web3.utils.fromWei(result[1][i].toString(), "ether")
                }));
                return {
                    ...c,
                    donors
                };
            })
        );

        // combine all the data into one 
        const combinedData = {
            users: usersData?.analytics || usersData,
            charities: charityData?.requests || charityData,
            campaigns: campaignsWithDonors,
            organizations
        };
        // use the above function
        const serializedData = serializeBigInt(combinedData);

        //Download JSON file 
        const blob = new Blob([JSON.stringify(serializedData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `platform_data_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error("Error downloading data:", err);
        alert("Failed to download data. Check console.");
    }
}
const downloadBtn = document.getElementById("downloadJSONBtn");
if (downloadBtn) downloadBtn.addEventListener("click", downloadAllData);



