// Turing content — research posts and docs. Served by /api/research and /api/docs.

const RESEARCH = [
  {
    slug: 'context-is-a-system-not-a-window',
    title: 'Context is a system, not a window',
    category: 'Context',
    date: '14/09/2026',
    excerpt: 'Most chatbots treat context as a size. We treat it as an architecture — layered, ranked, and always aware of what matters right now.',
    body: [
      { t: 'p', x: 'The industry shorthand for "context" is a number. A window of tokens you can stuff before the model forgets. It is a useful number, and it is the wrong mental model. A window describes storage. A conversation is not storage — it is a moving target of what matters, what was decided, and what the person is about to ask.' },
      { t: 'p', x: 'In Turing, context is assembled on every turn, in three layers. The first layer is the working set: the last few exchanges, verbatim, because recency carries the most intent. The second layer is the distilled history: everything before that, compressed into a running summary that is rewritten as the conversation drifts — not appended forever. The third layer is the stable facts: things the user stated as facts about themselves, their project, or their constraints. These survive the whole conversation and are treated differently from opinions and hypotheses.' },
      { t: 'h2', x: 'Why "just make the window bigger" fails' },
      { t: 'p', x: 'A longer window does not produce a better conversation. It produces a different failure mode: the model can see everything and weight nothing. Mid-conversation decisions get diluted by opening small talk. A promise made in turn four competes for attention with turn thirty-one. Bigger windows raise the ceiling; they do nothing for the floor, which is where conversations actually live.' },
      { t: 'p', x: 'So the question we optimize for is not "how much can it see" but "what should it be looking at right now." The assembler decides per turn: keep this verbatim, summarize that, promote that detail to a stable fact, demote that other one to background. It is an editorial decision made many times a second, invisibly.' },
      { t: 'h2', x: 'The test that matters' },
      { t: 'p', x: 'We measure context quality the way an editor would, not the way a benchmark would. Pick a fact or a constraint established early in a long conversation. Ask about it forty turns later. The answer should not just be correct — it should be treated with the same priority as if it had been stated in the previous message. When that holds, the user stops repeating themselves. And when users stop repeating themselves, the system is doing its job.' },
      { t: 'quote', x: 'Memory is not about remembering more. It is about knowing what still counts.' },
      { t: 'p', x: 'This is the layer most users never see, and it is the one they feel most. A chatbot that "gets you" is, under the hood, a context system that stopped treating your words as equal-weight noise.' }
    ]
  },
  {
    slug: 'designing-for-the-second-question',
    title: 'Designing for the second question',
    category: 'Design',
    date: '14/09/2026',
    excerpt: 'First questions are easy. The real product is the follow-up — where ambiguity lives and where most chatbots quietly give up on you.',
    body: [
      { t: 'p', x: 'Every chatbot is judged on its first reply and abandoned on its fifth. The first question is usually broad and forgiving: "explain X." The second question is where conversations become real: "no, but what about the edge case?" "that is not what I meant." "now do it for Y." The second question is a small act of trust. The user is betting that the bot still understands the room.' },
      { t: 'p', x: 'Designing for the second question changes what you build. It means the system must track not just what was asked, but how the user is steering. A correction is not a new prompt — it is an edit to the intent. If someone says "that is not what I meant," the correct behavior is not to answer the new literal sentence, but to recover the underlying goal, acknowledge the miss, and close the gap. Turing is built to treat corrections as first-class events, not as noisy input.' },
      { t: 'h2', x: 'Short sentences are not vague' },
      { t: 'p', x: 'In a live conversation, "shorter" and "just the API part" and "hmm, rethink" are perfectly clear. In a stateless prompt, they are noise. The difference is entirely about whether the system remembers who is talking to whom. We have removed a whole category of failure by refusing to interpret in-conversation shorthand as a standalone request.' },
      { t: 'h2', x: 'The follow-up is the product' },
      { t: 'p', x: 'This is why we design against a metric that sounds trivial and is not: the effort required for the user to get from "almost what I wanted" to "exactly what I wanted." Every point of friction there — re-explaining context, repeating constraints, re-stating tone — is a tax on thinking. The goal is a conversation where the second question costs less to ask than the first, because the bot carries the weight of everything said before it.' },
      { t: 'quote', x: 'A conversation is a sequence of recoveries. The best ones feel like they never happened.' },
      { t: 'p', x: 'If you build a thinking partner and you only make the first message good, you have built a slot machine. The partner lives in the follow-up.' }
    ]
  },
  {
    slug: 'memory-without-confabulation',
    title: 'Memory without confabulation',
    category: 'Memory',
    date: '14/09/2026',
    excerpt: 'A memory that invents details is worse than no memory at all. On retrieval discipline, provenance, and the value of "I don\u2019t remember."',
    body: [
      { t: 'p', x: 'The scariest failure in a memory system is not forgetting. It is remembering wrong — fluently. A confident, detailed, fabricated recollection does not just mislead; it destroys the one asset a thinking partner has: trust. Once a user discovers the system invented a fact they never stated, every subsequent confident answer is discounted, including the correct ones.' },
      { t: 'p', x: 'So the design rule at Turing is unglamorous: never present a retrieval as a memory unless it is a retrieval. The system keeps two kinds of stored material. Verified facts — things the user stated, or things the system observed in its own output — carry provenance: when they were said, in what context. Everything else, including reasonable inferences, is flagged internally as inference and handled differently at answer time.' },
      { t: 'h2', x: '"I don\u2019t remember" is a feature' },
      { t: 'p', x: 'When the evidence is not there, the correct answer is a short, honest non-answer: "I don\u2019t have that from our conversation — do you mean the one from earlier this week?" Confession, phrased well, costs almost nothing and preserves the system\u2019s credibility budget. Fabrication costs everything, silently.' },
      { t: 'p', x: 'This applies to inference too. If the user once said they were building for mobile, and later asks about desktop performance, the system may surface the mobile fact — but as context, clearly attributable ("you mentioned the mobile build earlier"), not as a settled premise. The user keeps the right to correct, and the correction is cheap, because the system is showing its work, not asserting its mind.' },
      { t: 'h2', x: 'The quiet discipline' },
      { t: 'p', x: 'Memory systems compete on what they can recall. We compete on what we refuse to recall as fact. That discipline is invisible in the good case — which is the point. A trustworthy memory is one the user never has to audit. They state something once, trust it was kept, and move on. The system earns the right to be silent about its own mechanics by being right about provenance every time it speaks.' },
      { t: 'quote', x: 'A memory you cannot audit is just a rumor with better confidence.' }
    ]
  },
  {
    slug: 'the-latency-budget',
    title: 'The latency budget',
    category: 'Performance',
    date: '14/09/2026',
    excerpt: 'People do not experience speed as an average. They experience it as the first token, the pauses, and the moments the app feels alive or dead.',
    body: [
      { t: 'p', x: 'A chatbot is judged in the first two seconds. If the first token is late, the user has already mentally categorized the product: slow. The rest of the reply — even if it is fast and excellent — is read through that impression. Latency is not a backend metric. It is the first word of the conversation, before any word is said.' },
      { t: 'p', x: 'So Turing is engineered against a budget, not an average. The budget has three line items that matter to a human: time to first token (the "is it alive" moment), inter-token cadence (the "is it thinking" moment), and total time for a long answer (the "am I being respected" moment). Each has a different fix, and each has a different cost to the user\u2019s attention.' },
      { t: 'h2', x: 'Where the time actually goes' },
      { t: 'p', x: 'In a conversational system, a large share of turn time is not the model. It is the assembly: loading context, retrieving memory, preparing the working set, shaping the output. The model call is the loudest part, but the assembly is the part you control. We treat it like a pipeline with a strict clock: every stage knows its budget, and if a retrieval is going to run long, the first token ships anyway and the retrieval\u2019s result lands mid-answer, folded in where it matters.' },
      { t: 'h2', x: 'Streaming is not a feature' },
      { t: 'p', x: 'Text that appears while you are already reading it changes the entire experience. It converts waiting into reading. It makes the model feel like a person talking, not a machine computing. The cadence of tokens matters: bursty, uneven output reads as confused; steady output reads as thinking. We tune cadence the way a speaker tunes pacing — because that is what it is.' },
      { t: 'p', x: 'And the boring discipline underneath: every request is idempotent, every timeout has a graceful half-answer path, and the client never shows a spinner for more than a heartbeat. Spinners are where trust goes to die.' },
      { t: 'quote', x: 'Speed is not a feature you add. It is the frame around every other feature.' }
    ]
  },
  {
    slug: 'evaluating-reasoning-you-cant-see',
    title: 'Evaluating reasoning you can\u2019t see',
    category: 'Evaluation',
    date: '14/09/2026',
    excerpt: 'You cannot benchmark a conversation the way you benchmark a classifier. On the unglamorous machinery that tells us whether the system is getting better or merely different.',
    body: [
      { t: 'p', x: 'Evaluation is the least romantic part of building a thinking partner, and the most important. A model change can make the system 5% better on reasoning and 10% worse at remembering a user\u2019s name — and the benchmark will not show the second one, because nobody benchmarked names. The hard truth: most regressions live in the places no test covers, because the places no test covers are where users actually talk.' },
      { t: 'p', x: 'Our evaluation stack is three layers deep. The bottom layer is fast and mechanical: a fixed suite of conversation replays that runs on every change, checking the things that must never break — factual consistency within a conversation, no contradictions with stated facts, no fabrication of things the user never said. These are cheap checks that catch expensive failures. The middle layer is sampled human review: real conversations, read by people, scored on the dimensions users actually care about — did it follow the correction, did it keep the thread, was it direct. The top layer is the one we trust most and scale least: the users themselves, whose follow-up behavior is the honest signal. A user who stops restating context is voting with their typing.' },
      { t: 'h2', x: 'Regression is a conversation problem' },
      { t: 'p', x: 'A classic bug breaks one input. A regression in a conversational system breaks a distribution of behaviors — the system answers slightly differently, and the conversation shape changes in ways no unit test sees. That is why the replays are full conversations, not single prompts: the failure we care about is "by turn six, it had quietly dropped the constraint." Single-turn tests are blind to exactly that.' },
      { t: 'quote', x: 'You do not trust a thinking partner because it passed a test. You trust it because it kept its promises across thirty turns.' },
      { t: 'p', x: 'None of this makes evaluation precise. It makes it honest, which is the standard the product itself is held to.' }
    ]
  },
  {
    slug: 'when-silence-is-the-answer',
    title: 'When silence is the answer',
    category: 'Safety',
    date: '14/09/2026',
    excerpt: 'Refusal is a design surface, not a compliance checkbox. On honest uncertainty, and why "I\u2019m not sure" is the most sophisticated answer a system can give.',
    body: [
      { t: 'p', x: 'Every conversational system has a hidden dial: how often it says no, and how it says it. Turn the dial too far one way and you get a sycophant that agrees with anything; too far the other and you get a bureauclict that apologizes its way out of every answer. The correct setting is not a number. It is a judgment about which failures the user can recover from.' },
      { t: 'p', x: 'There are two different failures, and they deserve two different responses. The first is capability failure: the system genuinely does not know, or the evidence is not there. The right answer is a short, clean admission — "I don\u2019t have enough to say this confidently" — plus whatever partial, honest information exists. The second is risk failure: the answer exists, but being wrong would cost the user something they cannot get back. There, the system should say so plainly and suggest the safer path: a human, a source, a slower process. Both responses are forms of silence. Both are features.' },
      { t: 'h2', x: 'Confidence is a claim' },
      { t: 'p', x: 'A fluent answer implies a confidence the system may not have. That is the quiet lie at the center of most chatbots. We have worked to separate the two in the output: when the system is reasoning within its evidence, it answers directly; when it is extrapolating past it, the answer says what kind of answer it is. "Here is what the evidence supports — and here is where I would be guessing." Users react to that more positively than to any amount of hedging, because it treats them as adults.' },
      { t: 'p', x: 'The measure of a good refusal is not that it prevented harm. It is that the user, after being told no, feels the system is on their side. A refusal that sounds like a wall is a bug in the voice, not a feature in the policy.' },
      { t: 'quote', x: 'The most sophisticated answer a system can give is the one that knows when not to answer.' }
    ]
  },
  {
    slug: 'from-tokens-to-clarity',
    title: 'From tokens to clarity',
    category: 'Output',
    date: '14/09/2026',
    excerpt: 'Raw model output is a draft. On the editing pass that turns a correct answer into a direct one — and why "no filler" is an engineering requirement, not a style preference.',
    body: [
      { t: 'p', x: 'There is a gap between "technically correct" and "clear," and most chatbot output lives in the gap. The draft the model produces first is often right and still useless: it hedges, it repeats the question back, it buries the point under a preamble, it ends with an offer to help further that nobody asked for. The user does not want a draft. They want the finished sentence.' },
      { t: 'p', x: 'So every answer in Turing passes through an editing stage before it reaches the screen. The editor is not a second model trying to be polite; it is a set of hard rules about what a finished answer looks like. Lead with the point. Never restate the question. Cut every sentence that could be cut without losing a fact. No "great question." No "I hope this helps." No trailing offers. If the answer is one line, it is one line.' },
      { t: 'h2', x: 'Filler is a cost, not a courtesy' },
      { t: 'p', x: 'Pleasantries in a text interface are not warmth — they are tax. Every "certainly!" the user never typed is a token of attention they must pay to receive the actual content. At conversation speed, that tax compounds. A system that respects the user\u2019s time enough to skip the preamble reads as competent in a way no amount of correct content achieves. The tone of a product is not its vocabulary. It is what it refuses to say.' },
      { t: 'p', x: 'The editing pass also enforces shape: when an answer has structure, the structure should be visible in the first two seconds — a short lead, then the parts. When it does not, the answer is a paragraph, not a list. Formatting is meaning; a wall of text with five facts is a failure of the editor, not of the model.' },
      { t: 'quote', x: 'Clarity is not a style. It is the removal of everything that was never the point.' }
    ]
  },
  {
    slug: 'building-the-boring-parts',
    title: 'Building the boring parts',
    category: 'Systems',
    date: '14/09/2026',
    excerpt: 'The parts of a chatbot nobody writes about — idempotency, retries, graceful degradation — are the parts users feel every day. On why reliability is the product.',
    body: [
      { t: 'p', x: 'A chatbot is, structurally, a conversation. And a conversation is the most unforgiving interface there is: it happens in real time, it carries expectations, and it remembers your failures. When a form submit fails, the user retries. When a message vanishes mid-conversation, the user does not retry — they lose the thread, lose the trust, and leave. The boring parts of the infrastructure are not behind the product. They are the product, experienced as "it just works" or, worse, "it doesn\u2019t."' },
      { t: 'p', x: 'The boring parts, as we built them: every user message is accepted exactly once, no matter how many times the network retries it — a duplicate message is not a new turn, it is the same turn. Every long-running step can be interrupted and resumed without the user re-explaining anything. Every dependency that can be slow has a path where the answer still ships, partially, with the missing piece arriving when it arrives. And every error the user might ever see has been written by a person, in plain language, without a stack trace.' },
      { t: 'h2', x: 'Consistency is a feature' },
      { t: 'p', x: 'The subtlest reliability feature is sameness. The tenth message should feel exactly like the first: same latency shape, same formatting, same voice. Users do not think about consistency until it breaks — a reply that is suddenly terse, or suddenly list-shaped, or suddenly formal reads as a different product. The system is judged by its worst observed turn, and the boring parts are what keep the worst turn close to the average one.' },
      { t: 'p', x: 'None of this makes for a good launch tweet. All of it makes for the reason someone keeps using the thing after the demo ends.' },
      { t: 'quote', x: 'Reliability is not the absence of failure. It is the presence of a plan for every failure, rehearsed until it is invisible.' }
    ]
  }
];

