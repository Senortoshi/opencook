# 2026-11-20: Cooks mock rebuilt as a messenger: phone first, chat order, side menu

**Who:** an OpenCook contributor plus Claude (AI pair). **Status:** mock only. Nothing merged, nothing on-chain changed.

## What prompted it
Review feedback on the first Cooks mock (a desktop-style site: nav links, a search bar, a newest-first feed, cooks in a right rail). The reviewer liked the overall shape and asked for it to work the way people actually use OpenCook: on a phone.

## The feedback, in short
- **Keep the feed in chat order** (oldest at the top, newest at the bottom, like a messenger). Newest-first feeds never get read through; chat order makes you catch up on what was said.
- **New and returning visitors want different things.** A new visitor needs the "what is this" angle. A returning visitor wants to skip it and go straight to what they missed.
- **Phone first.** Anything added at the top or bottom of the screen eats the feed once the keyboard is up. A messenger's header and keyboard proportions are the reference.
- **Put cooks and everything else in a side menu,** each cook with a count of what is new, and a count on the menu button itself so people open it. A new visitor's first notification can be a welcome message from OpenCook.
- **Keep the explainer and the search,** and look at how other feeds "show more".

## How we got there
It took four tries. The second invented its own look and felt off. The third copied the live site and added a menu, which kept the live site's tall header and pinned card. The fourth started from research and from screenshots of the mock at phone size, which the earlier tries never had.

## What the research said
- **Telegram's own numbers** (read from its open-source clients): header 48px, composer 48px, message text 16px, 4px between posts by one person and 7px between people, the sender's name shown once per run, a sticky date pill, a full-width unread bar, a jump-to-newest button carrying the unread count, and 72px chat-list rows with a 22px count badge. Telegram does not fold long messages.
- **The keyboard takes about 346 of 874 points** on a current iPhone (one measured figure, not per-model). That leaves roughly 450 points for everything else, so header plus composer should stay near 100.
- **Hidden menus get used less** (Nielsen Norman Group: 57% of cases against 86% for visible navigation). No study of a count on a menu button was found; badged app icons do get more taps. Only 3 to 7% of people swipe a drawer open, so the button has to carry it.
- **Tutorials do not help** (Nielsen Norman Group: people who read one were slower). A short welcome message with one next step, there when wanted, is the recommended form.
- **Long posts:** X cuts at 280 characters, ChatGPT folds long messages behind "Show more". Usability guidance is to expand in place, make the control an obvious link under the text, and never hide a trivially small remainder.
- **Search:** messengers keep it out of permanent chrome, behind the header or the menu, with a result count and arrows.
- **iOS still does not shrink the page for the keyboard.** The composer has to sit in the page flow, not be pinned with fixed positioning. The live site already does this.
- Not found: Twetch's layout (no archive reachable), and any study comparing chat order with newest-first for catching up.

## What the mock is now
- **Header, 48px:** menu button with the unread total beside it, the feed's name, search, your account.
- **Pinned line, 44px:** the Bootboard on the main feed, the founding idea in a cook. It folds away while you type.
- **Feed:** bubbles in chat order, grouped by person, with a coloured name and avatar once per run. A date pill per day. The post number and an on-chain mark sit in each bubble's corner. Posts in a cook carry its name, and tapping it opens the cook.
- **Boots:** a count chip inside the bubble once a post has any, a quiet boot button beside it until then.
- **Long posts** fold to seven lines with "Show more", expanding in place.
- **Returning visitor:** lands on a bar reading "100 new posts". The jump button shows what is still below.
- **New visitor:** lands on the newest post, with one line under it pointing to the welcome and a 1 on the menu.
- **Composer, 56px:** Ask AI, the text field, voice or send.
- **Side menu:** search across everything, the main feed, the welcome, then cooks as a chat list (last active, latest post, unread count), your account at the bottom.
- **Search in a feed:** the header becomes a search box with "1 of 24" and arrows.
- **Tapping the name** opens the vision on the main feed, or a cook's pitch, people, pay and fork.

## Making it feel real
The bubble version still read as flat and lifeless. A first pass added a wallpaper, gradients and glows; that was the wrong fix, and it came back out. What stayed is behaviour, on flat surfaces with one accent colour:
- The newest three posts are held back and arrive live, each after a typing bubble.
- Each post has a time and a signed, on-chain tick. Holding a post opens a menu (boot, copy, open its cook, view the on-chain record).
- Booting throws boots and bumps the count. Three are free, then a boot costs from your balance, and with no balance it opens the deposit screen.
- **The wallet is back.** It follows the live You panel: all-time earnings with a chart, activity, balance and add funds, save recovery file, passphrase, show recovery key, restore. Deposits stay hidden until the account is saved, as on the live site.
- Posting for the first time shows the permanence notice. A post starting with OC and a cook's name lands in that cook, or starts a new one.
- After you post, a boot arrives on it, the earning shows, and an unsaved account is asked to save.
- Paying a cook takes an amount, shows an example split and a receipt. Forking asks for a name and opens the new cook with the parent named in its first post.

