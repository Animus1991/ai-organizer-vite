// C:\Users\anast\PycharmProjects\AI_ORGANIZER_VITE\src\editor\extensions\CommentMark.ts
import { Mark, mergeAttributes } from "@tiptap/core";

export const CommentMark = Mark.create({
  name: "commentMark",

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-comment-id"),
        renderHTML: (attrs) => (attrs.commentId ? { "data-comment-id": attrs.commentId } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        style:
          "background: rgba(255, 230, 140, 0.18); border-bottom: 2px dotted rgba(255, 230, 140, 0.55);",
      }),
      0,
    ];
  },
});
