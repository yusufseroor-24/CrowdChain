import Web3 from "web3";
import CrowdfundingABI from "./artifacts/Crowdfunding.json";
//import Web3 from "https://cdn.jsdelivr.net/npm/web3@1.8.2/dist/web3.min.js";

const CONTRACT_ADDRESS = "0x7487dd04c563B756a759C46BC5178BFAfe82742e"; //Address of the deployed smart contract 
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
