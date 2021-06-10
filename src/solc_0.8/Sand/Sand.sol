// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "./erc20/ERC20ExecuteExtension.sol";
import "./erc20/ERC20BaseToken.sol";
import "./erc20/ERC20BasicApproveExtension.sol";

/*ERC20ExecuteExtension,*/
/*ERC20BasicApproveExtension,*/
contract Sand is ERC20BaseToken {
    constructor(
        address sandAdmin,
        address executionAdmin,
        address beneficiary
    ) public {
        _admin = sandAdmin;
        _executionAdmin = executionAdmin;
        _mint(beneficiary, 3000000000000000000000000000);
    }

    /// @notice A descriptive name for the tokens
    /// @return name of the tokens
    function name() public view returns (string memory) {
        return "SAND";
    }

    /// @notice An abbreviated name for the tokens
    /// @return symbol of the tokens
    function symbol() public view returns (string memory) {
        return "SAND";
    }

    /*function _addAllowanceIfNeeded(
        address owner,
        address spender,
        uint256 amountNeeded
    ) internal override(ERC20BasicApproveExtension, ERC20BaseToken);*/
}
