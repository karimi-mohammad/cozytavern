# CozyTavern UI/UX Design Specification
## Inspired by SillyTavern 1.18.0

---

## Table of Contents
1. [Screenshot 1 — Main Dashboard (No Chat Selected)](#screenshot-1--main-dashboard-no-chat-selected)
2. [Screenshot 2 — API Settings Panel (Left Sidebar)](#screenshot-2--api-settings-panel-left-sidebar)
3. [Screenshot 3 — Active Chat View](#screenshot-3--active-chat-view)
4. [Screenshot 4 — UI Settings Panel (Right Sidebar)](#screenshot-4--ui-settings-panel-right-sidebar)
5. [Global Design System](#global-design-system)
6. [Implementation Roadmap](#implementation-roadmap)

---

## Screenshot 1 — Main Dashboard (No Chat Selected)

### Overall Layout
```
┌──────────────────────────────────────────────────────────┐
│ [≡] [▼] [🖼] [T] [🌐] [👥] [⚙] [😊] [≡] [📚]   [▼v]  │  ← Top Toolbar (50px)
├──────────────────────────────────────────────────────────┤
│ [▼v] No chat selected          [S...] [🔄][💬][✏][🗑][X]│  ← Secondary Bar (40px)
├──────────────────────────────────────────────────────────┤
│  🎭 CozyTavern 1.0.0                                    │
│  Recent Chats     [Docs] [GitHub] [Discord] [Temp Chat]  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [Avatar] Character - ChatName - Timestamp          │  │  ← Chat Card 1
│  │         Preview text...                7/27  💬1089 │  │
│  │                              📌  ✏  🗑  │  2.46MB  │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [Avatar] Character - ChatName - Checkpoint #1      │  │  ← Chat Card 2
│  │         Preview text...                 8/3  💬580  │  │
│  │                              📌  ✏  🗑  │  1.33MB  │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [❓] Character - ChatName                          │  │  ← Chat Card 3
│  │         Preview text...                 8/2  💬19   │  │
│  │                              📌  ✏  🗑  │  44.45KB │  │
│  └────────────────────────────────────────────────────┘  │
│                        [▼] (show more)                    │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [ST] Assistant  August 4, 2026 6:26 PM             │  │  ← Welcome Box
│  │                                                    │  │
│  │ If you're connected to an API, try asking me       │  │
│  │ something!                                         │  │
│  │                                                    │  │
│  │ Hint: Set any character as your welcome page       │  │
│  │ assistant from their "More..." menu.               │  │
│  │                                                    │  │
│  │  [🔗 API Connections] [🎭 Character] [🧩 Extensions]│  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ [≡][✨] │ Type a message, or /? for help     [→] [➤]    │  ← Input Bar (50px)
│ [🔍]                                            [Generate]│
└──────────────────────────────────────────────────────────┘
```

### Top Toolbar
| Element | Position | Size | Colors | Notes |
|---------|----------|------|--------|-------|
| Container | Full width, top | h: 50px | bg: `#1a1a2e` / `#0f0f1a` | Dark semi-transparent |
| Icon buttons | Horizontal row, centered | 32×32px each | Default: `#8888aa`, Hover: `#ffffff` | SVG icons, no labels |
| Spacing between icons | — | 8px gap | — | Evenly distributed |
| Font | — | 16px icon size | — | Material/SVG icons |

### Secondary Bar (Chat Selector)
| Element | Position | Size | Colors | Notes |
|---------|----------|------|--------|-------|
| Container | Below toolbar | h: 40px | bg: `#1a1a2e` | Slightly lighter than toolbar |
| Chat icon | Left | 16×16px | `#8888aa` | Document/chat icon |
| "No chat selected" | Center-left | Font: 14px | `#8888aa` | Dropdown trigger |
| Dropdown arrow | After text | 12×12px | `#8888aa` | |
| Search field | Center | w: 200px, h: 28px | bg: `#2a2a3e`, border: `#3a3a5e` | Rounded, placeholder text |
| Action icons (right) | Right-aligned | 20×20px each | `#8888aa` | Chat management icons |

### Chat Cards (Recent Chats)
| Element | Position | Size | Colors | Notes |
|---------|----------|------|--------|-------|
| Card container | Full width | px: 16, py: 12 | bg: `#1e1e32` / `#252540` | Rounded corners (8px) |
| Avatar | Left | 48×48px | border-radius: 50% (circle) | Character image |
| Character name | After avatar, top | Font: 16px, bold | `#e0e0ff` | White-ish text |
| Chat name | After character name | Font: 14px | `#8888aa` | Separator: ` - ` |
| Timestamp | After chat name | Font: 12px | `#6666aa` | Format: `2026-07-19@13h33m49s276ms` |
| Date (right) | Far right | Font: 12px | `#8888aa` | Short format: `7/27/2026` |
| Preview text | Below name | Font: 13px, max 2 lines | `#7777aa` | Truncated with ellipsis |
| Pin icon | Bottom-right area | 16×16px | `#8888aa` | Toggle pin |
| Edit icon | Bottom-right | 16×16px | `#8888aa` | Pencil icon |
| Delete icon | Bottom-right | 16×16px | `#aa4444` (hover: `#ff4444`) | Trash icon |
| Message count | Far right, middle | Font: 12px | `#8888aa` | Chat bubble icon + number |
| File size | Far right, bottom | Font: 11px | `#6666aa` | e.g., `2.46MB` |

### Welcome Box (Assistant Message)
| Element | Position | Size | Colors | Notes |
|---------|----------|------|--------|-------|
| Container | Full width | px: 24, py: 20 | bg: `transparent` | Centered content |
| Avatar | Left | 40×40px | bg: `#ff4444`, text: white "ST" | Circle, 2-letter logo |
| "Assistant" label | After avatar | Font: 16px, bold | `#e0e0ff` | |
| Timestamp | After label | Font: 12px | `#6666aa` | "August 4, 2026 6:26 PM" |
| Message body | Below | Font: 15px, line-height: 1.5 | `#ccccdd` | Normal weight |
| Hint text | Below message | Font: 13px, italic | `#8888aa` | |
| "More..." | In hint text | Font: 13px, bold | `#ffaa44` (orange) | Emphasis color |
| Action buttons | Bottom, centered | h: 32px, px: 16 | bg: `#2a2a3e`, border: `#3a3a5e` | Rounded pill shape |
| Button text | In buttons | Font: 13px | `#ccccdd` | With icon prefix |
| Button icons | Before text | 14×14px | `#8888aa` | 🔗 🎭 🧩 |

### Input Bar (Bottom)
| Element | Position | Size | Colors | Notes |
|---------|----------|------|--------|-------|
| Container | Full width, bottom | h: 50-60px | bg: `#1a1a2e` | Fixed at bottom |
| Menu icon (hamburger) | Far left | 24×24px | `#8888aa` | Three horizontal lines |
| Magic wand icon | Next to menu | 24×24px | `#8888aa` | ✨ sparkle icon |
| Text input | Center, flex-grow | h: 36px | bg: `#2a2a3e`, border: none | Rounded (18px radius) |
| Placeholder text | In input | Font: 14px | `#555577` | "Type a message, or /? for help" |
| Send arrow (→) | Right of input | 24×24px | `#8888aa` | Regular send |
| Send arrow (➤) | Right of → | 24×24px | `#8888aa` | AI send / generate |
| Generate button | Far right | h: 36px, px: 16 | bg: `#ff6644` (orange-red) | Rounded, bold |
| Generate text | In button | Font: 13px, bold | `#ffffff` | |

---

## Screenshot 2 — API Settings Panel (Left Sidebar)

### Panel Structure
```
┌────────────────────────────┐
│ Chat Completion   [🔗][→][↗][🗑] │  ← Panel Header
│ Presets                     │
├────────────────────────────┤
│ [▼ Default          ] [💾][✏][📋]│  ← Preset Selector
├────────────────────────────┤
│ [□] Unlocked Context Size   │  ← Checkbox
│ Unrestricted maximum value  │  ← Description text
│ for the context size slider.│
│ Enable only if you know     │
│ what you're doing.          │
├────────────────────────────┤
│ Context Size (tokens)       │  ← Slider Label
│ [═════════════●══] 91572 [▲▼]│  ← Slider + Number Input
├────────────────────────────┤
│ Max Response Length (tokens) │
│ [1000              ] [▲▼]   │  ← Number Input only
├────────────────────────────┤
│ Multiple swipes per gen     │
│ [1                  ] [▲▼]  │
├────────────────────────────┤
│ [✓] Streaming               │  ← Checkbox
│ Display the response bit by │  ← Description
│ bit as it is generated.     │
│ When this is off, responses │
│ will be displayed all at    │
│ once when they are complete.│
├────────────────────────────┤
│ Temperature                 │
│ [════════●════════] 0.80   │  ← Slider
├────────────────────────────┤
│ Frequency Penalty           │
│ [═══●═════════════] 0.11   │
├────────────────────────────┤
│ Presence Penalty            │
│ [●════════════════] 0.00   │
├────────────────────────────┤
│ Top P                       │
│ [═════════════●═══] 0.92   │
└────────────────────────────┘
```

### Panel Specifications
| Element | Position | Size | Colors | Notes |
|---------|----------|------|--------|-------|
| Panel width | Left side | w: 300-320px | bg: `#1a1a2e` | Dark panel |
| Panel shadow | Right edge | 4px blur | `rgba(0,0,0,0.3)` | Subtle drop shadow |
| Header text | Top | Font: 16px, bold | `#e0e0ff` | Two-line: "Chat Completion / Presets" |
| Header icons | Right of header | 20×20px each | `#8888aa` | Link, forward, external, delete |
| Preset dropdown | Below header | h: 32px, full width | bg: `#2a2a3e`, border: `#3a3a5e` | Rounded |
| Dropdown text | In dropdown | Font: 14px | `#ccccdd` | "Default" |
| Dropdown icons (right) | In dropdown, right | 16×16px each | `#8888aa` | Save, edit, copy, delete |

### Slider Components
| Element | Position | Size | Colors | Notes |
|---------|----------|------|--------|-------|
| Label text | Above slider | Font: 13px, normal | `#ccccdd` | Left-aligned |
| Slider track | Full width | h: 4px | bg: `#3a3a5e` | Rounded ends |
| Slider track (filled) | Left to thumb | h: 4px | bg: `#6666cc` (purple-blue) | Active portion |
| Slider thumb | On track | 16×16px, circle | bg: `#ffffff` | Draggable |
| Value display | Right of slider | Font: 13px, mono? | `#ccccdd` | Number |
| Spinner arrows | Right of value | 12×12px each | `#8888aa` | Up/Down increment |

### Checkbox Components
| Element | Position | Size | Colors | Notes |
|---------|----------|------|--------|-------|
| Checkbox box | Left | 16×16px | border: `#8888aa` | Rounded (3px) |
| Checkbox (checked) | — | — | bg: `#6666cc`, check: white | Purple fill |
| Label text | Right of checkbox | Font: 14px, normal | `#ccccdd` | |
| Description text | Below label | Font: 12px | `#7777aa` | Multi-line, lighter |

### Number Input
| Element | Position | Size | Colors | Notes |
|---------|----------|------|--------|-------|
| Input field | Right-aligned | w: 80px, h: 28px | bg: `#2a2a3e`, border: `#3a3a5e` | Rounded |
| Value text | In input | Font: 14px, mono | `#ccccdd` | |
| Spinner buttons | Right of input | 12×12px each | `#8888aa` | Up/Down arrows |

---

## Screenshot 3 — Active Chat View

### Message Layout
```
┌──────────────────────────────────────────────────┐
│                                                  │
│  [Character speech/dialogue text in italic]       │  ← Character Message (no avatar)
│  *action descriptions in asterisks*              │
│                                                  │
│  "dialogue in orange/colored text"               │  ← Colored dialogue
│                                                  │
│  *more actions*                                  │
│                                                  │
│  [Mohammad] [July 27, 2026 11:04 AM]     [···][✏]│  ← User Message Header
│  31t                                              │  ← Token count
│                                                  │
│  مطعلمه میکونی زندگی من                          │  ← User message (RTL)
│  خیلی خوشحال میشم                                │
│                                                  │
│  [Lina] [July 27, 2026 11:05 AM] [⟳]     [···][✏]│  ← AI Message Header
│  480t                                             │  ← Token count
│  [Thought for a minute ▾]                        │  ← Expandable thinking
│  ┌──────────────────────────────────────────┐    │
│  │ [Thinking/reasoning content]             │    │  ← Thinking block (collapsed)
│  └──────────────────────────────────────────┘    │
│                                                  │
│  *AI response text in italics*                   │  ← AI response body
│  "dialogue in orange/colored text"               │
│                                                  │
│                              "خیلی ممنون..."     │  ← RTL text
│                                                  │
│  [Next paragraph continues below]                │
│                                                  │
│                              "خونسرد اومدم"      │
│                                                  │
│                                    [>] [1/1 [▼]] │  ← Swipe controls
└──────────────────────────────────────────────────┘
```

### Message Components
| Element | Position | Size | Colors | Notes |
|---------|----------|------|--------|-------|
| **User Message** | | | | |
| Username | Left-aligned | Font: 14px, bold | `#e0e0ff` | "Mohammad" |
| Timestamp | After username | Font: 12px | `#6666aa` | "July 27, 2026 11:04 AM" |
| Token count | Below name, left | Font: 11px | `#6666aa` | "31t" (tokens) |
| Message body | Below header | Font: 15px, line-height: 1.6 | `#ccccdd` | Supports RTL |
| Edit icon | Far right of header | 16×16px | `#8888aa` | Pencil |
| More icon | Right of header | 16×16px | `#8888aa` | Three dots "···" |
| **AI Message** | | | | |
| Avatar | Left | 40×40px circle | Character image | Only on AI messages |
| Character name | After avatar | Font: 14px, bold | `#e0e0ff` | "Lina" |
| Timestamp | After name | Font: 12px | `#6666aa` | |
| Regenerate icon | After timestamp | 16×16px | `#8888aa` | ⟳ circular arrows |
| Token count | Below avatar, left | Font: 11px | `#6666aa` | "480t" |
| Message body | Below header | Font: 15px, line-height: 1.6 | `#ccccdd` | |
| **Action text** | In message | Font: 15px, italic | `#ccccdd` | Wrapped in `*asterisks*` |
| **Dialogue text** | In message | Font: 15px, bold | `#ffaa44` (orange) | Wrapped in `"quotes"` |
| **Thinking block** | In AI message | Collapsible | bg: `#1e1e32` border: `#3a3a5e` | "Thought for a minute ▾" |
| **Swipe controls** | Bottom-right of msg | Group | — | `[>] [N/N [▼]]` |
| Swipe arrow (>) | Right | 20×20px | `#8888aa` | Next swipe |
| Swipe counter | Next to arrow | Font: 12px | `#8888aa` | "1/1" |
| Swipe dropdown | Right | 12×12px | `#8888aa` | Select from list |

### Text Styling Rules
| Style | Format | Visual | Color |
|-------|--------|--------|-------|
| Action/narration | `*text*` | Italic | `#ccccdd` (default text) |
| Dialogue/speech | `"text"` | Bold | `#ffaa44` (orange) |
| Character name | `{{char}}` | Normal | Replaced with actual name |
| User name | `{{user}}` | Normal | Replaced with actual name |
| RTL text | Auto-detected | Same styling | `#ccccdd` |
| Code/monospace | Backticks | Monospace font | Slightly different bg |

---

## Screenshot 4 — UI Settings Panel (Right Sidebar)

### Panel Structure
```
┌──────────────────────────────────────────────────┐
│ [▼ Dark Lite     ] [💾][↗]                       │  ← Theme Selector
├──────────────────────────────────────────────────┤
│ Char List Subheader                              │
│ [▼ Character Version         ]                   │  ← Dropdown
│                                                  │
│ Import Card Tags: [▼ Ask       ]                 │
├──────────────────────────────────────────────────┤
│ [✓] Advanced Character Search                    │  ← Checkbox Options
│ [✓] Prefer Char. Prompt                          │
│ [✓] Prefer Char. Instructions                    │
│ [□] Never resize avatars                         │
│ [✓] Animated background thumbnails               │
│ [□] Show avatar filenames                        │
│ [□] Spoiler Free Mode                            │
├──────────────────────────────────────────────────┤
│ # Msg. to Load [?]    Streaming FPS [?]          │
│ [═══●═══════════]     [════════════●═]           │
│ [100         [▲▼]]   [30          [▲▼]]          │
│ (0 = All)                                        │
├──────────────────────────────────────────────────┤
│ Example Messages Behavior:                       │
│ [▼ Gradual push-out        ]                     │
│                                                  │
│ Image Swipe Behavior:                            │
│ [▼ Generate new            ]                     │
│                                                  │
│ Enter to Send: [▼ Automatic (PC)    ]            │
├──────────────────────────────────────────────────┤
│ Avatars: [▼ Circle ]                             │
│ Chat Style: [▼ Flat  ]                           │
│ Media Style: [▼ List  ]                          │
├──────────────────────────────────────────────────┤
│ Notifications:                                   │
│ [▼ Top Center              ]                     │
├──────────────────────────────────────────────────┤
│ Theme Colors [▾] (expandable)                    │
│                                                  │
│ Chat Width [🖥]     Font Scale [ℹ]               │
│ [═══●═══════════]   [●═════════════]            │
│ [50            ]    [1              ]            │
│                                                  │
│ Blur Strength [ℹ]   Shadow Width [ℹ]            │
│ [═══●═══════════]   [●═════════════]            │
│ [10            ]    [2              ]            │
├──────────────────────────────────────────────────┤
│ [□] Reduced Motion                               │  ← Toggle Options
│ [✓] No Blur Effect                               │     (two columns)
│ [✓] No Text Shadows                              │
│ [□] Visual Novel Mode                            │
│ [□] Expand Message Actions                       │
│ [□] Zen Sliders                                  │
│ [□] Mad Lab Mode                                 │
│ [□] Message Timer                                │
│ [✓] Chat Timestamps                    [□]       │
│ [✓] Model Icons                                  │
│ [□] Message IDs                                  │
│ [□] Hide Chat Avatars                    [□]     │
│ [✓] Message Token Count                          │
│ [✓] Compact Input Area                   [□]     │
├──────────────────────────────────────────────────┤
│ Miscellaneous                                    │
│ [Reload Chat] [Debug Menu]                       │
├──────────────────────────────────────────────────┤
│ Clean-Up                                         │
│ [□] Smooth Streaming                             │
│ [□] Stream Fade-In 🧪                            │
│ [□] Message Sound                                │
│ [✓] Background Sound Only                        │
│ [✓] Relaxed API URLs                             │
│ [□] Lorebook Import Dialog                       │
│ [□] Auto-select Input Text                       │
│ [□] Markdown Hotkeys 🔬                          │
│ [✓] Restore User Input                           │
│ [□] MovingUI 🔄  [Reset]                         │
├──────────────────────────────────────────────────┤
│ Right Column (continued):                        │
│ [□] "Send" to Continue                           │
│ [✓] Quick "Continue" button                      │
│ [✓] Quick "Impersonate" button                   │
│ [✓] Swipes [□] [□]  Gestures [□]                │
│ [✓] Auto-load Last Chat                          │
│ [✓] Auto-scroll Chat                             │
│ [□] Auto-save Message Edits                      │
│ [✓] Confirm message deletion                     │
│ [□] Auto-fix Markdown                            │
│ [✓] Forbid External Media                        │
│ [✓] Show {{char}}: in responses                  │
│ [✓] Show {{user}}: in responses                  │
│ [□] Show <tags>: in responses                    │
│ [□] Experimental Macro Engine 🧪                 │
│ [□] Relax message trim in Groups                 │
│ [□] Log prompts to console                       │
│ [✓] Request token probabilities                  │
│ [□] Show group chat queue                        │
│ [✓] Pin greeting message styles                  │
├──────────────────────────────────────────────────┤
│ Auto-swipe [▾] (expandable)                      │
│ Auto-Continue (expandable)                       │
├──────────────────────────────────────────────────┤
│ MovingUI Preset: [▼ Default ] [💾]               │
│                                                  │
│ Custom CSS [🔲] (expand/collapse)                │
│ ┌──────────────────────────────────────────┐     │
│ │ textarea for custom CSS                  │     │
│ │                                          │     │
│ └──────────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
```

### Settings Panel Specifications
| Element | Position | Size | Colors | Notes |
|---------|----------|------|--------|-------|
| Panel width | Right side | w: 320-350px | bg: `#1a1a2e` | Scrollable |
| Section headers | — | Font: 14px, bold | `#e0e0ff` | Left border accent |
| Dropdown selector | — | h: 30px, full width | bg: `#2a2a3e`, border: `#3a3a5e` | Rounded (6px) |
| Dropdown text | In selector | Font: 13px | `#ccccdd` | |
| Checkbox (unchecked) | Left | 16×16px | border: `#6666aa` | Square, rounded (3px) |
| Checkbox (checked) | — | — | bg: `#6666cc`, checkmark: white | Purple fill |
| Checkbox label | Right of checkbox | Font: 13px | `#ccccdd` | |
| Toggle switches | — | 36×20px | Off: `#3a3a5e`, On: `#6666cc` | Pill shape |
| Slider (same as S2) | — | — | track: `#3a3a5e`, fill: `#6666cc` | |
| Info icon [?] | Right of label | 14×14px | `#6666aa` | Tooltip trigger |
| Section divider | Between sections | h: 1px | bg: `#2a2a3e` | Subtle line |

### Toggle Options Grid (Two-Column Layout)
| Element | Position | Size | Colors | Notes |
|---------|----------|------|--------|-------|
| Container | — | Two columns | — | CSS Grid or Flex |
| Left column | — | ~48% width | — | Checkboxes left-aligned |
| Right column | — | ~48% width | — | Checkboxes right-aligned |
| Row height | — | h: 28px | — | Consistent vertical rhythm |
| Gap between rows | — | 4px | — | Dense but readable |

---

## Global Design System

### Color Palette
```css
:root {
  /* Backgrounds */
  --bg-primary:      #0f0f1a;    /* Main background (darkest) */
  --bg-secondary:    #1a1a2e;    /* Toolbar, panels, input bars */
  --bg-tertiary:     #252540;    /* Cards, elevated surfaces */
  --bg-input:        #2a2a3e;    /* Input fields, dropdowns */
  --bg-hover:        #2e2e4a;    /* Hover states */

  /* Borders */
  --border-default:  #3a3a5e;    /* Default borders */
  --border-subtle:   #2a2a3e;    /* Subtle dividers */
  --border-focus:    #6666cc;    /* Focus states */

  /* Text */
  --text-primary:    #e0e0ff;    /* Headings, names, emphasis */
  --text-secondary:  #ccccdd;    /* Body text, values */
  --text-muted:      #8888aa;    /* Labels, icons, placeholders */
  --text-dim:        #6666aa;    /* Timestamps, metadata */
  --text-faint:      #555577;    /* Placeholder text */

  /* Accent Colors */
  --accent-primary:  #6666cc;    /* Primary accent (purple-blue) */
  --accent-secondary:#ff6644;    /* Generate button, CTAs (orange-red) */
  --accent-dialogue: #ffaa44;    /* Dialogue text in messages (orange) */
  --accent-danger:   #ff4444;    /* Delete, errors */
  --accent-success:  #44cc66;    /* Online, success states */
  --accent-info:     #4488cc;    /* Links, info */

  /* Slider Specific */
  --slider-track:    #3a3a5e;
  --slider-fill:     #6666cc;
  --slider-thumb:    #ffffff;

  /* Shadows */
  --shadow-panel:    0 0 10px rgba(0, 0, 0, 0.3);
  --shadow-card:     0 2px 8px rgba(0, 0, 0, 0.2);
  --shadow-dropdown: 0 4px 16px rgba(0, 0, 0, 0.4);
}
```

### Typography
| Element | Font Family | Size | Weight | Line Height | Color |
|---------|------------|------|--------|-------------|-------|
| H1 (page title) | Inter / system | 20px | 700 | 1.3 | `--text-primary` |
| H2 (section) | Inter / system | 16px | 600 | 1.3 | `--text-primary` |
| H3 (subsection) | Inter / system | 14px | 600 | 1.4 | `--text-primary` |
| Body | Inter / system | 14-15px | 400 | 1.5-1.6 | `--text-secondary` |
| Small / metadata | Inter / system | 12-13px | 400 | 1.4 | `--text-muted` |
| Tiny / fine print | Inter / system | 11px | 400 | 1.3 | `--text-dim` |
| Code / monospace | JetBrains Mono | 13px | 400 | 1.5 | `--text-secondary` |
| Input text | Inter / system | 14px | 400 | 1.4 | `--text-secondary` |
| Button text | Inter / system | 13px | 500 | 1.0 | `--text-primary` |

### Spacing System
```
4px  — xs:  Tight gaps, icon padding
8px  — sm:  Small gaps, card internal spacing
12px — md:  Medium gaps, between related elements
16px — lg:  Standard padding, card padding
20px — xl:  Section padding
24px — 2xl: Major section spacing
32px — 3xl: Page-level padding
```

### Border Radius
```
3px  — Checkboxes, small badges
6px  — Input fields, dropdowns, small buttons
8px  — Cards, panels
12px — Modals, large cards
18px — Input bar (pill shape)
50%  — Avatars (circle), circular buttons
```

### Component Specifications

#### Buttons
| Type | Height | Padding | bg | border-radius | Font | Hover |
|------|--------|---------|-----|---------------|------|-------|
| Primary (Generate) | 36px | 0 16px | `--accent-secondary` | 18px (pill) | 13px bold white | darken 10% |
| Secondary | 32px | 0 14px | `--bg-input` | 6px | 13px `--text-secondary` | bg: `--bg-hover` |
| Icon button | 32×32px | — | transparent | 6px | — | bg: `--bg-hover` |
| Small icon | 20×20px | — | transparent | 4px | — | color: `--text-primary` |
| Ghost/Text | auto | 4px 8px | transparent | 4px | 13px `--text-muted` | bg: `--bg-hover` |

#### Input Fields
| Type | Height | Padding | bg | border | border-radius | Font |
|------|--------|---------|-----|--------|---------------|------|
| Text input | 36px | 0 12px | `--bg-input` | 1px `--border-default` | 18px | 14px |
| Search input | 28px | 0 10px | `--bg-input` | 1px `--border-default` | 14px | 13px |
| Dropdown | 30-32px | 0 12px | `--bg-input` | 1px `--border-default` | 6px | 13px |
| Number input | 28px | 0 8px | `--bg-input` | 1px `--border-default` | 6px | 14px mono |
| Textarea | auto | 8px 12px | `--bg-input` | 1px `--border-default` | 6px | 13px mono |

#### Panels / Sidebars
| Type | Width | bg | shadow | z-index |
|------|-------|-----|--------|---------|
| Left settings panel | 300-320px | `--bg-secondary` | `--shadow-panel` | 100 |
| Right settings panel | 320-350px | `--bg-secondary` | `--shadow-panel` | 100 |
| Dropdown menu | auto (min 200px) | `--bg-secondary` | `--shadow-dropdown` | 200 |
| Modal | 400-600px | `--bg-secondary` | `--shadow-dropdown` | 300 |

#### Scrollbar Styling
```css
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #3a3a5e;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #555577;
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Colors & Typography)
1. Update Tailwind config with SillyTavern color palette
2. Create CSS custom properties file
3. Update global fonts (Inter + JetBrains Mono)
4. Set dark background on body/root

### Phase 2: Top Toolbar & Navigation
1. Redesign top toolbar with icon-only buttons
2. Add secondary bar (chat selector + search)
3. Create icon button components
4. Implement hover/active states

### Phase 3: Chat Cards (Recent Chats)
1. Build chat card component with avatar, metadata, actions
2. Implement card grid/list layout
3. Add pin, edit, delete actions
4. Show message count and file size

### Phase 4: Welcome Screen
1. Build welcome box with centered content
2. Add quick-action buttons (API, Characters, Extensions)
3. Style assistant avatar (logo circle)

### Phase 5: Input Bar
1. Redesign bottom input bar (fixed positioning)
2. Add menu and magic wand icons
3. Style send buttons and Generate button
4. Implement expandable textarea

### Phase 6: Message Styling
1. Differentiate user vs AI message layouts
2. Add token count display
3. Style dialogue text (orange) and actions (italic)
4. Implement swipe controls
5. Add thinking/reasoning collapsible block

### Phase 7: Settings Panels
1. Build left panel (API/Chat settings)
2. Build right panel (UI settings)
3. Implement slider, checkbox, dropdown components
4. Add section headers and dividers

### Phase 8: Polish
1. Smooth transitions and animations
2. Scrollbar styling
3. Focus states and keyboard navigation
4. Responsive considerations
5. Custom CSS support

---

## Component Dependency Map

```
App
├── TopToolbar
│   ├── IconButton (×9-10)
│   └── ThemeDropdown
├── SecondaryBar
│   ├── ChatSelector
│   ├── SearchInput
│   └── ChatActions
├── MainContent
│   ├── WelcomeScreen (when no chat)
│   │   ├── AssistantMessage
│   │   └── QuickActions
│   └── ChatView (when chat active)
│       ├── MessageList
│       │   ├── UserMessage
│       │   ├── AIMessage
│       │   │   ├── ThinkingBlock
│       │   │   ├── MessageContent
│       │   │   └── SwipeControls
│       │   └── SystemMessage
│       └── InputBar
│           ├── MenuIcons
│           ├── ChatInput
│           └── SendControls
├── LeftPanel (settings)
│   ├── PresetSelector
│   ├── SliderControl (×4)
│   ├── CheckboxControl (×2)
│   └── NumberInput (×2)
└── RightPanel (UI settings)
    ├── ThemeSelector
    ├── DropdownControl (×6)
    ├── CheckboxGrid (×20+)
    ├── SliderControl (×4)
    ├── ExpandableSection (×3)
    └── CustomCSSEditor
```

---

## Current Codebase State (vs Target Design)

### Current Tailwind Theme Colors (`client/tailwind.config.js`)

| Token | Current Value | Target (SillyTavern) | Needs Change |
|-------|--------------|----------------------|--------------|
| `tavern-bg` | `transparent` | `#0f0f1a` solid | ✅ YES |
| `tavern-surface` | `#ffffff0a` (5% white) | `#1a1a2e` solid | ✅ YES |
| `tavern-surface2` | `#ffffff08` | `#252540` solid | ✅ YES |
| `tavern-accent` | `#7c3aed` (purple-600) | `#6666cc` (muted purple-blue) | ✅ YES |
| `tavern-accent2` | `#a855f7` (purple-500) | `#ff6644` (orange-red for CTA) | ✅ YES |
| `tavern-text` | `#f3f4f6` (gray-100) | `#ccccdd` (softer) | ✅ YES |
| `tavern-muted` | `#6b7280` (gray-500) | `#8888aa` (blue-tinted) | ✅ YES |
| `tavern-border` | `#ffffff12` (7% white) | `#3a3a5e` (visible) | ✅ YES |
| `tavern-hover` | `#ffffff0a` | `#2e2e4a` (solid) | ✅ YES |
| `tavern-danger` | `#ef4444` (red-500) | `#ff4444` | ✅ Minimal |
| `tavern-success` | `#22c55e` (green-500) | `#44cc66` | ✅ Minimal |

**Key difference**: Current theme uses semi-transparent whites over a gradient background. Target uses solid dark colors with no transparency/glassmorphism.

### Current Component Mapping

| Current Component | File | SillyTavern Equivalent | Status |
|-------------------|------|----------------------|--------|
| `Sidebar.tsx` | Character list + chat list | Top toolbar + secondary bar + chat cards | 🔄 Major redesign |
| `ChatView.tsx` | Chat messages container | Same (chat view) | 🔄 Message styling changes |
| `MessageBubble.tsx` | Individual message | Same (message card) | 🔄 Style overhaul |
| `MessageInput.tsx` | Bottom input bar | Same (bottom input bar) | 🔄 Layout changes |
| `TopBar.tsx` | Top bar (hamburger + title) | Top toolbar (icon-only) | 🔄 Complete replacement |
| `CharacterEditor.tsx` | Modal form | Similar modal | 🔄 Style updates |
| `ChatSettings.tsx` | Modal settings | Left sidebar panel | 🔄 Modal → Panel |
| `PersonaManager.tsx` | Modal manager | Right sidebar section | 🔄 Style updates |
| `LorebookEditor.tsx` | Modal editor | Right sidebar section | 🔄 Style updates |
| `CharacterAvatar.tsx` | Circular avatar | Same (circular avatar) | ✅ Works as-is |
| `IconBar.tsx` | Icon bar (UNUSED) | Top toolbar icons | ♻️ Can repurpose |
| `CharacterGallery.tsx` | Grid view (UNUSED) | Not needed | ❌ Can remove |

### Current Layout Structure (`App.tsx`)

```
Current:
┌─ flex h-screen overflow-hidden bg-gradient (complex gradient)
│  ├─ Sidebar (w-80, conditional)
│  ├─ flex-1 flex flex-col
│  │  ├─ TopBar (h-12)
│  │  ├─ ChatView / WelcomeScreen
│  │  └─ MessageInput
│  └─ ChatSettings (conditional, overlay)
└─ Modals (CharacterEditor, PersonaManager, LorebookEditor, ConfirmModal, Toast)

Target (SillyTavern-style):
┌─ flex h-screen overflow-hidden bg-[#0f0f1a] (solid dark)
│  ├─ flex flex-col flex-1
│  │  ├─ TopToolbar (h-[50px], icon-only buttons)
│  │  ├─ SecondaryBar (h-[40px], chat selector + search)
│  │  ├─ MainContent (flex-1, overflow-y-auto)
│  │  │  ├─ WelcomeScreen (when no chat)
│  │  │  └─ ChatView (when active)
│  │  └─ MessageInput (h-[50-60px], fixed bottom)
│  ├─ LeftPanel (w-[320px], conditional, settings/presets)
│  └─ RightPanel (w-[350px], conditional, UI settings)
└─ Modals (overlay, conditional)
```

### Files Requiring Modification

#### Must Change (Core UI Overhaul)
| File | Change Scope | Priority |
|------|-------------|----------|
| `tailwind.config.js` | Replace all color tokens, add new ones | 🔴 P0 |
| `client/src/index.css` | Remove gradient bg, add solid bg, scrollbar styles | 🔴 P0 |
| `App.tsx` | Restructure layout (toolbar, secondary bar, panels) | 🔴 P0 |
| `TopBar.tsx` → `TopToolbar.tsx` | Complete rewrite (icon-only toolbar) | 🔴 P0 |
| `Sidebar.tsx` | Split into SecondaryBar + ChatCardList | 🔴 P0 |
| `MessageBubble.tsx` | Restyle (dialogue color, token count, swipe controls) | 🔴 P0 |
| `MessageInput.tsx` | Add menu/wand icons, Generate button styling | 🟡 P1 |
| `ChatSettings.tsx` | Convert from modal to left sidebar panel | 🟡 P1 |

#### Must Change (New Components)
| File | Description | Priority |
|------|-------------|----------|
| `SecondaryBar.tsx` | NEW: Chat selector dropdown + search bar | 🔴 P0 |
| `ChatCard.tsx` | NEW: Individual chat card for recent chats list | 🔴 P0 |
| `TopToolbar.tsx` | NEW: Icon-only toolbar (replaces TopBar) | 🔴 P0 |
| `LeftPanel.tsx` | NEW: API/preset settings panel (left sidebar) | 🟡 P1 |
| `RightPanel.tsx` | NEW: UI settings panel (right sidebar) | 🟡 P1 |
| `SliderControl.tsx` | NEW: Reusable slider component | 🟡 P1 |
| `ThinkingBlock.tsx` | NEW: Collapsible "Thought for N seconds" block | 🟡 P1 |

#### Minor Changes
| File | Change Scope | Priority |
|------|-------------|----------|
| `WelcomeScreen.tsx` | Style quick-action buttons as pills | 🟢 P2 |
| `CharacterAvatar.tsx` | Add sizes, border options | 🟢 P2 |
| `Toast.tsx` | Position update (bottom-center is correct) | 🟢 P3 |
| `ConfirmModal.tsx` | Style consistency update | 🟢 P3 |

#### Can Remove
| File | Reason |
|------|--------|
| `IconBar.tsx` | Unused, superseded by new TopToolbar |
| `CharacterGallery.tsx` | Unused, not imported |

### CSS/Visual Pattern Changes

| Aspect | Current | Target |
|--------|---------|--------|
| Background | Multi-layer gradient (pink/cyan/orange blobs) | Solid `#0f0f1a` |
| Glassmorphism | `backdrop-blur-xl` + transparent bg | Solid opaque backgrounds |
| Borders | `#ffffff12` (barely visible) | `#3a3a5e` (clearly visible) |
| Surface opacity | `ee`/`cc`/`aa` alpha values | Solid `#1a1a2e` / `#252540` |
| User message text | `text-amber-400` | `#ccccdd` (same as body) |
| AI message text | `text-gray-200` | `#ccccdd` (same as body) |
| Dialogue highlights | Not styled differently | `#ffaa44` orange for `"quoted"` text |
| Action text | Not styled differently | Italic `#ccccdd` for `*asterisked*` text |
| Token counts | Not shown | `#6666aa` below message header |
| Swipe controls | Bottom of message, basic arrows | Right-aligned, `[>] [N/N [▼]]` format |
| Input bar icons | Hamburger + settings gear | Hamburger + magic wand + search |
| Generate button | Green pill with spinner | Orange-red `#ff6644` pill |
| Settings access | Modal overlays | Slide-in side panels (left/right) |
| Toolbar | Text title + hamburger | Row of icon-only buttons |
| Font | `'Segoe UI', system` | `Inter` + `JetBrains Mono` for code |

### Tailwind Config Additions Needed

```js
// New colors to add to tailwind.config.js
colors: {
  tavern: {
    // Backgrounds (solid, not transparent)
    bg: '#0f0f1a',
    surface: '#1a1a2e',
    surface2: '#252540',
    input: '#2a2a3e',
    hover: '#2e2e4a',
    // Borders
    border: '#3a3a5e',
    'border-subtle': '#2a2a3e',
    'border-focus': '#6666cc',
    // Text
    text: '#ccccdd',
    'text-bright': '#e0e0ff',
    muted: '#8888aa',
    dim: '#6666aa',
    faint: '#555577',
    // Accents
    accent: '#6666cc',
    'accent-hover': '#7777dd',
    cta: '#ff6644',
    'cta-hover': '#ff7755',
    dialogue: '#ffaa44',
    danger: '#ff4444',
    success: '#44cc66',
    info: '#4488cc',
  }
}
```
