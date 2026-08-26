# Roleplay Chapter Memory System — MVP Specification

## 1. Purpose

This document defines the MVP memory system for a long-running AI roleplay application.

The primary problem is context growth: sending the entire conversation to the model becomes increasingly expensive and eventually causes the model to lose important context.

The MVP solves this by:

* Keeping recent messages as raw conversation.
* Allowing the user to manually define chapters.
* Automatically suggesting chapter boundaries using configurable text triggers.
* Replacing archived raw messages in the model context with a richer AI-generated chapter summary.
* Never deleting original messages.
* Allowing chapters to be edited or regenerated from the original transcript.

The design intentionally avoids complex long-term retrieval, vector databases, structured world-state memory, and automatic fact extraction in the MVP.

---

## 2. Core Design

The context sent to the model should conceptually look like:

```text
System / Character Prompt
+
Older Chapter Summaries
+
Recent Raw Messages
+
Current User Message
```

A chapter represents a **historical narrative summary**, not an authoritative state object.

This distinction is intentional.

Do NOT maintain multiple independent character/world-state snapshots in the MVP because sending several state snapshots together can create ambiguity about which state is current.

The chapter summary should instead describe what happened and preserve the information needed to continue the roleplay naturally.

---

# 3. Message Lifecycle

Every message has two conceptual roles:

### Active / Raw

Recent messages remain in their original form and are sent directly to the model.

### Archived

Messages that belong to completed chapters remain permanently stored but are no longer sent individually.

Instead, their chapter summary is sent.

Important:

> Archiving is a context-management operation, not data deletion.

The original transcript must always remain available.

---

# 4. Recent Raw Message Window

The number of recent raw messages is a **user-configurable setting**.

Example:

```text
Raw message window: 10
```

This means the latest 10 messages remain raw.

The system should NOT determine this window using tokens in the MVP.

Example:

```text
Chapter A
├── messages 1–30
│   └── archived → chapter summary
│
└── messages 31–40
    └── raw
```

If the user changes the setting to 20:

```text
Chapter A
├── messages 1–20
│   └── archived
│
└── messages 21–40
    └── raw
```

The setting should apply dynamically to context construction.

---

# 5. Minimum Chapter Distance

A chapter cannot end inside the configured raw-message window.

If:

```text
raw_window = 10
```

then a chapter must end at least 10 messages before the current message.

This protects the recent conversational context and ensures that the model still sees enough raw dialogue to understand:

* the current scene
* current response style
* character behavior
* formatting
* immediate conversational context

### Example

Current message:

```text
#50
```

Raw window:

```text
10
```

The latest possible chapter boundary is:

```text
#40
```

Messages:

```text
41–50
```

remain raw.

---

# 6. Manual Chapter Creation

The user should be able to select a message range in the UI.

Example:

```text
Message 1
Message 2
Message 3
...
Message 25
```

The user selects:

```text
Start: Message 4
End:   Message 25
```

The UI should validate that the selected end is outside the current raw window.

If the boundary is too recent:

```text
This chapter must end at least 10 messages before the current message.
```

The user should then be able to:

* Create chapter
* Cancel
* Adjust selection

---

# 7. Automatic Chapter Suggestions

The MVP should support lightweight deterministic trigger detection.

The important optimization is:

> Do not run an LLM on every message just to detect chapter boundaries.

Instead, the application checks user-configured trigger phrases locally.

Example triggers:

```text
next day
the next morning
later that day
the following day
meanwhile
several hours later
```

The user should be able to customize these triggers.

---

## 7.1 Trigger Detection Algorithm

Assume:

```text
raw_window = 10
```

A new message arrives.

The system checks:

1. Is the current conversation far enough past the previous possible boundary?
2. Does the new message contain one of the configured triggers?
3. Has enough raw-message distance accumulated since that trigger?

If both conditions are satisfied, show a chapter suggestion.

Example:

```text
Message 100:
"We went home."

Message 101:
"The next morning, Alice woke up..."

...

Message 110:
"John entered the kitchen."

→ Suggest chapter
```

