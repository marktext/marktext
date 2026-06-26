# Commenting Guidelines

Distilled from John Ousterhout's *A Philosophy of Software Design* (ch. 12–16).
One rule governs everything below:

> **Comments should describe things that aren't obvious from the code.**

A comment captures what was in the designer's mind but couldn't be expressed in
the code itself — the rationale, the constraints, the abstraction. If a comment
only restates the code, it has no value.

---

## What goes in a comment

There is real design information that code cannot express: the informal meaning
of a method, the units of a value, why a line exists, the rule the author
followed ("always call `a` before `b`"). Comments exist to record exactly this.

Comments also make abstraction possible. An abstraction hides complexity so you
can use a module without reading its implementation — and the only way to
describe an abstraction is in prose. Without comments, the sole abstraction of a
function is its signature, which leaves out too much to be useful (does
`substring(start, end)` include `end`? what if `start > end`?).

So a comment is good when it sits at a **different level of detail** than the
code: either lower (more precise) or higher (more intuitive). A comment at the
same level as the code is just restating it.

---

## Rules

**Don't repeat the code.** Before keeping a comment, ask: *could someone write
this just by looking at the code next to it?* If yes, delete it. A special case
of this: don't build the comment out of the words already in the name —
`// Normalize the resource name` above `getNormalizedResourceName()` adds nothing.

**Lower-level comments add precision.** Most valuable on declarations —
instance variables, parameters, return values, where the name and type aren't
enough. Spell out: units; whether bounds are inclusive or exclusive; what `null`
means if allowed; who owns/frees a resource; any invariant ("this list always
has at least one entry"). Describe what a variable *is*, not how the code
mutates it — think nouns, not verbs.

**Higher-level comments add intuition.** One sentence on what a block *does* and
why, omitting the mechanics. A reader who has that sentence can explain the rest
of the code themselves — and judge whether it's correct. These are harder to
write: ask yourself "what is the simplest thing I can say that explains
everything here?"

**Separate interface from implementation comments.** Interface comments tell a
caller what they need to use the thing — they *are* the abstraction.
Implementation comments explain how it works inside. Never let one leak into the
other. A caller should not have to read a method's body to call it correctly.

  - *Class:* the abstraction it provides, what an instance represents, its
    limitations. No method-by-method detail.
  - *Method:* behavior from the caller's view; every parameter and the return
    value, precisely; side effects; exceptions; preconditions. Keep
    preconditions few, but document the ones that remain.
  - The test for any fact: *does a caller need it to use this?* Wire formats,
    internal data structures, transparent crash recovery — no, those are
    implementation. A comparison being string-vs-integer, or whether requests
    fire concurrently (affects performance) — yes.

**Implementation comments say what and why, not how.** Most short methods need
none. For longer ones, put a high-level line before each major block or
non-trivial loop. Always explain anything subtle the code can't show — a
bug-fix whose purpose isn't obvious gets a comment (reference the issue rather
than restating it: `// Fixes #436 — autolink overrun on pasted URLs`).

**Cross-module decisions need a findable home.** When a decision spans several
files, document it where developers will actually trip over it — e.g. at the enum
declaration they must edit, list every other place that needs updating. If
there's no natural center, keep a `designNotes` file and point to it from each
site (`// See "Zombies" in designNotes`).

---

## Write the comments first

Comments written last are bad comments: by then you've checked out mentally, your
memory of the design is fuzzy, and you write them by reading the code — so they
repeat it.

Instead, for a new class:

1. Write the class interface comment.
2. Write interface comments and signatures for the key public methods; leave the
   bodies empty.
3. Iterate until the structure feels right.
4. Write declarations and comments for the key instance variables.
5. Fill in the bodies, adding implementation comments as needed.

When the code is done, the comments are done — there's no backlog. And it costs
almost nothing: typing code and comments together is a small fraction of total
development time.

**A comment is a complexity detector.** The comment for a method or variable
should be short *and* complete. If you can't write one that's both, the thing
you're describing is probably badly designed — that's the signal to fix the
design, not the comment.

> 🚩 If the interface comment has to describe the implementation, the method is
> too shallow. 🚩 If a comment merely repeats the code, it's noise. 🚩 If
> something is hard to describe, the design has a problem.

---

## Keep them alive

**Put the comment next to the code it describes.** The farther away, the less
likely it gets updated. A method's interface comment belongs right by its body,
not in a separate header. Push implementation comments down to the narrowest
scope they cover rather than stacking them at the top. As a corollary: the
farther a comment is from its code, the more abstract it should be.

**Comments belong in the code, not the commit log.** If a future developer will
need the information, put it where they'll see it. A commit message explaining a
subtle fix is invisible to the next person who "simplifies" it back into a bug.

**Don't duplicate.** Document each decision once, in the most obvious place, and
reference it from the others. Don't re-document one module inside another, and
don't restate things already in an external spec or manual — link to them.

**Check the diff before committing.** Scan every change and confirm the
surrounding comments still hold. This also catches stray debug code and stale
TODOs.

**Higher-level comments are easier to maintain** — they survive minor code
changes because they don't depend on details. Reserve precise, detailed comments
for the places that genuinely need them.

---

## Names are documentation too (ch. 14)

A good name reduces the need for comments. Make names **precise** — `getCount()`
counts *what*? — and make them **paint an image** of what the thing is and isn't,
in two or three words. A single vague name once cost the author a six-month bug
hunt: `block` meant both a disk block and a file block; `diskBlock` / `fileBlock`
would have prevented it. Don't settle for "close enough."

---

**The test for any comment:** is it something you *couldn't* read off the code,
and is it both short and complete?
