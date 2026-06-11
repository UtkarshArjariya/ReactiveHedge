// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title HookMiner
/// @notice Brute-forces a CREATE2 salt so the resulting hook address encodes the
///         desired Uniswap v4 hook flags in its low 14 bits (CLAUDE.md rule #1).
/// @dev Vendored locally (the latest v4-periphery moved HookMiner to test/shared).
///      Used by DeployHook.s.sol and the hook tests.
library HookMiner {
    /// @notice Mask of the 14 hook-permission flag bits.
    uint160 internal constant FLAG_MASK = uint160(0x3FFF);

    /// @notice Upper bound on salts to try before giving up.
    uint256 internal constant MAX_LOOP = 160_444;

    /// @notice Find a salt that produces a hook address with exactly `flags` set.
    /// @param deployer The CREATE2 deployer (e.g. the canonical 0x4e59… factory).
    /// @param flags The desired hook flags (low 14 bits).
    /// @param creationCode The hook's creation bytecode (`type(Hook).creationCode`).
    /// @param constructorArgs ABI-encoded constructor args appended to the bytecode.
    /// @return hookAddress The mined address whose low bits equal `flags`.
    /// @return salt The CREATE2 salt producing `hookAddress`.
    function find(address deployer, uint160 flags, bytes memory creationCode, bytes memory constructorArgs)
        internal
        view
        returns (address hookAddress, bytes32 salt)
    {
        bytes memory initCode = abi.encodePacked(creationCode, constructorArgs);
        bytes32 initCodeHash = keccak256(initCode);
        for (uint256 i; i < MAX_LOOP; ++i) {
            hookAddress = computeAddress(deployer, i, initCodeHash);
            if (uint160(hookAddress) & FLAG_MASK == flags && hookAddress.code.length == 0) {
                return (hookAddress, bytes32(i));
            }
        }
        revert("HookMiner: could not find salt");
    }

    /// @notice CREATE2 address for a given deployer, salt, and init-code hash.
    function computeAddress(address deployer, uint256 salt, bytes32 initCodeHash)
        internal
        pure
        returns (address)
    {
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xFF), deployer, salt, initCodeHash))))
        );
    }
}
