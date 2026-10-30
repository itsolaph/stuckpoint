// End-to-end smoke of the headline demo against a running dev server:
// load The Darkroom, playtest (STUCK + pin + chain), move the UV flashlight
// out of the safe, playtest again (ESCAPED). Uses the framework's loopback
// dev sign-in and the same actions the UI and the agent call.
//
//   pnpm dev --port 4313   (in another terminal)
//   node scripts/smoke-darkroom.mjs http://localhost:4313

const base = process.argv[2] ?? "http://localhost:4313";
let cookie = "";

async function signIn() {
  const res = await fetch(`${base}/_agent-native/auth/local-dev`, {
    method: "POST",
    headers: { Origin: base },
  });
  if (!res.ok) throw new Error(`local dev sign-in failed: ${res.status}`);
  cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function act(name, args = {}, method = "POST") {
  const url = `${base}/_agent-native/actions/${name}`;
  const res =
    method === "GET"
      ? await fetch(`${url}?${new URLSearchParams(args)}`, { headers: { cookie } })
      : await fetch(url, {
          method: "POST",
          headers: { cookie, "content-type": "application/json", Origin: base },
          body: JSON.stringify(args),
        });
  const body = await res.json();
  if (!res.ok) throw new Error(`${name} -> ${res.status} ${JSON.stringify(body)}`);
  return body;
}

function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) process.exitCode = 1;
}

await signIn();
const home = await fetch(`${base}/home`, { headers: { cookie } });
check("GET /home returns 200", home.status === 200, String(home.status));

const sample = await act("load-sample-room", { sample: "darkroom" });
const room = await act("get-room", { id: sample.id }, "GET");
check("darkroom loaded with 7 nodes", room.nodes.length === 7, String(room.nodes.length));

const first = await act("run-playtest", { roomId: sample.id });
check("first playtest is STUCK", first.verdict === "stuck", first.verdict);
const flashlight = room.nodes.find((n) => n.name === "UV flashlight");
const pins = first.result.pinNodeIds;
check("flashlight is red-pinned", pins.includes(flashlight.id));
const chain = first.result.stuckAnalysis[0].chains[0];
check("chain names a requirement cycle", Boolean(chain.cycle), chain.text);
console.log(`      ${first.summary}`);

const afterRun = await act("get-room", { id: sample.id }, "GET");
check("verdict persisted and fresh", afterRun.playthrough?.verdict === "stuck" && !afterRun.playthrough.stale);

await act("update-node", { roomId: sample.id, id: flashlight.id, containerId: null });
const stale = await act("get-room", { id: sample.id }, "GET");
check("playtest goes stale after the fix", stale.playthrough?.stale === true);

const second = await act("run-playtest", { roomId: sample.id });
check("replay after moving the flashlight is ESCAPED", second.verdict === "escaped", second.summary);

const sheet = await act("save-gm-sheet", { roomId: sample.id });
check("GM sheet generated", sheet.markdown.includes("## Walkthrough"));

await act("delete-room", { id: sample.id });
console.log(process.exitCode ? "SMOKE FAILED" : "SMOKE OK");
