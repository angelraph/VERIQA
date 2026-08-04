// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title TrustScoreOracle
/// @notice Auditable on-chain checkpoint of merchant trust scores. Score
/// computation runs off-chain against PaymentRecorded history (open-source,
/// deterministic — see apps/indexer); this contract only records the published
/// result behind a trusted-updater role, so the full history of a merchant's
/// score is tamper-evident even though the arithmetic itself runs off-chain.
contract TrustScoreOracle is AccessControl {
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");
    uint256 public constant MAX_SCORE = 1000;

    struct ScoreCheckpoint {
        uint256 score;
        uint32 periodId;
        uint64 publishedAt;
    }

    mapping(address => ScoreCheckpoint) public latestScore;

    event ScorePublished(address indexed merchant, uint256 score, uint32 periodId, uint64 publishedAt);

    error ScoreExceedsMax();
    error StalePeriod();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPDATER_ROLE, admin);
    }

    function publishScore(address merchant, uint256 score, uint32 periodId) external onlyRole(UPDATER_ROLE) {
        if (score > MAX_SCORE) revert ScoreExceedsMax();
        if (periodId <= latestScore[merchant].periodId && latestScore[merchant].publishedAt != 0) revert StalePeriod();

        latestScore[merchant] = ScoreCheckpoint({
            score: score,
            periodId: periodId,
            publishedAt: uint64(block.timestamp)
        });

        emit ScorePublished(merchant, score, periodId, uint64(block.timestamp));
    }

    function getScore(address merchant) external view returns (uint256) {
        return latestScore[merchant].score;
    }
}
