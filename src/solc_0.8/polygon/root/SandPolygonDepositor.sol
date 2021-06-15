//SPDX-License-Identifier: MIT
// solhint-disable-next-line compiler-version
pragma solidity 0.8.2;
import "../../common/interfaces/IERC20Extended.sol";
import "./IRootChainManager.sol";

contract SandPolygonDepositor {
    IERC20Extended internal immutable _sand;
    address internal immutable _predicate;
    IRootChainManager internal immutable _rootChainManager;

    constructor(
        IERC20Extended sand,
        address predicate,
        IRootChainManager rootChainManager
    ) public {
        _sand = sand;
        _predicate = predicate;
        _rootChainManager = rootChainManager;
    }

    function depositToPolygon(address beneficiary, uint256 amount) public {
        _sand.transferFrom(beneficiary, address(this), amount);
        _sand.approve(_predicate, amount);
        _rootChainManager.depositFor(beneficiary, address(_sand), abi.encode(amount));
    }
}
