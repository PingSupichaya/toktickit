# Lab 1 — Peer Review Record

**Author:** Supichaya Limwatanasamut — 67070501087 — GitHub: @PingSupichaya  
**Peer reviewer:** 
> Chawin Chinpraditsuk — 67070501012 — GitHub: @Finyakginshabu  
Norawit Mahaprom — 67070501026 — GitHub: @NxNxmm  
Noppawit Tanmanee — 67070501082 — GitHub: @FakeKase

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
|    | feature/1-project-foundation | everything works fine for feature1 |
|    | feature/2-health-check | readme is clear for setup and testing, everything follows the criteria. |
|    | feature/3-category-seed | Everything meets the criteria and instructions was clear to setup. Make sure to resolve merge conflict before merge. |
|    | feature/4-category-list | The codes test passed and meets all the criteria |

### feature/1-project-foundation
Reviewer comment I received:  
    **Chawin:**  Very good, everything works fine for this issue, according to the criteria.  
**How I responded**:  
    Thanks<3

### feature/2-health-check
Reviewer comment I received:  
    **Chawin:** Looks good to me :D readme instructions are clear for setup and testing. I've tested the status codes, error messages and others, everything follows the criteria and works just fine.  
**How I responded**:  
    Happy to see this comment, thanks

### feature/3-category-seed
Reviewer comment I received:  
    **Chawin:** I've reviewed this issue, and everything meets the criteria :D. Instructions provided are clear to setup. Prisma Category model and migration are properly configured, using upsert to add the specified categories without duplicates, and database credentials are not committed. Please make sure to resolve the conflict for readme and ai_use before merge.  
**How I responded**:  
    Thanks for review. I will solve the merge conflict soon.

### feature/4-category-list
Reviewer comment I received:  
    **Chawin:** I've reviewed Issue #4, and it meets all the criteria. The categories endpoint works correctly, both Supertest and Vitest pass, and the web client properly displays categories from Prisma and Postgres. Also when server is not running, it shows "Load failed" as expected. Well done for Lab01 <3  
    **Norawit:** I pulled your branch to test on my local and ran all the setups. Everything works perfectly. The Prisma migrations and API endpoints are working smoothly, and the tests on Supertest and Vitest all passed. The display is not hard-code values and also loading state and error messege are nothing wrong! Nice one Kub!  
**How I responded**:  
    Thanks both of you for reviews <3

## Pull Requests I reviewed for my partner  
### Chawin
### feature/1-project-foundation
My comment:  
    This setup can work successfully. Frontend and backend are fine, no any secret leaks. It will be better if you add some setup instructions in readme.  
Partner's response:  
    Updated README.md with setup instructions as suggested. Thanks <3
### feature/2-health-check
My comment:  
    During local testing, the feature can work without any issue. Additionally, the test instruction is clear and easy to read so all criteria are met. Really good job <3  
Partner's response:  
    Thanks for the review :P <3
### feature/3-category-seed
My comment:  
    Everything works successfully. Great job ! All criteria have been met, and the instructions for setting up and testing the project are clear and easy to follow.  
Partner's response:  
    Thanks for the review :P <3
### feature/4-category-list
My comment:  
    1. The server tests passed, but there is only a few files were changed. Please make sure you have updated all the changed files.  
    2. All of changed files are updated, everything looks good ! From my testing, client and server test pass. This feature works fine and reaches all criteria.  
Partner's response:  
    1. Thanks for catching that :0 I ran git add . inside the /server folder by mistake. I’ve pushed the missing files now. <3  
    2. Thanks for the review :P <3

### Norawit
### feature/1-project-foundation
My comment: 
    Successfully initialize project ! Everything is fine but suggest to add some README or setup instructions to make your project more perfect.  
Partner's response:  
    -
### feature/2-health-check
My comment:  
    From a local test, everything works fine and meets the criteria. System status can show online and offline. You can improve it by give me a test or setup project instruction.  
Partner's response:  
    -
### feature/3-category-seed
My comment:  
    1. From my testing, server runs test failed. Please make sure you push correct code.  
    2. Both client and server test passed. I can see categories are created. All files are correct and meet all the criteria. Make sure you resolve merge conflict before merge. Great job!  
Partner's response:  
    I've fixed the false API, could you check the server again pls. I guess I pushed the wrong one before 'cause on issue 2 it work very fine.
### feature/4-category-list
My comment:  
    Nothing runs failed, both client and server are test passed and API can fetch all the categories to display in web page. Everything meets the criteria. Nice work !😍  
Partner's response:  
    -

### Noppawit
###  feature/3-category-seed
My comment:  
    1. From my testing, I notice the table is created in database but without createdAt. Could you please double-check your code to ensure it meets the criteria?  
    2. Great job ! Now all of the criteria are met, prisma migration is now working and seed added successfully. It will be better if you more test instructions in README😆  
Partner's response:  
    I've pushed the version with the createdAt column now! Please review again if it meets all the criteria.
### feature/4-category-list
My comment:  
    Web page can fetch categories to display. Everything meets criteria. Nice work kub !  
Partner's response:  
    -
