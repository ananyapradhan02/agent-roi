# agent roi

A one-page calculator that tells a buyer whether an AI agent purchase pays for itself. Put in what the work costs today and what the agent will cost; get monthly savings, payback, a justify / marginal / kill verdict, a sensitivity table, and a markdown memo you can paste into the approval thread.

## who it is for

Ops leads and CFOs at companies being pitched AI agents (support, IT helpdesk, back-office processing) who need to say yes or no with numbers, not a vendor's slide.

## hypothesis

A buyer can justify or kill an agent purchase in ten minutes with it.

## how to open it

- live: https://ananyapradhan02.github.io/agent-roi/
- local: download or clone the repo and open `index.html` in a browser (`file://`). No build, no server, no sign-in.

Everything runs in the browser. The scenario lives in the page's url after the `#`, so a link reopens it exactly; your last inputs are also saved in this browser's localStorage. Nothing is sent to a server (the part after `#` never leaves the browser). There is no AI in this tool; every number comes from the formulas shown on the page.

## what it does (v0.2)

- inputs: monthly task volume, current handle time, loaded cost per hour, automation rate, escalation handle time, pricing model (token-based: tokens per run × price per million plus a per-run overhead; or per resolution), monthly platform fee, one-time implementation
- currency: usd or inr
- three presets with illustrative round numbers, not vendor quotes: one lands on justify, one on marginal, one on kill. every number in the presets is illustrative; replace them with your own
- outputs: human cost before and after, agent cost, net monthly savings, payback in months, first-year net, and a verdict stamp
- verdict thresholds: justify = saves money and pays back in 6 months or less; marginal = saves money, payback 6 to 18 months; kill = loses money monthly or payback over 18 months
- sensitivity table: automation rate (±10 and ±20 points) against agent cost multipliers (×0.5 to ×2)
- copy memo: a clean markdown memo to the clipboard, with a select-and-copy fallback where the clipboard is blocked. the memo carries a link that reopens the scenario
- copy share link: every input goes into the url hash with short keys (for example `#s=support-token&c=usd&m=tok&v=20000&a=50...`), updated as you type. opening the link restores the exact scenario. precedence on load: link, then this browser's last scenario, then the first preset. bad or out-of-range values are clamped or fall back to the preset's value; a link that cannot be read at all says so and opens your last scenario. from `file://` the share link points at the live url
- sensitivity table fits a phone screen without sideways scrolling
- formulas visible on the page

## test script (for one real buyer, ten minutes)

Sit with an ops lead or finance person who has been pitched an agent recently. Ask them to use their own numbers, then:

1. "Without my help, get to a verdict for the agent you were pitched. What does it say, and do you believe it?" (Time it. Note which input they could not fill.)
2. "Look at the sensitivity table. At what automation rate or price does this flip to a kill?" (Do they find the break-even without explanation?)
3. "Copy the share link and send it to the person who signs off. When they open it, do they see the same verdict, and what do they change first?"

## status

v0.2 · 30.09.26
