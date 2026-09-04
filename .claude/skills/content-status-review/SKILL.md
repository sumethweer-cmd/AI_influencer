---
name: content-status-review
description: Score the current state of an AI-influencer's content operation across 8 dimensions (hook/retention, platform distribution health, shareability, cross-platform technical hygiene, follower momentum, posting cadence, format portfolio breadth, experiment discipline), find the "shape" of strengths/weaknesses, and produce a prioritized action plan for the next 1-2 weeks. Use when the user asks "where do we stand," "what should we do next," "evaluate our progress," "ประเมิน current status," "วางแผนต่อ," or wants a status check + adjusted plan rather than a single piece of content or a single metric question.
metadata:
  origin: adapted from coreyhaines31/marketingskills' marketing-plan skill's current-state-rubric methodology, retargeted from SaaS/D2C dimensions to single-creator short-form video content ops
  version: 1.0.0
---

# Content Status Review

Score the operation, find the shape, write the plan. Don't skip straight to
recommendations without scoring — the score is what tells you which
recommendation is actually the highest-leverage one right now.

## When to Activate

- "ตอนนี้เราอยู่ตรงไหน" / "where do we stand"
- "จะทำยังไงต่อดี" / "what should we do next"
- weekly or bi-weekly check-ins on an ongoing content operation
- after a batch of content has been posted and has enough data to read
- before committing to next week's content plan

## Inputs Needed

Before scoring, pull:
- Posted content items with `platform_metrics` (views/likes/comments/shares/retention per platform) from the pipeline database
- Any `follow_up_notes` already logged
- Any analytics screenshots attached (traffic source breakdown, e.g. TikTok "For You"/"Following" split or FB "Suggested For You"/"Your Page")
- Current follower counts if available
- Posting cadence over the review window (how many items/day, which days)

If any of these are missing, say so explicitly in the audit rather than guessing — a dimension scored on thin data should say "low confidence" next to its score.

## The 8-Dimension Rubric (score 0-5 each)

### 1. Hook & Retention Quality
**What's scored:** How strong the first 1-3 seconds are, and whether retention/watch-through holds across formats already tried.
- 0 = No retention data at all
- 2 = Retention data exists but is inconsistent/low across most formats (<20%)
- 4 = At least one format consistently clears 40%+ retention
- 5 = Best format clears 60%+ retention repeatably (not a one-off)

### 2. Platform Distribution Health
**What's scored:** Whether content is actually escaping the initial algorithmic test pool on each platform (TikTok: view count beyond the account's baseline ceiling; FB: "Suggested For You" appearing as a traffic source, not just "Your Page").
- 0 = Every post capped at the platform's minimum test-pool size
- 2 = Rare breakout (1 post in many)
- 4 = Breakouts happening semi-regularly, tied to identifiable content traits
- 5 = Majority of posts break out; distribution is no longer the bottleneck

### 3. Shareability Design
**What's scored:** Whether content is intentionally built with a reason to share (tag-a-friend hooks, relatable/prank premises, quotable lines) vs. content that's only good to watch alone.
- 0 = No content designed around sharing
- 2 = Occasional shareable premise, not deliberate
- 4 = Most new content has an explicit share-trigger built into the hook or caption
- 5 = Share rate is tracked and used to steer format choice

### 4. Cross-Platform Technical Hygiene
**What's scored:** Whether platform-specific technical requirements are being met — native upload per platform (no cross-post watermark), burned-in captions, correct aspect ratio, trending audio usage where relevant.
- 0 = Unknown / never checked
- 2 = Some known issues (e.g. watermarked cross-posts) not yet fixed
- 4 = Known issues fixed; native uploads per platform
- 5 = Actively verified each post, audio/caption choices intentional per platform

### 5. Follower Growth Momentum
**What's scored:** Whether net followers are moving, and whether there's a deliberate lever being pulled for it (not just "post and hope").
- 0 = Net followers flat/zero, no growth lever in place
- 2 = Flat, but a lever has been identified and not yet tried
- 4 = A lever is actively being tried, too early to call
- 5 = Followers visibly growing, tied to an identified cause

### 6. Posting Cadence & Consistency
**What's scored:** Whether posting happens on a predictable rhythm the audience (and algorithm) can learn.
- 0 = Sporadic, no pattern
- 2 = Roughly daily but inconsistent timing/platform mix
- 4 = Consistent daily cadence, deliberate platform split
- 5 = Consistent cadence + deliberate timing based on data (not just habit)

### 7. Format Portfolio Breadth
**What's scored:** How many distinct formats have been tried with enough reps to judge, vs. how much is still unknown.
- 0 = 1 format, few reps
- 2 = 2-3 formats tried, not enough reps on most to compare fairly
- 4 = Several formats with enough reps each to rank them with some confidence
- 5 = Clear ranked understanding of format performance, portfolio deliberately diversified around winners

### 8. Experiment Discipline
**What's scored:** Whether changes are being tested as isolated, documented hypotheses (see `ab-testing` skill) vs. changing multiple things at once and guessing why something worked.
- 0 = No hypothesis tracking at all
- 2 = Informal notes, no structure
- 4 = Hypotheses documented before testing, results logged
- 5 = Running experiment playbook (ICE-scored backlog, documented pattern library)

## Computing the Shape

Total = sum of all 8 scores, out of 40.

Write a 2-4 sentence shape interpretation: name where strength and weakness
cluster, and let that shape — not a generic checklist — decide what goes
into the plan. A team strong on (1) Hook/Retention but weak on (2)
Distribution and (4) Technical Hygiene has a completely different next step
than a team weak on (1) itself.

## Common Shapes (content ops version)

**"Good hooks, capped distribution"** — High: #1, #7. Low: #2, #4.
Translation: the content itself works; something mechanical (account
maturity, technical hygiene, or platform-specific signal like shares) is
capping reach. Plan should prioritize #2/#4 fixes over making more content.

**"Reach exists, no repeat visitors"** — High: #2, #6. Low: #5, #8.
Translation: people are seeing it but not returning/following. Plan should
prioritize explicit follow-triggers and format consistency (series) over
volume.

**"Everything ad-hoc"** — Low across #6, #8, moderate elsewhere.
Translation: individual pieces of content are fine but there's no system.
Plan should prioritize cadence + experiment structure before anything else,
since without it future audits can't tell what's actually working.

## Output: The Plan

After the scored table + shape paragraph, produce:

1. **Top 2-3 priorities for the next 1-2 weeks**, ranked by where the shape
   says the biggest gap is — not by what's easiest or most fun to build.
2. **One explicit hypothesis per priority**, in the `ab-testing` skill's
   format (`Because [observation], we believe [change] will cause [outcome]
   for [audience]. We'll know this is true when [metric].`)
3. **What to check at the next review** — the specific numbers/screenshots
   needed to re-score the dimensions that changed.
4. Note any current platform trends (fetched fresh, not from training data
   — algorithms change fast) that are directly relevant to the identified
   gaps, and flag which are worth testing vs. which don't fit the brand/format.

## Related Skills

- `ab-testing` — for formalizing each plan priority as a tracked experiment
- `content-request` / `content-calendar` — for producing the actual content once priorities are set
