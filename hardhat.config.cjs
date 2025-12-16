require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.9", 
  networks: {
    ganache_crowdchain: {
      url: "http://127.0.0.1:7545", //Ganache GUI RPC
      accounts: ["0xe21279674a353e446dcd1669ab7d5c2513cd12eba30a7cb416a95d9aaf9e3eca"] //private key from ganache
    }
  }
};
