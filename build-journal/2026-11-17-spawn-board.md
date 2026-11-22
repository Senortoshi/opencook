# 2026-11-17: Spawn board brainstorm and the new BSV developer docs

**Who:** an OpenCook contributor plus Claude (AI pair). **Status:** brainstorm only. Nothing merged, nothing on-chain changed.

## What we set out to do
Let people build *together* on OpenCook: an idea becomes a board, others contribute to it, and the people who actually moved it forward get paid when a builder ships it.

## How we worked
1. Read the repo's law first (CLAUDE.md, DECISIONS.md, FAIRNESS.md, ROADMAP.md, FUTURE.md) and the money/on-chain code, read-only.
2. Wrote a plan before any code, including every point where the goal **conflicts** with settled decisions, said out loud rather than buried.
3. Built one small, safe piece (a GitHub repo reader, off-chain and display-only) and sent it to an **independent auditor**. Verdict: *mergeable after fixes* (two medium findings). It stays parked until those are fixed.
4. Stopped building and switched to brainstorming when the shape of the idea changed.

## The big finding
A project tag written **inside the post text** (for example `OCfroggy add a hat`) needs **no new on-chain format**. Post text is already signed by its author and written on-chain, so a filed idea is already permanent and provable, and anyone can rebuild the board from chain data alone. An earlier design needed a new on-chain field and the owner's sign-off; this one doesn't.

## The shape we sketched
- **Board:** a founding idea at the top, contributions underneath, and a contributor list beside it showing who would be paid.
- **Contributions:** suggestions, plus code. A builder marks one "shipped" by linking the commit.
- **Payout principle (decided by the contributor):** the **original author always gets paid**, and so does **every participant** who contributed. Nobody who helped is left out.
- **The split itself is temporary.** Until the Fairness Agent exists, the split is set by hand and posted openly. A simple weighting (merged code > shipped suggestion > open suggestion) is a placeholder, not the final rule. Payouts stay **manual** and get agreed with the repo owner, because they decide who gets paid.
- **Nothing is lost: "early", not "failed".** An idea that was tried and didn't land stays on the board, marked *early*, with what was learned, so nobody repeats the same mistake and anyone can pick it back up later. Trying first counts as a contribution. The culture is to *want* to be proven wrong.
- **First spawn: therealbitcoin.fun.** It's the showcase board. The OpenCook front page (feed + bootboard) stays exactly as it is today, posts look the same, and boot is the only button (no likes).
- **Forking:** any board or idea can be forked into a new one. The fork's first post names its parent in its own signed text (e.g. `OCfrogrun fork of OCfroggy`), so the family tree is on-chain. The project list records the parent too, so a fork can't drop its credit and still get listed.
- **Originators always get paid:** when a fork is paid, the person who had the **original idea** gets an origin share, even if they built nothing on the fork. Every recipient gets their own output in the same transaction (no custody, no treasury). Shares shrink each generation, so it stops after 2–3. This brings in the cross-project idea from FUTURE.md (AFP), which an earlier brief had ruled out of scope. It's now in, by the contributor's decision.
- **Ask AI:** keep the free OpenCook guide, and add specialist agents from bOpen.ai that the user pays for **per question in BSV** (HTTP 402 micropayments), so the platform covers no AI cost.

## What the new BSV developer docs changed (bsvblockchain.com/docs)
- **`@bsv/402-pay`** (beta): charge per HTTP request in sats. This fits the paid Ask AI.
- **Overlays** (`tm_` topic + `ls_` lookup): index a board's posts so anyone can verify the tally without trusting our database.
- **BRC-42 linked keys:** a fresh, unlinkable identity per idea that can still be proven yours later.
- **Tipping sample:** the user's wallet signs, and a relay with no key broadcasts. This is the pattern for "builder pays a board".
- **Heads-up:** the docs say ARC is superseded by **BSV Broadcaster**. OpenCook broadcasts through ARC today, so this is a docket item for the owner.

## Open questions
- Forks: does the origin share go only to the original author or also to the parent's contributors, how many generations, and what placeholder percentage?
- Temporary split: how big is the author's share, and how is the rest weighted among all participants until the Fairness Agent takes over?
- Does bOpen host paid agent endpoints (users pay them directly), or does OpenCook run the agents?
- 402-pay expects a BRC-100 wallet, while OpenCook users have a simpler built-in key. This needs a bridge spike.
- Tag edge cases: `OC-froggy`, a trailing dot, unsigned posts counting as people.

## Parked
- GitHub reader (piece A): audited, two fixes owed, uncommitted on a feature branch.
- Claim-a-GitHub-repo spawn and on-chain "cooked" records: formats drafted, waiting on the owner.
