import { run } from "hardhat";
import fs from "node:fs";
import path from "node:path";

/// Verifies every deployed contract on mainnet.qie.digital (Blockscout) using
/// the constructor args recorded by deploy.ts.
async function main() {
  const file = path.resolve(__dirname, "../deployments/qieMainnet.json");
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const args: Record<string, unknown[]> = { VerigaForwarder: [], ...d.constructorArgs };
  for (const [name, address] of Object.entries<string>(d.contracts)) {
    try {
      await run("verify:verify", { address, constructorArguments: args[name] ?? [], contract: `contracts/${name}.sol:${name}` });
      console.log(`verified ${name} ${address}`);
    } catch (e: any) {
      console.log(`${name}: ${e.message?.split("\n")[0]}`);
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
