require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.9", // match your Crowdfunding.sol
  networks: {
    ganache: {
      url: "http://127.0.0.1:7545", // Ganache GUI RPC
      accounts: ["0x3815183BAD2d2c2fFB8e488ee5A93C9De11587Bf"] // from Ganache accounts
    }
  }
};
