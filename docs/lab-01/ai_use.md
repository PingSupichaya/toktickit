# Lab 1 — AI Use and Reflection  (fill this in)

**LLM/agent used:** Claude Sonnet 5 High

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Help me do issue2 in app.ts to add display backend status based on real api call in react page and add the error message when backend is unavailable and don't add api for categories now just for health check. | Check all codes change and edit display status message |
| 2 | help me create migration for category table, ask me when you have a question. | Check table creating and migration complete |
| 3 | help me complete in creating seed and make sure it doesn't create duplicates when run more than once. | Runs command in test instructions from README to make sure seed is created. |
| 4 | #app.ts help me build an api to retrieves ID and name of categories in a predictable order from my database through prisma. | check what the produced codes do. |
| 5 | #api.ts #App.tsx build an api to display what api/categories get from database and show in react page | test with checkSystem button to see what data fetch by an api |
| 6 | can you add display of fetch status categories from api | I use npm run dev in client then check the produced code |
| 7 | Help me to write an easy to read README | Read all the README and decrease the topic |
| 8 | Help me to write a test instruction in README please | Test all agent produced test instructions |

## Reflection
Two or three sentences: what made your prompts better, and one place you had to
correct or reject what the agent produced.
Agent code correctness depends on how I give the prompt details. I have to breif what agent needs to do sometimes I think because of comments in code make agent works more correctly because agent reads the file before edit. The prompts can be better by adding acceptance criteria.
I need to review what agent wants to do in each step to ensure agent doesn't work out of scope or doesn't edit wrong code.