The system does NOT automatically create the chapter.

It shows:

```text
Possible chapter boundary detected.

[Create Chapter] [Dismiss]
```

This keeps the user in control.

---

# 8. Trigger Configuration

Each user should have their own configurable trigger list.

Example UI:

```text
Automatic Chapter Detection

Enabled: ON

Triggers:
[ next morning ]
[ next day ]
[ later that day ]
[ meanwhile ]

+ Add trigger
```

Potential settings:

```text
Enable automatic suggestions
Trigger phrases
Minimum raw message window
```

The trigger matching can initially be simple case-insensitive phrase matching.

More advanced semantic detection is intentionally postponed.

---

# 9. Chapter Generation

When a chapter is created, the application sends its original transcript to the summarization model.

The summarizer should produce a **rich narrative summary**, not a generic short summary.

The purpose is to preserve information that may matter later in the roleplay.

Recommended output:

```text
Chapter Title

Summary:
A concise but information-dense description of what happened.

Key Events:
- ...
- ...
- ...

Character Development:
- ...
- ...

Important Details:
- ...
- ...

Unresolved Threads:
- ...
- ...

Current Situation at Chapter End:
- ...
```

This remains plain text/Markdown rather than a large structured JSON state model.

---

# 10. Rich Summary Requirements

The summarizer should prioritize information that helps the model continue the roleplay.

It should preserve, when relevant:

### Events

Major actions and developments.

### Character behavior

Important decisions, reactions, emotional changes, conflicts, and relationships.

### Important dialogue

Only dialogue or statements whose exact meaning matters later.

### Locations and situations

Where important scenes occurred and how the situation changed.

### Story progression

What objectives were completed, failed, or introduced.

### Continuity

Promises, plans, discoveries, secrets, conflicts, and unresolved threads.

### End-of-chapter context

The situation immediately at the chapter boundary.

The summarizer should avoid unnecessary prose and avoid inventing information.

---

# 11. Summary Prompt Principle

The summarization prompt should explicitly tell the model:

```text
Summarize only information supported by the provided conversation.

Do not invent facts.

Preserve details that could affect future roleplay continuity.

Prioritize:
- important events
- character actions and reactions
- relationship changes
- decisions
- discoveries
- promises
- unresolved situations
- important locations
- information revealed to each character
- the situation at the end of the chapter

Do not include information from outside the selected chapter.
```

The exact prompt can be refined independently from the application architecture.

---

# 12. Avoiding Duplicate Context

One important implementation rule:

A chapter summary should replace the messages it covers.

Do not send both:

```text
Chapter summary
+
all raw messages contained in that chapter
```

unless explicitly requested for debugging or regeneration.

The normal model context should be:

```text
Chapter 1 summary
Chapter 2 summary
Chapter 3 summary
Recent raw messages
Current message
```

This keeps the context compact.

---

# 13. Chapter Editing

Every chapter should have a UI editor.

The user should be able to:

* Edit title
* Edit summary
* Edit key events
* Edit important details
* Edit unresolved threads
* Save changes
* Regenerate summary
* Delete/archive the chapter representation

Deleting a chapter representation must NOT delete the original messages.

---

# 14. Regeneration

Regeneration should always use the original transcript as the source of truth.

Example:

```text
Original messages
       ↓
Chapter generator
       ↓
New summary
```

Do NOT regenerate a chapter from its previous summary.

This avoids cumulative summary degradation.

Bad:

```text
Raw messages
 → Summary A
 → Summary B
 → Summary C
```

Preferred:

```text
Raw messages
 ├── Summary A
 ├── Summary B
 └── Summary C
```

The original transcript remains authoritative.

---

# 15. Chapter Data Model

A minimal database representation could contain:

```text
Chapter
- id
- conversation_id
- start_message_id
- end_message_id
- title
- summary
- created_at
- updated_at
```

Optional metadata:

```text
- generation_model
- generation_prompt_version
- manually_edited
- generated_at
```

Messages remain in the existing message table.

