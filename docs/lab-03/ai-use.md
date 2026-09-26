# Lab 3 — AI Use and Reflection




**LLM/agent used:** Opencode Zen Big Pickle




## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | You can read details in Lab_3_sheet.md for helping me in this work, your first job is help me to create an specDD and testDD with 4 doc files(specification.md, ui-spec.md, api-spec.md, testsmd) | Cross check with Claude and Gemini that all details are covered. |
| 2 | help me do this issue, your tasks are 1. create a prisma model for adding database table 2. adding a new enum and index 3. create new migration for adding prisma model 4. seeding for a new database. Details aligned with specification.md. | Check prisma migration and seeding, make sure about password is hashed before keep in database|
| 3 | Help me to replace the requester selector with authentication and password change, add rate limit and CSRF middleware and safe error handling. For client, add a login screen and change password screen. All details align with .md file in docs/lab-03 | Determine all what agents do and ask them for a weird thing then make it meet criteria of issue. |
| 4 | Help me to do Backend task (give a task) and Client task (give a task) please make sure everything meets criteria and don’t work out of scope | run npm test and web app to check accuracy of works |
| 5 | Help me to do this task (give a task) do not work out of scope and align with docs/lab-03/*.md file., if you wonder anything just ask me. | run test and check flow and UI that works correctly. |
| 6 | (paste the error message) help me fix this issue and do not edit irrelevant files. | double check the agents work before creating the pull request. |
| 7 | Help me update test instruction in README to be upto-date instruction please.| Try to run tests follow README. |
| 8 | Help me formatting ai-use and reviewer doc files to be readable. | Try to render after the agents formatting .md files|

## Reflection
Two or three sentences: what made your prompts better, and one place you had to correct or reject what the agent produced.

> Give the clear-detailed tasks of each issue to the agents. Brief the agents do not work out of scope and make sure the work match all the criteria. Once I promted the breif details for backend tasks, it use a long time to work so I have to cancel this task and give the very clear task with specific files to it.