// C:\Users\anast\PycharmProjects\AI_ORGANIZER_VITE\src\editor\extensions\SegmentMark.ts
import { Mark, mergeAttributes } from "@tiptap/core";

export const SegmentMark = Mark.create({
  name: "segmentMark",

  addAttributes() {
    return {
      segmentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-segment-id"),
        renderHTML: (attrs) => (attrs.segmentId ? { "data-segment-id": attrs.segmentId } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-segment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        style:
          "background: rgba(114,255,191,0.18); border: 1px solid rgba(114,255,191,0.30); padding: 0 2px; border-radius: 6px;",
      }),
      0,
    ];
  },
});
