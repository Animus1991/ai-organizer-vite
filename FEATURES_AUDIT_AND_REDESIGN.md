# Features Audit & Redesign Plan

## Current State Analysis

### 1. Word Editor / Notes Editor

**Current Implementation**:
- Rich text editor (TipTap) for writing notes
- Stored in localStorage per document
- Can replace document text
- Two modes: "simple" (Word editor) and "smart" (Smart Notes)
- Toggle between modes via dropdown

**Problems**:
- ❌ **Unclear purpose**: What is it for? Personal notes? Document annotations? Comments?
- ❌ **Confusing naming**: "Word editor" vs "Notes" - what's the difference?
- ❌ **Poor UX**: Hidden behind toggle, unclear when to use it
- ❌ **No clear workflow**: How does it relate to document editing?
- ❌ **No persistence**: Only localStorage, lost if cleared
- ❌ **No collaboration**: Notes are local only

**Value Assessment**:
- ✅ **Potentially useful**: Notes/annotations are valuable for document management
- ⚠️ **Needs clarification**: Should be clear annotations/comments on chunks or document-level notes

**Recommended Redesign**:
1. **Rename to "Document Notes"** - Clear purpose
2. **Split into two features**:
   - **Document Notes**: High-level notes about the entire document (research notes, summary, etc.)
   - **Chunk Comments**: Comments/annotations on specific chunks (more useful!)
3. **Better UI**: 
   - Always visible sidebar or dedicated section
   - Clear icons and labels
   - Save to backend (not just localStorage)
4. **Better workflow**:
   - Document Notes: Always available, clearly labeled
   - Chunk Comments: Click on chunk → add comment

---

### 2. Smart Notes

**Current Implementation**:
- Auto-tagging and categorization system
- Stored in localStorage
- Tags, categories, priority levels
- Can link to chunks
- Search/filter functionality

**Problems**:
- ❌ **Over-engineered**: Auto-tagging is basic/not useful
- ❌ **Confusing**: What makes it "smart"? The auto-tagging is very basic
- ❌ **No real value**: Tags are just extracted words, categories are basic
- ❌ **Poor integration**: Doesn't integrate well with chunks
- ❌ **No persistence**: localStorage only
- ❌ **Redundant**: Overlaps with regular notes

**Value Assessment**:
- ⚠️ **Questionable value**: Auto-tagging is too basic to be useful
- ⚠️ **Better as simple comments**: Would be more useful as chunk comments

**Recommended Redesign**:
1. **Remove Smart Notes as separate feature**
2. **Integrate into Chunk Comments**:
   - Allow manual tags (not auto)
   - Allow manual categories
   - Keep search/filter
   - Save to backend
3. **Simplify**: Focus on useful features, not "smart" gimmicks

---

### 3. Outline Wizard

**Current Implementation**:
- 3-step wizard: Select chunks → Generate outline → Edit outline
- Generates markdown outline template
- Very specific to academic papers
- Exports as .md file

**Problems**:
- ❌ **Too specific**: Only useful for academic papers
- ❌ **Unclear purpose**: What if user doesn't write papers?
- ❌ **Poor UI**: Basic wizard, not intuitive
- ❌ **Limited value**: Just generates a template
- ❌ **No integration**: Doesn't connect to actual document structure

**Value Assessment**:
- ⚠️ **Limited use case**: Only for academic/research papers
- ⚠️ **Better alternatives**: Could be replaced with better export/outline features

**Recommended Redesign**:
1. **Rename to "Document Outline"** or "Structure View"**
2. **Make it more general**:
   - Show document structure (chunks as outline)
   - Allow reordering chunks
   - Export as outline (markdown, JSON, etc.)
   - Not just for papers
3. **Better UI**:
   - Tree view of chunks
   - Drag-and-drop reordering
   - Collapsible sections
4. **More useful**:
   - Visual document structure
   - Quick navigation
   - Export options

---

## Redesign Plan

### Phase 1: Clarify & Simplify

#### 1.1 Document Notes (formerly "Word Editor")
- **Purpose**: High-level notes about the document
- **Location**: Always visible sidebar or dedicated section
- **Features**:
  - Rich text editor
  - Auto-save to backend
  - Clear labeling: "Document Notes"
  - Word/character count
  - Export notes

#### 1.2 Chunk Comments (new, replaces Smart Notes)
- **Purpose**: Comments/annotations on specific chunks
- **Location**: In chunk detail view or side panel
- **Features**:
  - Add comment to any chunk
  - View all comments in list
  - Search/filter comments
  - Manual tags (optional)
  - Save to backend
  - Link to chunk

#### 1.3 Document Structure (formerly "Outline Wizard")
- **Purpose**: Visual document structure and navigation
- **Location**: Sidebar or dedicated view
- **Features**:
  - Tree view of chunks
  - Quick navigation
  - Export as outline (markdown, JSON)
  - Drag-and-drop reordering (future)
  - Collapsible sections

---

### Phase 2: Implementation

#### Step 1: Remove/Simplify Smart Notes
- Remove auto-tagging (not useful)
- Remove "smart" mode toggle
- Keep simple notes functionality

#### Step 2: Rename & Clarify Word Editor
- Rename to "Document Notes"
- Make purpose clear
- Improve UI/UX
- Add backend persistence

#### Step 3: Add Chunk Comments
- New feature: comments on chunks
- Better than Smart Notes
- More useful for collaboration

#### Step 4: Redesign Outline Wizard
- Rename to "Document Structure"
- Make it more general
- Better UI/UX
- More useful features

---

## Acceptance Criteria

### Document Notes
- [ ] Clear purpose and labeling
- [ ] Always accessible
- [ ] Auto-save to backend
- [ ] Word/character count
- [ ] Export functionality

### Chunk Comments
- [ ] Can add comment to any chunk
- [ ] View all comments
- [ ] Search/filter comments
- [ ] Save to backend
- [ ] Clear UI/UX

### Document Structure
- [ ] Visual tree view
- [ ] Quick navigation
- [ ] Export options
- [ ] Clear purpose
- [ ] Better than current wizard

---

## Files to Modify

### Backend (NEW)
- `backend/src/ai_organizer/api/routes/notes.py` - Document notes API
- `backend/src/ai_organizer/api/routes/comments.py` - Chunk comments API
- `backend/src/ai_organizer/models.py` - Add Note and Comment models
- `backend/alembic/versions/` - Migration for notes/comments

### Frontend
- `src/pages/DocumentWorkspace.tsx` - Major refactor
- `src/components/DocumentNotes.tsx` (NEW) - Document notes component
- `src/components/ChunkComments.tsx` (NEW) - Chunk comments component
- `src/components/DocumentStructure.tsx` (NEW) - Structure view (replaces OutlineWizard)
- `src/components/OutlineWizard.tsx` - Remove or replace

---

## Next Steps

1. Start with removing Smart Notes complexity
2. Rename Word Editor to Document Notes
3. Add Chunk Comments feature
4. Redesign Outline Wizard to Document Structure

