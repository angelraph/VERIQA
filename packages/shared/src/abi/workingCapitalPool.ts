import { parseAbi } from "viem";

export const workingCapitalPoolAbi = parseAbi([
  "function seedLiquidity(uint256 amount)",
  "function withdrawLiquidity(uint256 amount)",
  "function updateTrailingVolume(address merchant, uint256 volume)",
  "function setParams(uint256 newMinScoreThreshold, uint256 newAdvanceBps)",
  "function pause()",
  "function unpause()",
  "function maxAdvanceFor(address merchant) view returns (uint256)",
  "function requestAdvance(uint256 amount)",
  "function repay(uint256 amount)",
  "function outstandingAdvance(address) view returns (uint256)",
  "function trailingVolume90d(address) view returns (uint256)",
  "function minScoreThreshold() view returns (uint256)",
  "function advanceBps() view returns (uint256)",
  "event LiquiditySeeded(address indexed from, uint256 amount)",
  "event LiquidityWithdrawn(address indexed to, uint256 amount)",
  "event TrailingVolumeUpdated(address indexed merchant, uint256 volume)",
  "event AdvanceRequested(address indexed merchant, uint256 amount)",
  "event AdvanceRepaid(address indexed merchant, uint256 amount)",
  "event ParamsUpdated(uint256 minScoreThreshold, uint256 advanceBps)",
]);