A chapter references a range of messages instead of duplicating their contents.

---

# 16. Context Construction

At inference time:

```text
1. Load conversation
2. Load chapters
3. Determine current raw window
4. Select chapter summaries that are outside the raw window
5. Append recent raw messages
6. Append current user message
7. Send to model
```

Conceptually:

```text
Conversation
│
├── Chapter 1 → summary
├── Chapter 2 → summary
├── Chapter 3 → summary
│
└── Recent messages → raw
```

The system should not duplicate the same historical messages through both a chapter summary and raw messages.

---

# 17. Chapter Boundary Rules

A chapter should satisfy:

```text
start_message_id < end_message_id
```

and:

```text
current_message_position - end_message_position >= raw_window
```

The UI should prevent invalid chapter boundaries.

For automatic suggestions, the same validation must happen before displaying the suggestion.

---

# 18. Important MVP Non-Goals

The following are intentionally NOT part of the first version:

* Vector database
* Embedding-based retrieval
* Semantic memory search
* Automatic world-state extraction
* Character state database
* Fact database
* Knowledge graph
* Cross-conversation memory
* Automatic conflict resolution
* Multi-level memory hierarchy
* Token-based adaptive compression
* Fully automatic chapter creation
* LLM-based trigger detection on every message

Keeping these out of the MVP reduces implementation complexity substantially.

---

# 19. Recommended MVP UI

## Conversation Timeline

Add chapter controls to the message timeline.

Example:

```text
────────────────────────────────

Message 1
Message 2
Message 3

[ Start Chapter ]

Message 4
Message 5
...
Message 25

[ End Chapter ]

────────────────────────────────
```

After creation:

```text
┌─────────────────────────────────┐
│ Chapter 1                       │
│ The Night at the Hotel          │
│                                 │
│ Messages 4–25                   │
│                                 │
│ [Edit] [Regenerate] [Delete]    │
└─────────────────────────────────┘
```

---

# 20. Recommended Settings

### Memory

```text
Recent raw messages: 10
```

### Automatic chapter detection

```text
Enabled: true

Triggers:
- next day
- next morning
- later that day
- meanwhile
```

These values should be user-specific.

---

# 21. Suggested Internal Services

A clean implementation can separate responsibilities:

```text
ChapterService
├── createChapter()
├── updateChapter()
├── regenerateChapter()
├── deleteChapter()
└── validateBoundary()

ChapterSuggestionService
├── detectTriggers()
├── canSuggestBoundary()
└── createSuggestion()

ChapterSummaryService
└── generateSummary()

ContextBuilder
└── buildModelContext()
```

This keeps chapter management independent from the LLM provider.

---

# 22. Recommended Event Flow

Manual:

```text
User selects range
       ↓
Validate boundary
       ↓
Create chapter
       ↓
Send selected transcript to summarizer
       ↓
Store summary
       ↓
Context builder starts using summary
```

Automatic:

```text
New message
       ↓
Local trigger detection
       ↓
Check raw-window distance
       ↓
Trigger valid?
   ┌───┴───┐
  NO      YES
   │        │
   ▼        ▼
Nothing   Show suggestion
             ↓
        User accepts?
          ┌──┴──┐
         NO     YES
         │       │
         ▼       ▼
       Ignore  Create chapter
```

---

# 23. Failure Handling

If chapter generation fails:

* Keep the original messages untouched.
* Do not mark the messages as successfully archived.
* Allow retry.
* Show generation failure in the UI.

If the user edits a chapter:

* Store the edited version.
* Preserve the original transcript.
* Mark the chapter as manually edited.

If regeneration occurs:

* Generate from the original transcript.
* Replace the generated summary only after successful generation.

---

# 24. Observability

For debugging memory quality, record:

```text
conversation_id
chapter_id
message_start
message_end
raw_window
summary_generation_model
summary_generation_time
summary_generation_tokens
manual_edit
regeneration_count
```

This will later help answer questions such as:

