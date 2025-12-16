import Web3 from "web3";
import CrowdfundingABI from "./abi/Crowdfunding.json";

//Address of the deployed smart contract 
const CONTRACT_ADDRESS = "0x5d19EbD3A35DbE7A16e23FB35D8FC2Db5dE3Aa72"; 
let web3;
let contract; 

export async function initWeb3(){
  if (window.ethereum) {
    web3 = new Web3(window.ethereum);
    await window.ethereum.request({ method: "eth_requestAccounts" });
    contract = new web3.eth.Contract(CrowdfundingABI.abi, CONTRACT_ADDRESS);
  } else {
    alert("MetaMask not detected! Please Install MetaMask"); 
  }
}

export function getWeb3(){
  return web3;
}
export function getContract(){
  if(!contract) throw new Error("Contract is not initialized, Call initWeb3 first. ");
  return contract;
}
