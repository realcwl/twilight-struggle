# Local card review

Read `pending-comments.md` first when asked to address feedback. `comments.json` is the durable source of truth. Image paths in comments point to `uploads/` here.

Use `PATCH http://localhost:4311/api/comments/<id>` with JSON `{ "status": "resolved", "resolution": "What changed and how it was verified" }` after addressing that specific comment. This preserves history and rebuilds the pending digest. A comment can be reopened from the website.

Keep attachments and resolved comments. Do not overwrite the review store with fixtures. Automated tests use temporary folders outside this directory.
