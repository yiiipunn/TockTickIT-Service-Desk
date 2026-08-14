# Lab 1 — Peer Review Record

**Author:** Phurithip Paisanworajit — 67070503437 — GitHub: @yiiipunn
**Peer reviewer:** Sorawit Chaitong — 67070503442 — GitHub: @DEV4952

## Pull Requests I authored (reviewed by my partner)

| PR | Branch                         | Reviewer verdict |
| -- | ------------------------------ | ---------------- |
| #5 | `feature/1-project-foundation` | Approved         |
| #6 | `feature/2-health-check`       | Approved         |
| #7 | `feature/3-category-seed`      | Approved         |
| #8 | `feature/4-category-list`      | Approved         |

## Pull Requests I reviewed for my partner

| Issue                        | Reviewed PR                                           | Review verdict |
| ---------------------------- | ----------------------------------------------------- | -------------- |
| Issue 1 — Project Foundation | [PR #5](https://github.com/DEV4952/TocktickIT/pull/5) | Approved       |
| Issue 2 — Health Check       | [PR #6](https://github.com/DEV4952/TocktickIT/pull/6) | Approved       |
| Issue 3 — Category Seed      | [PR #7](https://github.com/DEV4952/TocktickIT/pull/7) | Approved       |
| Issue 4 — Category List      | [PR #8](https://github.com/DEV4952/TocktickIT/pull/8) | Approved       |

---

## Issue 1 — Project Foundation

### Reviewer comment I received

> After I review now
> Frontend is ☑
> Backend is ☑
> PostgreSQL & Prisma is ☑
> Vitest & Supertest is ☑
> Credential safe is ☑
> README present is ☑

### How I responded

After he reviewed my code, he approved the pull request and I merged it into `lab1-staging`.

### My review for my partner

**Reviewed PR:** [PR #5 — Project Foundation](https://github.com/DEV4952/TocktickIT/pull/5)

**My comment:**

> Reviewed the project foundation and checked all acceptance criteria.
> Frontend setup works
> Backend setup works
> PostgreSQL and Prisma are configured
> Vitest and Supertest are configured
> Credentials and node_modules are not committed
> README includes the setup instructions
> Everything looks good to me.

**Partner's response:**

After I reviewed his code, I approved the pull request and he merged it into `lab1-staging`.

---

## Issue 2 — Health Check

### Reviewer comment I received

> I think i can't approve this yet because you need to remove 501 response, The endpoint current right now it sends both 501 and 200 responses at server/src/app.ts , Also in client/src/api.ts can you remove remove the throw here because it made fetch() code below can't work.

### How I responded

> I think there might be a misunderstanding here. I checked `server/src/app.ts` again, and the current code only returns the 200 response. The 501 response hasn't been there at first.
>
> I also searched for `status(501)` in the current branch and couldn't find any remaining occurrences. The 501 shown in `package-lock.json` is only part of an integrity hash and isn't related to the HTTP response.
>
> I'll check the `client/src/api.ts` issue separately. Thanks for pointing it out!

### My review for my partner

**Reviewed PR:** [PR #6 — Health Check](https://github.com/DEV4952/TocktickIT/pull/6)

**My comment:**

<img width="1290" height="1046" alt="Health Check Test Result" src="https://github.com/user-attachments/assets/3b982bc7-06da-413c-9621-0a984695b87f" />

> Tested locally and everything works as expected. The health check test passed and the system status shows Online correctly. Looks good to me ka!

**Partner's response:**

After I reviewed his code, I approved the pull request and he merged it into `lab1-staging`.

---

## Issue 3 — Category Seed

### Reviewer comment I received

> After I review it
> Category model - good
> creates the Category table correctly - good
> Seed inserts - good
> Seed uses upsert, safe to run multiple times without duplicates - good
> No credentials committed - good
> look good to me , Good job

### How I responded

> Thanks buddy!

After he reviewed my code, he approved the pull request and I merged it into `lab1-staging`.

### My review for my partner

**Reviewed PR:** [PR #7 — Category Seed](https://github.com/DEV4952/TocktickIT/pull/7)

**My comment:**

> Checked the implementation and test results. Everything works as expected and the required categories are returned correctly. Looks good mak ka!

**Partner's response:**

> Thank you so much

After I reviewed his code, I approved the pull request and he merged it into `lab1-staging`.

---

## Issue 4 — Category List

### Reviewer comment I received

> Review
> GET `/api/categories` reads from PostgreSQL via Prisma that ordered by id pass
> have supertest verifies status, names, and id ordering pass
> React renders categories from the real API response pass
> Loading state and error state both show pass
> Vitest covers success and error UI states pass
> No credentials commit pass
> Look good to me good work

### How I responded

> Thank you.

After he reviewed my code, he approved the pull request and I merged it into `lab1-staging`.

### My review for my partner

**Reviewed PR:** [PR #8 — Category List](https://github.com/DEV4952/TocktickIT/pull/8)

**My comment:**

> Checked frontend connection to health and categories APIs ✅
> Checked loading state ✅
> Checked online/offline states ✅
> Checked UI tests ✅
> `npm test` passed ✅
> Success and failure cases work as expected ✅
>
> Everything looks good and matches the requirements. Approved!
>
> Merge dai loeyyyy

**Partner's response:**

> Thank you kubbbbbb

After I reviewed his code, I approved the pull request and he merged it into `lab1-staging`.