* Are summaries too large?
* Are chapters too frequent?
* Which models generate better summaries?
* How much context is actually being saved?
* Does increasing the raw window improve roleplay quality?

---

# 25. Future TODO / Possible Extensions

These are intentionally outside the MVP but worth keeping in the roadmap.

## Priority: High

### Retrieval

Search historical chapters when the current conversation refers to older events.

Potential future flow:

```text
Current conversation
      ↓
Find relevant chapters
      ↓
Select relevant chapter
      ↓
Optionally retrieve original messages
```

### Better Chapter Detection

Add semantic signals in addition to configurable phrases:

* scene changes
* location changes
* time jumps
* major events
* topic changes
* conversation endings

Keep this optional because it requires additional model inference.

### Chapter Search

Allow users to search:

```text
"the first argument"
"hotel"
"Sarah"
"letter"
```

and jump directly to relevant chapters.

---

## Priority: Medium

### Chapter Nesting

Allow:

```text
Story
 ├── Chapter 1
 ├── Chapter 2
 │    ├── Scene A
 │    └── Scene B
 └── Chapter 3
```

Useful if conversations become extremely long.

### Chapter Compression Levels

Possible modes:

```text
Detailed
Balanced
Compact
```

### Chapter Merge / Split

Allow:

```text
Merge Chapter 3 + Chapter 4
```

or:

```text
Split Chapter 5
```

without modifying original messages.

### Summary Versioning

Keep previous generated summaries:

```text
v1
v2
v3
```

so the user can revert.

### Summary Quality Check

After generation, optionally run a second lightweight validation pass to detect:

* invented facts
* missing major events
* contradictions
* excessive summary length

---

## Priority: Low / Advanced

### Semantic Retrieval

Embedding-based chapter and message search.

### Raw Message Retrieval

Instead of only retrieving whole chapters, retrieve the smallest relevant raw message range.

### Stable Memory

Separate permanent information from episodic information:

```text
Episode:
"What happened yesterday"

Stable memory:
"John is Alice's brother"
```

### Character Memory

Track persistent character information independently from chapters.

### World State

A structured representation of:

* locations
* relationships
* inventory
* active quests
* important objects
* current conditions

### Memory Conflict Resolution

Handle situations where new information changes an older memory.

Example:

```text
Old:
John owns the house.

New:
John sold the house.
```

The system should understand that the new fact supersedes the old one rather than presenting both as simultaneously true.

### Cross-Session Memory

Allow a roleplay to continue across separate conversations.

### Hierarchical Memory

Eventually evolve from:

```text
Raw messages
    ↓
Chapter summaries
```

into:

```text
Raw messages
    ↓
Scenes / Chapters
    ↓
Story-level summaries
    ↓
Long-term memories
```

This should only be considered when the simpler chapter system is no longer sufficient.

---

# 26. MVP Success Criteria

The MVP should be considered successful if:

1. Long conversations use significantly fewer input tokens.
2. The model retains the important narrative information from archived chapters.
3. Recent conversational style and context remain available through the raw window.
4. Users can control where chapters begin and end.
5. Automatic suggestions do not require an LLM call on every message.
6. Users can edit or regenerate summaries.
7. Original messages are never lost.
8. Regeneration does not accumulate previous summary errors.
9. The system remains understandable and debuggable.

---

# 27. Final MVP Architecture

```text
                    CONVERSATION
                         │
                         ▼
                  ┌─────────────┐
                  │ Raw Messages│
                  └──────┬──────┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
       Chapter Manager       Recent Raw Window
              │                     │
       ┌──────┴──────┐              │
       │             │              │
    Manual       Trigger            │
   Boundary      Detection          │
       │             │              │
       └──────┬──────┘              │
              ▼                     │
       Summary Generator            │
              │                     │
              ▼                     │
       Chapter Summary              │
              │                     │
              └──────────┬──────────┘
                         ▼
                   Context Builder
                         │
                         ▼
                       LLM
```

The key principle is:

> **Store everything, summarize what is old, keep the recent conversation raw, and let the user control the compression boundary.**
