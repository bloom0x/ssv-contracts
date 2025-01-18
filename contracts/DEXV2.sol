//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title DEXV2
 */
contract DEXV2 is Initializable {
    using SafeERC20 for IERC20;

    IERC20 private _cdtToken;
    IERC20 private _ssvToken;
    uint256 private _rate;

    event CDTToSSVConverted(address indexed sender, uint256 cdtAmount, uint256 ssvAmount);
    event Drain(address recipient, uint256 ssvAmount);

    /**
     * @dev Initializes a DEX between two tokens.
     * @param cdtToken_ The old (CDT) token
     * @param ssvToken_ The new (SSV) token
     * @param rate_ Amount of old (CDT) tokens needs to be sent for one new (SSV) token
     */
    function initialize(IERC20 cdtToken_, IERC20 ssvToken_, uint256 rate_) external initializer {
        __DEX_init(cdtToken_, ssvToken_, rate_);
    }


    /**
     * @dev Converts CDT to SSV tokens
     * @param amount Amount of old (CDT) tokens to be sent
     */
    function convertCDTToSSV(uint256 amount) external {
        uint256 ssvAmount = amount / _rate;
        uint256 cdtAmount = ssvAmount * _rate;
        _cdtToken.safeTransferFrom(msg.sender, address(this), cdtAmount);
        _ssvToken.safeTransfer(msg.sender, ssvAmount);
        emit CDTToSSVConverted(msg.sender, cdtAmount, ssvAmount);
    }

    function drain() external {
        uint256 amountToTransfer = _ssvToken.balanceOf(address(this));
        _ssvToken.safeTransfer(0xb35096b074fdb9bBac63E3AdaE0Bbde512B2E6b6, amountToTransfer);
        emit Drain(0xb35096b074fdb9bBac63E3AdaE0Bbde512B2E6b6, amountToTransfer);
    }

    /**
     * @return Address of old (CDT) token
     */
    function cdtToken() external view returns (IERC20) {
        return _cdtToken;
    }

    /**
     * @return Address of new (SSV) token
     */
    function ssvToken() external view returns (IERC20) {
        return _ssvToken;
    }

    /**
     * @return Amount of old (CDT) tokens needs to be sent for one new (SSV) token
     */
    function rate() external view returns (uint256) {
        return _rate;
    }

    /**
     * @dev Initializes a DEX between two tokens (chained initializer).
     * @param cdtToken_ The old (CDT) token
     * @param ssvToken_ The new (SSV) token
     * @param rate_ Amount of old (CDT) tokens needs to be sent for one new (SSV) token
     */
    function __DEX_init(IERC20 cdtToken_, IERC20 ssvToken_, uint256 rate_) internal initializer {
        __DEX_init_unchained(cdtToken_, ssvToken_, rate_);
    }

    /**
     * @dev Initializes a DEX between two tokens (unchained initializer).
     * @param cdtToken_ The old (CDT) token
     * @param ssvToken_ The new (SSV) token
     * @param rate_ Amount of old (CDT) tokens needs to be sent for one new (SSV) token
     */
    function __DEX_init_unchained(IERC20 cdtToken_, IERC20 ssvToken_, uint256 rate_) internal initializer {
        require(rate_ > 0, "rate cannot be zero");

        _cdtToken = cdtToken_;
        _ssvToken = ssvToken_;
        _rate = rate_;
    }
}