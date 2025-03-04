import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../.dfx/local/canisters/rwa/service.did.js";

const agent = new HttpAgent({
  host: process.env.VITE_BACKEND_HOST || "http://localhost:4943"
});

if (window.location.hostname === "localhost") {
  agent.fetchRootKey().catch(err => {
    console.warn("Unable to fetch root key. Check if local replica is running.");
    console.error(err);
  });
}

const RWA_CANISTER_ID = process.env.VITE_RWA_CANISTER_ID;

const backend = Actor.createActor(idlFactory, {
  agent,
  canisterId: RWA_CANISTER_ID,
});

export default backend; // ✅ Pastikan ini ada
