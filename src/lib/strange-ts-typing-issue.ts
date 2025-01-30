import {
  createSolanaRpcFromTransport,
  RpcFromTransport,
  SolanaRpcApiFromTransport,
  RpcTransport,
} from "@solana/web3.js";

const sayHello = () => {
  return "Hello";
};

interface SomeInterface {
  // This uses ReturnType, and has 'string' for a type. Great!
  hasAType: ReturnType<typeof sayHello>;
  // This also uses ReturnType, but has 'any' for a type. Why?
  // RpcFromTransport<SolanaRpcApiFromTransport<RpcTransport>, RpcTransport>; works though
  hasAnyType: ReturnType<typeof createSolanaRpcFromTransport>;
}