## The look, last pass
The messenger look (bubbles, coloured avatars and names) still read as a generic chat kit. The reviewer's own words were that OpenCook is "over 90 percent" the ChatGPT app, so the surface was redone on that shape and the behaviour above was kept:
- Posts are plain text on near-black. Name and time appear once per run of posts by one person. No bubbles, no avatars. Your own posts sit in one grey bubble on the right.
- The boot sits to the right of each post, grey until booted, as on the live site.
- The header is bare: menu with the unread count, the name, search, your account. The Bootboard is one line of text under it.
- The composer is one pill: a plus (Ask AI, search this feed, start a cook, how it works), the text, voice or send.
- The side menu is a plain list: OpenCook, Welcome, Ask AI, then cooks by name with a count where something is new.
- Greys are neutral. Amber is kept for boots, counts and cook names.

The reviewer then asked for a mix of the two looks. The current mock keeps the plain shell (bare header, one composer pill, flat near-black, neutral greys) and puts the messenger feed back inside it: soft bubbles grouped by person, a small coloured face and name once per run, your own posts in amber, and the two-line chat-list menu.

## Anonymity pass
Two calls from the contributor, both about protecting people who post:
- **No faces.** Avatars and a colour per person suggest who is who and invite people to follow or game personalities. They are gone. A post is just "anon".
- **A fresh address for every post.** Each new post should go out from a new address, so nobody can link one person's posts together. The author keeps one private account that only they see, where everything their posts earn arrives.

In the mock this means: every post carries its own anon id and nothing groups posts by author. Counts are of posts and boots, never of people. A cook's details no longer list who posted. Paying a cook pays each post's address, with the first post (the idea) always paid. Your own posts are marked as yours only on your screen. The wallet says it is private by default.

**This is a proposal, not how the live site works, and it runs into settled decisions the owner would have to reopen:**
- The boot price counts active contributors by key, and free boots are granted per key (DECISIONS, boot pricing and free boots). With a new key per post, neither count means anything unless the server is told which keys belong together.
- Contribution weight uses a square root per contributor, which is what stops one person out-earning others by posting more. Per-post keys turn that into a flat share per post.
- "Rebuild the ledger from the chain alone" (DECISIONS, on-chain reconstructability) holds for posts and boosts, but any per-person rule could no longer be rebuilt from the chain, because the chain would not show who is one person.
- Rate limits on posting are keyed on the signing key.

Two ways it could work, for the owner to choose between:
1. **Nobody can link posts, the server included.** Strongest privacy. Per-person rules (free boots, the square root, the contributor count) have to be replaced with rules per post or per connection.
2. **The public cannot link posts, the server can.** The app proves privately to the server which root key a post belongs to. The existing rules keep working, but privacy then depends on trusting the operator and on that mapping never leaking.

What it does not hide: writing style, timing, and money. If one person later spends coins from several of their post addresses in a single transaction, that transaction links those addresses in public. Paid boots have the same problem, since the booter's funds come from somewhere.

The building block exists in the codebase already: the collectibles address is derived from the identity key with BRC-42 (`src/lib/ord-derivation.ts`). Per-post addresses would use the same derivation with a private counterparty and a counter, and the wallet would add up what all of them hold.

## Rebuilt from the builders, plus the pixel record
The look still was not landing, so we stopped adjusting it and went to the people who built things that lasted. Three research passes: the designers of the original iPhone software, the teams behind Facebook, Instagram, WhatsApp and Telegram, and Twetch plus the craftsmen behind tools everyone copies.

