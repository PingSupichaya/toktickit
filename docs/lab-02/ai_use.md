# Lab 2 — AI Use and Reflection


**LLM/agent used:** Opencode Zen


## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Reads requirement of lab sheet summary and write .md files in docs/lab-02 except docs.md(summary lab sheet) please | Double check with labsheet PDF file that every detail is not out of scope. |
| 2 | Removes out of scope details from every docs and makes .md format as same as labsheet | PR docs and edit files follow my partner review. |
| 3 | In server/prisma add required field in database and add seeds follow  do not work out of scope I ask you to do. if you not sure please ask me | |
| 4 |for client, define CSS and Zen green theme and create the reusable components, create API to retrieve only active Requesters from the database, create Requester selection screen and implement context for remember requester and update header app with selected username. | |
| 5 | ปรับ dropdown ของ select requester และแก้ App header ให้รองรับทั้ง desktop และ mobile| npm run dev เพื่อดูว่า component ที่ให้ไปแก้มามีการเปลี่ยนแปลงหรือไม่และตรงกับ ui spec แค่ไหน |
| 6 | Create APIs for reference data and attachments follows the api-spec.md | I run test and double check code with another AI |
| 7 | Create page for creating new ticket follows ui-spec.md your tasks is implement validation and connect with API | read the ui-spec and run web page to ensure what agents produced is correct |
| 8 | Create my tickets page follows ui-spec.md and make sure you implement all the required test of this lab  | I got the ticket detail page too, so I told agents to hide this page cause it’s not in issue. |
| 9 | Wire ticket detail page to App and change removal reason to be required | test the webpage that works correctly. |
| 10 | Run E2E tests using Playwright and capture screenshots of all required pages in Desktop, Tablet, and Mobile viewports as visual evidence โดยให้ e2e/lab-02/requester-ticket-flow.spec.ts และ artifacts/lab-02/screenshots/ ข้างในเป็น create-ticket/, my-tickets/, ticket-detail/ in same hierarchy with client, server and docs | Check what agents produced and test command to add test instruction in README. |


## Reflection
Two or three sentences: what made your prompts better, and one place you had to correct or reject what the agent produced.

> After I have changed the agent, I need to brief task very in detail. To make the agent does its work correctly, I need to answer the question directly and clearly. Don't let it guess what it should do