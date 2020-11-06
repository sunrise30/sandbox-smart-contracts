//SPDX-License-Identifier: MIT
pragma solidity 0.7.1;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./AssetAttributesRegistry.sol";
import "./GemsAndCatalysts.sol";
import "../common/Interfaces/ERC20Extended.sol";
import "../common/Interfaces/AssetToken.sol";
import "../common/BaseWithStorage/WithMetaTransaction.sol";

/// @notice Gateway to upgrade Asset with Catalyst, Gems and Sand
contract AssetUpgrader is WithMetaTransaction {
    using SafeMath for uint256;

    uint256 private constant IS_NFT = 0x0000000000000000000000000000000000000000800000000000000000000000;
    address private constant BURN_ADDRESS = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;

    ERC20Extended internal immutable _sand;
    AssetAttributesRegistry internal immutable _registry;
    AssetToken internal immutable _asset;
    GemsAndCatalysts internal immutable _gemsAndCatalysts;
    uint256 internal immutable _flatFee;
    uint256 internal immutable _perCopyFee;
    address internal immutable _feeRecipient;

    constructor(
        AssetAttributesRegistry registry,
        ERC20Extended sand,
        AssetToken asset,
        GemsAndCatalysts gemsAndCatalysts,
        uint256 flatFee,
        uint256 perCopyFee,
        address feeRecipient
    ) public {
        _registry = registry;
        _sand = sand;
        _asset = asset;
        _gemsAndCatalysts = gemsAndCatalysts;
        _flatFee = flatFee;
        _perCopyFee = perCopyFee;
        _feeRecipient = feeRecipient;
    }

    /// @notice associate a catalyst to a fungible Asset token by extracting it as ERC721 first.
    /// @param from address from which the Asset token belongs to.
    /// @param assetId tokenId of the Asset being extracted.
    /// @param catalystId address of the catalyst token to use and burn.
    /// @param gemIds list of gems to socket into the catalyst (burned).
    /// @param to destination address receiving the extracted and upgraded ERC721 Asset token.
    function extractAndSetCatalyst(
        address from,
        uint256 assetId,
        uint16 catalystId,
        uint16[] calldata gemIds,
        address to
    ) external returns (uint256 tokenId) {
        _checkAuthorization(from, to);
        tokenId = _asset.extractERC721From(from, assetId, from);
        _changeCatalyst(from, tokenId, catalystId, gemIds, to);
    }

    /// @notice associate a new catalyst to a non-fungible Asset token.
    /// @param from address from which the Asset token belongs to.
    /// @param assetId tokenId of the Asset being updated.
    /// @param catalystId address of the catalyst token to use and burn.
    /// @param gemIds list of gems to socket into the catalyst (burned).
    /// @param to destination address receiving the Asset token.
    function changeCatalyst(
        address from,
        uint256 assetId,
        uint16 catalystId,
        uint16[] calldata gemIds,
        address to
    ) external returns (uint256 tokenId) {
        _checkAuthorization(from, to);
        _changeCatalyst(from, assetId, catalystId, gemIds, to);
        return assetId;
    }

    /// @notice add gems to a non-fungible Asset token.
    /// @param from address from which the Asset token belongs to.
    /// @param assetId tokenId of the Asset to which the gems will be added to.
    /// @param gemIds list of gems to socket into the existing catalyst (burned).
    /// @param to destination address receiving the extracted and upgraded ERC721 Asset token.
    function addGems(
        address from,
        uint256 assetId,
        uint16[] calldata gemIds,
        address to
    ) external {
        _checkAuthorization(from, to);
        _addGems(from, assetId, gemIds, to);
    }

    function _chargeSand(address from, uint256 sandFee) internal {
        if (_feeRecipient != address(0) && sandFee != 0) {
            if (_feeRecipient == address(BURN_ADDRESS)) {
                // special address for burn
                _sand.burnFor(from, sandFee);
            } else {
                _sand.transferFrom(from, _feeRecipient, sandFee);
            }
        }
    }

    function _changeCatalyst(
        address from,
        uint256 assetId,
        uint16 catalystId,
        uint16[] memory gemIds,
        address to
    ) internal {
        require(assetId & IS_NFT != 0, "INVALID_NOT_NFT"); // Asset (ERC1155ERC721.sol) ensure NFT will return true here and non-NFT will return false

        _burnCatalyst(from, catalystId);
        _burnGems(from, gemIds);
        // TODO _chargeSand(from, sandUpdateFee);

        _registry.setCatalyst(assetId, catalystId, gemIds);

        _transfer(from, to, assetId);
    }

    function _addGems(
        address from,
        uint256 assetId,
        uint16[] memory gemIds,
        address to
    ) internal {
        require(assetId & IS_NFT != 0, "INVALID_NOT_NFT"); // Asset (ERC1155ERC721.sol) ensure NFT will return true here and non-NFT will return false

        _burnGems(from, gemIds);
        // TODO _chargeSand(from, gemIds.length.mul(_gemAdditionFee));

        _registry.addGems(assetId, gemIds);

        _transfer(from, to, assetId);
    }

    function _transfer(
        address from,
        address to,
        uint256 assetId
    ) internal {
        if (from != to) {
            _asset.safeTransferFrom(from, to, assetId);
        }
    }

    function _checkAuthorization(address from, address to) internal view {
        require(to != address(0), "INVALID_TO_ZERO_ADDRESS");
        if (from != msg.sender) {
            uint256 processorType = _metaTransactionContracts[msg.sender];
            require(processorType != 0, "INVALID SENDER");
            if (processorType == METATX_2771) {
                require(from == _forceMsgSender(), "INVALID_SENDER");
            }
        }
    }

    function _burnGems(address from, uint16[] memory gemIds) internal {
        _gemsAndCatalysts.burnDiferentGems(from, gemIds);
    }

    function _burnCatalyst(address from, uint16 catalystId) internal {
        _gemsAndCatalysts.burnCatalyst(from, catalystId, 1);
    }
}
