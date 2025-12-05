// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

contract Crowdfunding {
   struct Campaign {
    address owner;
    string title;
    string description;
    uint256 target;
    string image;
    uint256 deadline;
    uint256 amountCollected;
    address[] donators;
    uint256[] donations;
   }
   struct Transaction {
    uint256 campaignId;
    uint256 amount;
    uint256 timestamp;
    bool isOrganization; //true = organization
   }
   struct Organization {
    address wallet;
    string name;
    string description;
    string image;
    bool approved;
    uint256 amountCollected;
    address[] donators;
    uint256[] donations;
   }

address public admin;
bool private locked;

constructor(){
    admin = msg.sender;
}

modifier onlyAdmin(){
    require(msg.sender == admin, "Not authorized"); _;
}
modifier nonReentrant(){
    require(!locked, "No reentrancy");
    locked = true;
    _;
    locked = false;
}

mapping (uint256 => Campaign) public campaigns;
//stores the transaction history of donors
mapping (address => Transaction[]) public donorTransaction; 
uint256 public numberOfCampaigns = 0;

mapping (uint256 => Organization) public organizations;
uint256 public numberOfOrganizations = 0;

//---------------------------KYC flags------------------------------
mapping (address => bool) public allowedCampaignCreators;
mapping (address => bool) public allowedDonors;

//events
event OrganizationSubmitted(uint256 orgId, address wallet, string name);
event OrganizationApproved(uint256 orgId);
event OrganizationRejected(uint256 orgId);

//function to create campaigns 
function createCampaign(address _owner, 
string memory _title, 
string memory _description, 
uint256 _target, 
uint256 _deadline, 
string memory _image) public returns (uint256) {
    require(allowedCampaignCreators[msg.sender], "Not KYC approved to create campaign");
//ensure deadline is in the future 
    require(_deadline > block.timestamp, "Deadline date should be in the future.");
 
//retreives info from campaigns array and stores it in campaign, Campaign = struct  
    Campaign storage campaign = campaigns[numberOfCampaigns];

    campaign.owner = _owner;
    campaign.title = _title;
    campaign.description = _description;
    campaign.target = _target;
    campaign.image = _image;
    campaign.deadline =_deadline;
    campaign.amountCollected = 0;

    numberOfCampaigns++;
    return numberOfCampaigns - 1;
}

//list of people who donated to a campaign 
function getDonators(uint256 _id) public view returns (address[] memory, uint256[] memory) {
    return(campaigns[_id].donators, campaigns[_id].donations);
}

//function to donate to campaigns 
function donate(uint256 _id) public payable nonReentrant{
    require(allowedDonors[msg.sender], "Not KYC approved to donate");
    uint256 amount = msg.value;
    Campaign storage campaign = campaigns[_id];

    require(block.timestamp < campaign.deadline, "Campaign has ended."); //before campaign deadline
    require(amount > 0, "Donation amount must be greater than Zero."); //donation amount > 0
    //push address of person who donated
    campaign.donators.push(msg.sender);
    //push amount
    campaign.donations.push(amount);
    campaign.amountCollected += amount; 

    //store the donor transaction history in array
    donorTransaction[msg.sender].push(Transaction({
        campaignId: _id, amount: amount, timestamp: block.timestamp, isOrganization: false}));
}

function getCampaigns() public view returns (Campaign[] memory) {
    Campaign[] memory allCampaigns = new Campaign[](numberOfCampaigns);
    //For loop to view campaigns 
    for(uint i=0; i < numberOfCampaigns; i++) {
        Campaign storage currentCampaign = campaigns[i];
        allCampaigns[i] = currentCampaign;
    }
    return allCampaigns;
}

//withdraw funds by owner of campaign 
function withdraw(uint256 _id) public  nonReentrant{
    Campaign storage campaign = campaigns[_id];

    require(msg.sender == campaign.owner, "Only the Campaign owner can withdraw funds.");
    require(block.timestamp >= campaign.deadline, "Cannot withdraw funds before the deadline.");
    require(campaign.amountCollected > 0, "No funds to withdraw.");

    uint256 amount = campaign.amountCollected; //to still access the value after reset to 0
    campaign.amountCollected = 0; //resets to 0, prevents reentrancy attack (re-entering same function before its done)

    (bool sent, ) = payable(campaign.owner).call{value: amount}("");
    require(sent, "Failed to send.");    
}

//function for transaction view of donor in all campaigns
function transactionView(address _donor) public view returns (Transaction[] memory) {
    return donorTransaction[_donor];
}

function registerOrganization( address _wallet,
 string memory _name,
 string memory _description,
 string memory _image)
 public returns (uint256){
    Organization storage org = organizations[numberOfOrganizations];
    org.wallet = _wallet;
    org.name = _name;
    org.description = _description;
    org.image = _image;
    org.approved = false;

    emit OrganizationSubmitted(numberOfOrganizations, _wallet, _name);

    numberOfOrganizations++;
    return numberOfOrganizations - 1;
}

//admin aproves 
function approveOrganization(uint256 _id) public onlyAdmin{
    Organization storage org = organizations[_id];
    org.approved = true;

    emit OrganizationApproved(_id);
}

//admin rejects 
function rejectOrganization(uint256 _id) public onlyAdmin{
    Organization storage org = organizations[_id];
    org.approved = false;

    emit OrganizationRejected(_id);
}
function donateToOrganization(uint256 _id) public payable nonReentrant{
    require(allowedDonors[msg.sender], "Not KYC approved to donate");
    uint256 amount = msg.value;
    Organization storage org = organizations[_id];
    require(org.approved, "Organization is not approved");
    require(amount > 0, "Donation must be greater than zero");

    org.donators.push(msg.sender);
    org.donations.push(amount);
    org.amountCollected +=amount;

    //send funds immeditely
    (bool sent, ) = payable(org.wallet).call{value: amount}("");
    require(sent, "Transfer failed");

    donorTransaction[msg.sender].push(Transaction({
        campaignId: _id,
        amount: amount,
        timestamp: block.timestamp, 
        isOrganization: true
    }));
}

function getOrganizations() public view returns (Organization[] memory){
    Organization[] memory allOrgs = new Organization[](numberOfOrganizations);
    for(uint i=0; i < numberOfOrganizations; i++) {
        Organization storage currentOrg = organizations[i];
        allOrgs[i] = currentOrg;
    }
    return allOrgs;
}


//----------------------------Admin functions--------------------------
function setCampaignPermission(address _user, bool _allowed) public onlyAdmin {
    allowedCampaignCreators[_user] = _allowed;
}
function setDonorPermission(address _user, bool _allowed) public onlyAdmin{
    allowedDonors[_user] = _allowed;
}

}
