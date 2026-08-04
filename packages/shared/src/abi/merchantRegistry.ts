import { parseAbi } from "viem";

export const merchantRegistryAbi = parseAbi([
  "function isMerchant(address wallet) view returns (bool)",
  "function merchants(address) view returns (address, string, bytes32, uint64, bool, bool)",
  "function registerMerchant(string profileURI)",
  "function updateProfile(string profileURI)",
  "function attestQiePassVerified(address wallet, bytes32 attestationHash)",
  "function deactivate()",
  "function reactivate()",
  "event MerchantRegistered(address indexed wallet, string profileURI, uint64 createdAt)",
  "event MerchantProfileUpdated(address indexed wallet, string profileURI)",
  "event MerchantPassVerified(address indexed wallet, bytes32 attestationHash)",
  "event MerchantDeactivated(address indexed wallet)",
  "event MerchantReactivated(address indexed wallet)",
]);
