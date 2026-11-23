// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title TrustScoreOracle
/// @notice Auditable on-chain checkpoint of merchant trust scores. The score is
/// computed off-chain by an open, deterministic formula over on-chain
/// PaymentRecorded events (apps/indexer/src/trust). Each checkpoint commits to an
/// `inputsHash`: the keccak256 of the canonical score inputs, so anyone can
/// rebuild the inputs from chain data, hash them, and check the published score.
contract TrustScoreOracle is AccessControl {
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");
    uint256 public constant MAX_SCORE = 1000;

    struct ScoreCheckpoint {
        uint256 score;
        uint32 periodId;
        uint64 publishedAt;
        bytes32 inputsHash;
    }

    mapping(address => ScoreCheckpoint) public latestScore;

    event ScorePublished(
        address indexed merchant, uint256 score, uint32 periodId, uint64 publishedAt, bytes32 inputsHash
    );

    error ScoreExceedsMax();
    error StalePeriod();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPDATER_ROLE, admin);
    }

    function publishScore(address merchant, uint256 score, uint32 periodId, bytes32 inputsHash)
        external
        onlyRole(UPDATER_ROLE)
    {
        if (score > MAX_SCORE) revert ScoreExceedsMax();
        ScoreCheckpoint storage prev = latestScore[merchant];
        if (prev.publishedAt != 0 && periodId <= prev.periodId) revert StalePeriod();

        latestScore[merchant] = ScoreCheckpoint({
            score: score,
            periodId: periodId,
            publishedAt: uint64(block.timestamp),
            inputsHash: inputsHash
        });

        emit ScorePublished(merchant, score, periodId, uint64(block.timestamp), inputsHash);
    }

    function getScore(address merchant) external view returns (uint256) {
        return latestScore[merchant].score;
    }
}
