// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {HedgeReactiveContract} from "../src/reactive/HedgeReactiveContract.sol";
import {IReactive} from "reactive-lib/src/interfaces/IReactive.sol";

/// @notice Unit tests for the RSC react()/drift path using hand-rolled LogRecords.
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
    uint256 internal constant THRESHOLD = 50; // bps

    address internal hook = makeAddr("hook");
    address internal executor = makeAddr("executor");
    bytes32 internal poolId = keccak256("ETH/USDC");

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

    function test_FirstObservation_SetsBaselineNoFire() public {
        rsc.react(_log(1e9));
        assertEq(rsc.lastSqrtPriceX96(), 1e9, "baseline set");
        assertEq(rsc.cumulativeDrift(), 0, "no drift yet");
        assertEq(rsc.hedgesFired(), 0, "no hedge on baseline");
    }

    function test_SubThresholdDrift_Accumulates_NoFire() public {
        rsc.react(_log(1_000_000_000)); // baseline
        rsc.react(_log(1_002_000_000)); // +20 bps  (< 50)
        assertEq(rsc.cumulativeDrift(), 20, "drift accumulated");
        assertEq(rsc.hedgesFired(), 0, "below threshold => no fire");
    }

    function test_ThresholdCrossed_FiresHedge_AndResets() public {
        rsc.react(_log(1_000_000_000)); // baseline

        // +100 bps move (> 50) => fire. magnitude = 100 * 1e14 = 1e16, price up
        // => short => hedgeDelta = -1e16.
        bytes memory expectedPayload = abi.encodeWithSignature(
            "onReactiveRebalance(address,bytes32,int256)", address(0), poolId, int256(-1e16)
        );
        vm.expectEmit(true, true, true, true);
        emit Callback(DEST_CHAIN, executor, GAS, expectedPayload);

        rsc.react(_log(1_010_000_000)); // +100 bps

        assertEq(rsc.cumulativeDrift(), 0, "accumulator reset after fire");
        assertEq(rsc.hedgesFired(), 1, "one hedge fired");
    }

    function test_PriceDown_FiresLongHedge() public {
        rsc.react(_log(1_000_000_000)); // baseline
        // -100 bps => long => hedgeDelta = +1e16.
        bytes memory expectedPayload = abi.encodeWithSignature(
            "onReactiveRebalance(address,bytes32,int256)", address(0), poolId, int256(1e16)
        );
        vm.expectEmit(true, true, true, true);
        emit Callback(DEST_CHAIN, executor, GAS, expectedPayload);
        rsc.react(_log(990_000_000)); // -100 bps
    }

    function test_RevertWhen_ReactCalledOutsideVm() public {
        // Etch code at the system-contract address so detectVm() flips vm=false.
        vm.etch(0x0000000000000000000000000000000000fffFfF, hex"00");
        HedgeReactiveContract rnInstance =
            new HedgeReactiveContract(ORIGIN_CHAIN, hook, DEST_CHAIN, executor, GAS, THRESHOLD);
        vm.expectRevert(bytes("VM only"));
        rnInstance.react(_log(1e9));
    }

    function _log(uint160 sqrtPriceX96) internal view returns (IReactive.LogRecord memory log) {
        log = IReactive.LogRecord({
            chain_id: ORIGIN_CHAIN,
            _contract: hook,
            topic_0: uint256(keccak256("SwapObserved(bytes32,int256,int256,uint160)")),
            topic_1: uint256(poolId),
            topic_2: 0,
            topic_3: 0,
            data: abi.encode(int256(1_000e18), int256(-2_000e18), sqrtPriceX96),
            block_number: 1,
            op_code: 0,
            block_hash: 0,
            tx_hash: 0,
            log_index: 0
        });
    }
}