const DOCS = {
  introduction: {
    title: 'Introduction',
    section: 'Getting started',
    body: [
      { t: 'p', x: 'Turing is a conversational AI built around one idea: a thinking partner should behave like a sharp one. It reasons precisely, remembers what matters, and answers without filler. No hype, no noise — just a system you can think with.' },
      { t: 'h2', x: 'What Turing does' },
      { t: 'li', x: 'Converses in long, continuous threads — decisions and constraints from turn one survive to turn forty.' },
      { t: 'li', x: 'Remembers facts you state, and treats them as facts: with provenance, and without inventing anything you never said.' },
      { t: 'li', x: 'Answers directly. The point comes first; the rest follows only if it earns its place.' },
      { t: 'li', x: 'Tells you when it is guessing. Extrapolation is labeled as extrapolation, not dressed up as certainty.' },
      { t: 'h2', x: 'Design principles' },
      { t: 'p', x: 'Three principles drive every decision in the product. Directness: an answer should lead with the point, never with a preamble. Honesty: the system states its own confidence and its own limits instead of implying certainty it does not have. Memory with provenance: what the system remembers is traceable to what you actually said.' },
      { t: 'h2', x: 'What is here' },
      { t: 'li', x: 'The web application — the full conversation experience.' },
      { t: 'li', x: 'A public status page, with 90 days of history.' },
      { t: 'li', x: 'A support channel that a real person reads.' },
      { t: 'p', x: 'The public API is not available yet. There are no API keys, no endpoints, and no reference to misuse — when the API ships, it will be documented here first. See API access for details.' }
    ]
  },
  quickstart: {
    title: 'Quickstart',
    section: 'Getting started',
    body: [
      { t: 'p', x: 'You do not need to learn Turing. It is a conversation, and you already know how to have one. What follows is the shape of a good one, from our observation of the best conversations the product gets.' },
      { t: 'h2', x: 'Start with the real question' },
      { t: 'p', x: 'The system is built for specific, pointed questions. "Is it worth building this feature?" produces a better conversation than "tell me about features." You do not need to frame it perfectly — you need to frame it honestly.' },
      { t: 'h2', x: 'Steer, do not restart' },
      { t: 'p', x: 'If an answer is off, correct it in the next message: "that is not what I meant — I meant the mobile build." Turing treats corrections as first-class events. There is no "start over" button in a good conversation, and the system is built so you never need one.' },
      { t: 'h2', x: 'Give it facts you want kept' },
      { t: 'p', x: 'Anything you state as a fact — your stack, your deadline, your constraints — is stored for the conversation with provenance. You can reference it later ("remember I said the launch was Friday?") and the system will either confirm it or honestly say it does not have it.' },
      { t: 'h2', x: 'Judge it on follow-ups' },
      { t: 'p', x: 'The first reply is the introduction. The quality of a thinking partner shows in the third and fourth turns. If the follow-ups keep getting sharper, you are using it well.' }
    ]
  },
  'core-concepts': {
    title: 'Core concepts',
    section: 'Core concepts',
    body: [
      { t: 'h2', x: 'Conversation' },
      { t: 'p', x: 'A conversation is the unit of work. It is continuous: context, decisions, and facts carry across every turn. You can have many conversations; each one is its own world.' },
      { t: 'h2', x: 'Context' },
      { t: 'p', x: 'On every turn, Turing assembles a working context in three layers: the recent exchanges verbatim, a running summary of everything before them, and the stable facts you have stated. What you should know: recent messages carry the most weight, and facts you state persist across the whole conversation. What you should not assume: the system does not see other conversations you have had.' },
      { t: 'h2', x: 'Memory' },
      { t: 'p', x: 'Memory at Turing means in-conversation memory with provenance: the system remembers what you said, can attribute it, and will say "I don\u2019t remember" when the evidence is not there. It does not invent recollections. See Memory & recall for the full behavior.' },
      { t: 'h2', x: 'Confidence' },
      { t: 'p', x: 'Answers come in two kinds, and the system tells you which: grounded answers, which follow from what you stated or from solid knowledge, and extrapolated answers, which go past the evidence. Extrapolation is labeled. You always know which side of the line you are on.' }
    ]
  },
  'memory-recall': {
    title: 'Memory & recall',
    section: 'Core concepts',
    body: [
      { t: 'p', x: 'The rule that governs all of memory at Turing: nothing is presented as a memory unless it is a retrieval. If the system can point to where something came from — a message you sent, or an answer it gave — it can cite it. If it cannot, it will not claim it.' },
      { t: 'h2', x: 'What is remembered' },
      { t: 'li', x: 'Facts you state: people, projects, constraints, preferences. These persist across the conversation.' },
      { t: 'li', x: 'Decisions made together: "we are going with option B" is remembered as a decision, not a suggestion.' },
      { t: 'li', x: 'Corrections: when you correct the system, the correction supersedes the earlier statement. The old version is not quietly kept.' },
      { t: 'h2', x: 'What is not' },
      { t: 'p', x: 'Conversations are separate by design. Facts from one conversation do not leak into another. And nothing is "remembered" across the fuzzy middle ground: if a detail exists only as an inference the system made, it is offered as context with attribution — "you mentioned X earlier" — never asserted as settled.' },
      { t: 'h2', x: 'Asking about memory' },
      { t: 'p', x: 'You can always ask directly: "what do you remember about my project?" The answer is a list with sources. If the honest answer is "not much," you will get exactly that, briefly, without a lecture.' },
      { t: 'h2', x: 'If it gets something wrong' },
      { t: 'p', x: 'Say so in the next message. Corrections are first-class: the wrong fact is retired, the right one takes its place, and the system acknowledges the fix. If a memory is wrong in a way that matters, that is a bug we want to hear about — the support page is the fastest route.' }
    ]
  },
  'prompting-guide': {
    title: 'Prompting guide',
    section: 'Guides',
    body: [
      { t: 'p', x: 'There is no prompt format to learn. There are habits that work, and they are the habits of good conversation with a sharp colleague.' },
      { t: 'h2', x: 'Be specific, not formal' },
      { t: 'p', x: 'Specificity beats politeness. "Compare the two approaches for a team of five" outperforms "could you please maybe compare some approaches?" The system has no ego; it only has your words to work with.' },
      { t: 'h2', x: 'One question per turn' },
      { t: 'p', x: 'Stacking five questions in one message produces five shallow answers. Sequential questions produce one good answer at a time — and each answer shapes the next question, which is where the value is.' },
      { t: 'h2', x: 'Give constraints up front' },
      { t: 'p', x: 'Deadlines, team size, stack, budget, non-negotiables: state them once and they persist. The system treats stated constraints as standing orders for the whole conversation.' },
      { t: 'h2', x: 'Ask for structure when you need it' },
      { t: 'p', x: '"Give me a short list" or "one paragraph" are honored. Without a request, the answer shapes itself to the question: a direct answer to a direct question, a structured one when structure is asked for.' },
      { t: 'h2', x: 'Use the follow-up as your tool' },
      { t: 'p', x: 'The best technique is the weakest move: disagree, narrow, push. "That is too optimistic" or "now the same for the worst case" — the system is built for the second question, and it is where the good thinking happens.' }
    ]
  },
  'safety-limits': {
    title: 'Safety & limits',
    section: 'Guides',
    body: [
      { t: 'p', x: 'Honest limits, stated plainly. A thinking partner you can trust is one that tells you where it ends.' },
      { t: 'h2', x: 'It can be wrong' },
      { t: 'p', x: 'Turing reasons, it does not verify. For anything with real stakes — medical, legal, financial, safety-critical — treat the output as an informed conversation, not a decision. The system will flag high-stakes topics and tell you to slow down; it should make you slow down.' },
      { t: 'h2', x: 'It is labeled when it guesses' },
      { t: 'p', x: 'Answers that go past the evidence are marked as extrapolation. If an answer sounds more confident than its evidence, that is a bug — report it on the support page.' },
      { t: 'h2', x: 'Do not share secrets' },
      { t: 'p', x: 'Conversation content is used to run the conversation. You should not paste credentials, keys, or private personal data into any chat interface, Turing included. There is nothing in the product that asks you to, and nothing that should need it.' },
      { t: 'h2', x: 'What it will not do' },
      { t: 'li', x: 'It will not fabricate things you said and present them as your words.' },
      { t: 'li', x: 'It will not pretend certainty it does not have.' },
      { t: 'li', x: 'It will not answer a request it should decline with a confident no — and when it does decline, it says why, briefly.' },
      { t: 'h2', x: 'Report problems' },
      { t: 'p', x: 'The support page goes to a person. Misbehavior, wrong memories, and broken threads are the most valuable reports we can receive.' }
    ]
  },
  'api-access': {
    title: 'API access',
    section: 'Platform',
    comingSoon: true,
    body: [
      { t: 'p', x: 'There is no public API yet. No keys, no endpoints, no reference — we do not document things we cannot use, and we do not ship reference pages that point at nothing.' },
      { t: 'h2', x: 'What is coming' },
      { t: 'p', x: 'The API is being built against the same conversation core the web app runs on: continuous context, provenance-backed memory, and the same output discipline. When it ships, the full reference — authentication, endpoints, limits — will live on this page. We will not put a preview of it anywhere else, because a preview is a promise we prefer to keep exactly once.' },
      { t: 'h2', x: 'In the meantime' },
      { t: 'p', x: 'The web application is the product, and it is complete on its own. If you are building on Turing\u2019s core and want to be told the day the API opens, the fastest route is the support page — say "API access" in the topic field and a person will keep your note.' }
    ]
  }
};

module.exports = { RESEARCH, DOCS };
