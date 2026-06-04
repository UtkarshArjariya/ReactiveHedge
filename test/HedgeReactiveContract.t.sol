// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {HedgeReactiveContract} from "../src/reactive/HedgeReactiveContract.sol";
import {IReactive} from "reactive-lib/src/interfaces/IReactive.sol";

/// @notice Unit tests for the RSC react() path using hand-rolled LogRecords.
/// @dev In a Foundry test there is no system contract at 0x…fffFfF, so
///      AbstractReactive detects `vm == true`: the constructor's if(!vm)
///      subscribe is skipped and react()'s vmOnly guard passes — exactly the
///      ReactVM execution context we want to exercise.
contract HedgeReactiveContractTest is Test {
    /// @dev Mirror of IReactive.Callback so we can vm.expectEmit it.
    event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload);

    HedgeReactiveContract internal rsc;

    uint256 internal constant ORIGIN_CHAIN = 1301; // Unichain Sepolia
    uint256 internal constant DEST_CHAIN = 84532; // Base Sepolia
    uint64 internal constant GAS = 250_000;
    uint256 internal constant THRESHOLD = 50;

    address internal hook = makeAddr("hook");
    address internal executor = makeAddr("executor");

    function setUp() public {
        rsc = new HedgeReactiveContract(ORIGIN_CHAIN, hook, DEST_CHAIN, executor, GAS, THRESHOLD);
    }

    function test_Config() public view {
        assertEq(rsc.originChainId(), ORIGIN_CHAIN);
        assertEq(rsc.destinationChainId(), DEST_CHAIN);
        assertEq(rsc.hook(), hook);
        assertEq(rsc.executor(), executor);
        assertEq(rsc.callbackGasLimit(), GAS);
        assertEq(rsc.driftThreshold(), THRESHOLD);
    }

    function test_React_EmitsCallbackToExecutor() public {
        bytes32 poolId = keccak256("ETH/USDC");
        IReactive.LogRecord memory log = _swapObservedLog(poolId);

        bytes memory expectedPayload = abi.encodeWithSignature(
            "onReactiveRebalance(address,bytes32,int256)", address(0), poolId, int256(1e18)
        );

        vm.expectEmit(true, true, true, true);
        emit Callback(DEST_CHAIN, executor, GAS, expectedPayload);

        rsc.react(log);
    }

    function test_RevertWhen_ReactCalledOutsideVm() public {
        // Etch code at the system-contract address so detectVm() flips vm=false.
        // A fresh instance then refuses react() with the vmOnly guard.
        vm.etch(0x0000000000000000000000000000000000fffFfF, hex"00");
        HedgeReactiveContract rnInstance =
            new HedgeReactiveContract(ORIGIN_CHAIN, hook, DEST_CHAIN, executor, GAS, THRESHOLD);
        vm.expectRevert(bytes("VM only"));
        rnInstance.react(_swapObservedLog(keccak256("x")));
    }

    function _swapObservedLog(bytes32 poolId) internal view returns (IReactive.LogRecord memory log) {
        log = IReactive.LogRecord({
            chain_id: ORIGIN_CHAIN,
            _contract: hook,
            topic_0: uint256(keccak256("SwapObserved(bytes32,int256,int256,uint160)")),
            topic_1: uint256(poolId),
            topic_2: 0,
            topic_3: 0,
            data: abi.encode(int256(1_000e18), int256(-2_000e18), uint160(1 << 96)),
            block_number: 1,
            op_code: 0,
            block_hash: 0,
            tx_hash: 0,
            log_index: 0
        });
    }
}
