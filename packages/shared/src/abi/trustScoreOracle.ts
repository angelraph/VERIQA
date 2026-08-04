import { parseAbi } from "viem";

export const trustScoreOracleAbi = parseAbi([
  "function publishScore(address merchant, uint256 score, uint32 periodId)",
  "function getScore(address merchant) view returns (uint256)",
  "function latestScore(address) view returns (uint256, uint32, uint64)",
  "event ScorePublished(address indexed merchant, uint256 score, uint32 periodId, uint64 publishedAt)",
]);