They agree with each other more than expected:
- **The content is the interface.** The chrome carries no colour and no boxes; the posts carry the screen (Ive's "deference"; Instagram's 2016 redesign; Facebook's "blank canvas").
- **Type and spacing do the hierarchy.** One family, two or three sizes, tight inside a post and loose between them (Reichenstein; Apple's guidelines).
- **One accent, and it means something.** Interactive, or yours. Never decoration.
- **Counts stay quiet.** Small, grey, hidden at zero. Earnings are shown privately, in the wallet (Instagram's hidden likes; Twetch showed earnings beside the activity that caused them).
- **Cut what carries no information.** A box around every post, a face for an anonymous author, a subtitle under the logo, entrance animations, tooltips.
- **Motion explains, or it goes.** Under 300ms, and none on things people do a hundred times a day.
- **Twetch's lessons** (its co-founder is the person known as Randy): borrow a familiar shell and put the novelty in the money, show cost as a spam filter, never ask for confirmation per action, and funding the account is the real onboarding wall.

Then the owner added an idea while this was under way: an icon that shows a person's trust, ideas and honesty through its colours, as pixels. That sat against "no faces, just anon" until we saw it could be a record and not a face.

**The pixel record.** Each post carries a 4 by 4 square of pixels: four columns (ideas, backed, steady, voice), each filled in four steps. It shows standing, never a name, and it is the only thing that travels with a post once every post has its own address. Because each column has only four steps, many people share the same pattern.

What the mock is now: plain text rows on black with a hairline between them, no bubbles, no faces, no names. Pixels and a time above each post, the boot to the right (grey until you boot it, count in grey). A bare header with no subtitle. Tapping a post's pixels explains them. The wallet shows yours.

What the pixel record does not solve, and the owner should know:
- **It cannot measure honesty.** It shows a record (what was posted, what others backed, how long). Trust is what a reader infers from that.
- **A rare pattern is a fingerprint.** Four steps per column keeps patterns shared, but the top contributors on a small board will still stand out. The steps may need to be coarser, or capped.
- **Someone has to vouch for it.** If no one can link a person's posts, no one can add up their record either. Either the app proves it privately to the server, or the record has to be built some other way. This is the same fork as the one in the anonymity pass above.
- **It can be gamed** by posting or booting to raise it, the same way any score can.

## Pixels out, anon back
The contributor's call after seeing it: the pixel square is still an avatar. It is gone from the mock, along with the round "YOU" badges. Each post is signed with a one-time `anon_xxxx` again, in grey beside the time; your own posts add a small "you" tag that only you see. The account button is a plain wallet icon. The pixel record stays written up above as the owner's idea, but it is not in the mock.

## Investigation: the path for a fresh address per post
Four lines of research (the codebase's per-person rules, the key mechanics, how other systems keep per-person limits, and the one outside wallet still considered). No code changed.

**Correction to the anonymity pass above.** It said per-post keys would flatten the square-root contribution weight. The code does not work that way: `weights.ts` adds up a weight per post, and the square root applies to the boots on each post. A person's total pool weight is the same whether their posts share a key or not.

**What does break,** all of it operational: the boot price (it counts keys with 3 or more posts, so it would sit at the floor), free boots and post rate limits per key, the earnings view (one address), and the wallet itself (it reads and spends one address, so money on post addresses would be invisible and unspendable).

**Recommended path, for the owner to accept or reject:**
- Keep the built-in account. No outside wallet.
- Derive each post's key from the root key with a counterparty of "self", so only the holder can compute the link. The existing collectibles derivation uses "anyone" and must not be reused: anybody could compute those.
- Recovery needs nothing new in the recovery file: derive keys in order and match them against the public keys already in the feed.
- The server privately knows which posts belong together, stored as a keyed hash, used only for the price count, free boots, rate limits and the owner's earnings lookup. Never in the feed, the payout maths or any on-chain record.

**Why not "nobody can link, the server included":** the server sees the IP address on every post and would see the address set on every balance check, so it could link anyway, while pricing, free boots and rate limits would be lost outright.

**Open problems:**
- Dust. Pool shares would be paid per post, not per person. A share that rounds down to zero is dropped, and tiny outputs cost more to spend than they hold. Someone with many posts could earn less than today.
- Spending several post addresses together links them in public. This hides who posted, not where the money goes.
- The private proof to the server is our own construction and needs review.
- Decisions to reopen: key rotation removed, money surfaces key on one address, revenue rules counted per key, on-chain reconstructability.

**Outside wallet:** the 1Sat wallet's newest connection can derive a key per post, but it does not track plain payments to those addresses, its packages are at 0.1.x, and it is untested inside in-app browsers. Not a replacement for the built-in account.

## Building it on testnet (asked for, not started)
The contributor asked to build this on tBSV. The live code is wired to mainnet in fixed places: the WhatsOnChain address in `src/app/api/balance`, `tx-hex` and `unspent`, in `src/hooks/useBsvPrice.ts` and three times in `src/services/bsv/wallet.ts`, plus mainnet address prefixes in `boot-confirm` and `contribution-list`. A first step that changes no decision is a network setting that defaults to mainnet. Per-post addresses and the pixel record sit behind the two owner decisions above and should not be built before them.

## What's unsure
- This restyles the live site, not just adds to it. Bubbles, avatars and the one-line Bootboard are a proposal the owner has not seen.
- Ask AI moved from under the compose box into it. That saves a row but makes it less visible.
- Per-cook unread counts are faked. The live app tracks last-read for the main feed only.
- Checked in a desktop browser at phone size only. Not on a real phone, and not with a real keyboard up.
- The mock's data has dates but no times, so times of day are spread across each day in order. Every amount, the boot price and the pay split are placeholders. No real money moves.
- The simulated boot on your own post and the replayed live posts are staged to show the flow.

## Still open from the last entry
Fork origin shares, the temporary split, who hosts paid agents, the 402-pay wallet bridge, tag edge cases. The GitHub reader is still parked with two fixes owed.
