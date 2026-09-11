import { writeFileSync } from "node:fs";
import { civicSeed, repairLots, seedAgents, worksToBuildings } from "../src/game/works";
import { proofBody } from "../src/game/proof";

const now = Date.now();
const civic = civicSeed(now);
const occupied = new Set(civic.map((b) => `${b.gx},${b.gz}`));
const works = worksToBuildings(now, occupied);
const body = proofBody(repairLots([...civic, ...works]), seedAgents());
const out = process.argv[2] || "/tmp/city-proof.json";
writeFileSync(out, body);
console.log(`wrote ${out} (${body.length} bytes)`);
