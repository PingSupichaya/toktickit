# Lab 4 — AI Use and Reflection


**LLM/agent used:** Opencode Zen Muse Spark 1.3 Free


## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Convert lab4 sheet into .md files and send to opencode to double check docs/*.md files for correctness | Check with the labsheet that all details are covered, then fix the real gaps. |
| 2 | Help me double check docs/lab-04/*.md. Is anything missing and needs to be fixed? Reference with temp/SE_Lab_4.md. | Double check with another AI and labsheet to make sure no missing contract. |
| 3 | Help me do this task (tasks) and do not work out of scope and check correctness by reference docs/lab-04/*.md | Run the matching test command for both server and client in each issue and re-checked the touched files against the spec. |
| 4 | I have found an error on the server test. What is this error? Help me fix them. | Use the agents to find the root cause and read what agents caught, then fix it and commit the changed files. |
| 5 | Fix some dashboard alignment and change some new element to make web app more easy to read | Change dashboard alignment and checked the new styles, then confirmed criteria still pass. |
| 6 | Read the latest request-changes comment on my PR and tell me if it is true without changing anything. | Read what the agents caught and discuss with the reviewer to meet the same point. |
| 7 | Implement the dashboards E2E with screenshots and verify the responsive/accessibility checklist. | Ran the full E2E suites and checked the PNG evidence align with spec. |

## Reflection
Two or three sentences: what made your prompts better, and one place you had to correct or reject what the agent produced.

> Giving one issue at a time with "do not work out of scope" kept every change small and reviewable, and asking the agent to ask me back resolved real conflicts. When the agents do out of scope but the work is correctly, I need to make a decision to keep or cancel it.
